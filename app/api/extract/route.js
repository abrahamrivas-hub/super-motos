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

    // Convertir PDF a imágenes PNG usando pdftoppm con ALTA resolución
    const outputPrefix = join(tempDir, `page_${timestamp}`)
    try {
      execSync(`pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`)
      console.log('✓ pdftoppm ejecutado correctamente')
    } catch (execError) {
      console.error('Error ejecutando pdftoppm:', execError)
      throw new Error('No se pudo convertir PDF a imágenes. pdftoppm falló.')
    }

    // Leer las imágenes generadas
    const files = readdirSync(tempDir).filter(f => f.startsWith(`page_${timestamp}`) && f.endsWith('.png'))
    imagePaths = files.map(f => join(tempDir, f))

    console.log(`✓ ${imagePaths.length} página(s) convertida(s)`)
    console.log(`📁 Archivos generados: ${files.join(', ')}`)

    if (imagePaths.length === 0) {
      console.error('❌ No se generaron imágenes. Archivos en temp:', readdirSync(tempDir))
      throw new Error('No se pudo convertir el PDF a imágenes')
    }

    console.log('🔍 Extrayendo datos con GPT-4o Vision...')

    // Convertir imágenes a base64
    const imageMessages = imagePaths.map(path => {
      const imageBuffer = readFileSync(path)
      const base64 = imageBuffer.toString('base64')
      const sizeKB = (imageBuffer.length / 1024).toFixed(2)
      console.log(`📷 Imagen: ${path.split('/').pop()} - Tamaño: ${sizeKB} KB`)
      return {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${base64}`,
          detail: 'high'
        }
      }
    })

    const prompt = `Analiza CUIDADOSAMENTE estas ${imagePaths.length} imágenes de factura y extrae ABSOLUTAMENTE TODOS los productos de TODAS las páginas.

CRÍTICO: Debes extraer CADA FILA de la tabla de productos. NO omitas ninguna fila.

INSTRUCCIONES:
1. Lee CADA imagen completamente de arriba a abajo
2. Busca la tabla de productos en cada imagen
3. Identifica las columnas (pueden variar):
   - Código | Descripción | Cant. | Precio | Total
   - Precio | Descripción | Cantidad | Pedido | Total (usa "Pedido" como cantidad)
   - Código | Productos | Unidad | Cant | Precio | Total
4. Extrae CADA FILA de la tabla, sin omitir ninguna
5. Solo extrae descripción, cantidad y precio

REGLAS:
- La CANTIDAD es un número entero (15, 100, 1200)
- El PRECIO es un decimal en DÓLARES (0.70, 2.50, 55.00)
- Si hay columna "Pedido", esa es la cantidad
- Lee TODAS las filas hasta el final de cada página
- NO te detengas hasta leer todo

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

IMPORTANTE: Extrae TODOS los productos, no solo los primeros. Revisa cada imagen completamente.`

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

    console.log(`🤖 Tokens usados: ${response.usage.total_tokens} (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})`)

    let resultado
    try {
      resultado = JSON.parse(response.choices[0].message.content)
      console.log(`📊 GPT extrajo ${resultado.productos.length} productos`)
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
