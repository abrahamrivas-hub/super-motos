import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { writeFileSync, unlinkSync, readdirSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

export async function POST(request) {
  // Inicializar OpenAI aquí para evitar error en build time
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 120000,
    maxRetries: 1,
  })
  const tempDir = join(process.cwd(), 'temp')
  let pdfPath = null
  let imagePaths = []

  try {
    const formData = await request.formData()
    const file = formData.get('pdf')

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo PDF' }, { status: 400 })
    }

    // Crear directorio temporal
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }

    // Guardar PDF temporalmente
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const timestamp = Date.now()
    pdfPath = join(tempDir, `temp_${timestamp}.pdf`)
    writeFileSync(pdfPath, buffer)

    console.log('📄 Convirtiendo PDF a imágenes con pdftoppm...')

    // Convertir PDF a imágenes PNG usando pdftoppm
    const outputPrefix = join(tempDir, `page_${timestamp}`)
    execSync(`pdftoppm -png -r 200 "${pdfPath}" "${outputPrefix}"`)

    // Leer las imágenes generadas
    const files = readdirSync(tempDir).filter(f => f.startsWith(`page_${timestamp}`) && f.endsWith('.png'))
    imagePaths = files.map(f => join(tempDir, f))

    console.log(`✓ ${imagePaths.length} página(s) convertida(s)`)

    if (imagePaths.length === 0) {
      throw new Error('No se pudo convertir el PDF a imágenes')
    }

    console.log('🔍 Extrayendo datos con GPT-4o Vision...')

    // Convertir imágenes a base64
    const imageMessages = imagePaths.map(path => {
      const imageBuffer = readFileSync(path)
      const base64 = imageBuffer.toString('base64')
      return {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${base64}`,
          detail: 'high'
        }
      }
    })

    const prompt = `Analiza estas imágenes de factura y extrae TODOS los productos de TODAS las páginas.

INSTRUCCIONES:
1. Busca la tabla de productos en cada imagen
2. Identifica las columnas (pueden variar):
   - Código | Descripción | Cant. | Precio | Total
   - Precio | Descripción | Cantidad | Pedido | Total (usa "Pedido" como cantidad)
   - Código | Productos | Unidad | Cant | Precio | Total
3. Extrae TODOS los productos que veas
4. Solo extrae descripción, cantidad y precio

REGLAS CRÍTICAS:
- La CANTIDAD es un número entero (15, 100, 1200)
- El PRECIO es un decimal en DÓLARES (0.70, 2.50, 55.00)
- Si hay columna "Pedido", esa es la cantidad
- Lee CUIDADOSAMENTE cada fila de la tabla
- NO inventes datos

FORMATO JSON:
{
  "productos": [
    {
      "descripcion": "BASTONES DELANTEROS TX200",
      "cantidad": 15,
      "precio": 55.00
    }
  ]
}

Extrae TODOS los productos de TODAS las imágenes.`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: 'text', text: prompt },
            ...imageMessages
          ]
        }
      ],
      max_tokens: 16000
    })

    let resultado
    try {
      resultado = JSON.parse(response.choices[0].message.content)
    } catch (parseError) {
      console.error('Error parseando JSON de GPT:', parseError)
      console.error('Respuesta de GPT:', response.choices[0].message.content.slice(0, 500))
      throw new Error('GPT devolvió JSON inválido. Intenta de nuevo.')
    }
    
    // Procesar productos
    const productos = resultado.productos.map(p => {
      const cantidad = parseFloat(p.cantidad)
      const precio = parseFloat(p.precio)
      
      if (isNaN(cantidad) || isNaN(precio) || cantidad <= 0 || precio <= 0) {
        return null
      }
      
      const total = cantidad * precio
      
      return {
        descripcion: p.descripcion,
        cantidad: cantidad.toString(),
        precio: precio.toFixed(2),
        total: total.toFixed(2)
      }
    }).filter(p => p !== null)

    console.log(`✓ Productos extraídos: ${productos.length}`)

    const totalGeneral = productos.reduce((sum, p) => sum + parseFloat(p.total), 0)

    return NextResponse.json({
      productos,
      total_general: totalGeneral.toFixed(2),
      moneda: '$'
    })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error al procesar el PDF' },
      { status: 500 }
    )
  } finally {
    // Limpiar archivos temporales
    try {
      if (pdfPath && existsSync(pdfPath)) unlinkSync(pdfPath)
      imagePaths.forEach(path => {
        try { 
          if (existsSync(path)) unlinkSync(path) 
        } catch (e) {}
      })
    } catch (e) {
      console.error('Error limpiando archivos temporales:', e)
    }
  }
}

export const maxDuration = 60
