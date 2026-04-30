import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

export async function POST(request) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const openai = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
        timeout: 300000,
        maxRetries: 3,
      })
      
      const tempDir = join(process.cwd(), 'temp')
      let pdfPath = null

      try {
        const formData = await request.formData()
        const file = formData.get('pdf')

        if (!file) {
          sendEvent({ error: 'No se proporcionó archivo PDF' })
          controller.close()
          return
        }

        sendEvent({ status: 'Guardando PDF...' })

        if (!existsSync(tempDir)) {
          mkdirSync(tempDir, { recursive: true })
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const timestamp = Date.now()
        pdfPath = join(tempDir, `temp_${timestamp}.pdf`)
        writeFileSync(pdfPath, buffer)

        sendEvent({ status: 'Extrayendo texto del PDF...' })

        let textoCompleto = ''
        try {
          textoCompleto = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' })
          sendEvent({ status: `Texto extraído (${textoCompleto.length} caracteres)` })
        } catch (pdfError) {
          sendEvent({ error: 'No se pudo extraer texto del PDF' })
          controller.close()
          return
        }

        if (!textoCompleto || textoCompleto.trim().length === 0) {
          sendEvent({ error: 'El PDF no contiene texto extraíble' })
          controller.close()
          return
        }

        sendEvent({ status: 'Procesando con DeepSeek...' })

        const prompt = `Extrae TODOS los productos de esta factura. Lee cada línea cuidadosamente.

${textoCompleto}

Responde SOLO con JSON válido:
{"productos": [{"descripcion": "nombre", "cantidad": 10, "precio": 5.50}]}`

        let response
        try {
          response = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            stream: false,
            temperature: 0
          })
        } catch (apiError) {
          console.error('Error API:', apiError)
          sendEvent({ error: `Error de API: ${apiError.message}` })
          controller.close()
          return
        }

        sendEvent({ status: 'Procesando respuesta...' })

        let resultado
        try {
          const content = response.choices[0].message.content
          // Intentar extraer JSON si viene con texto adicional
          const jsonMatch = content.match(/\{[\s\S]*\}/)
          const jsonStr = jsonMatch ? jsonMatch[0] : content
          resultado = JSON.parse(jsonStr)
          sendEvent({ status: `Extraídos ${resultado.productos?.length || 0} productos` })
        } catch (parseError) {
          console.error('Error parseando:', parseError)
          console.error('Respuesta:', response.choices[0].message.content.substring(0, 500))
          sendEvent({ error: 'Error procesando respuesta de DeepSeek' })
          controller.close()
          return
        }
        
        if (!resultado.productos || resultado.productos.length === 0) {
          sendEvent({ error: 'No se encontraron productos en el PDF' })
          controller.close()
          return
        }

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

        const totalGeneral = productos.reduce((sum, p) => sum + parseFloat(p.total), 0)

        sendEvent({ 
          status: 'Completado',
          result: {
            productos,
            total_general: totalGeneral.toFixed(2),
            moneda: 'USD'
          }
        })

        if (pdfPath && existsSync(pdfPath)) unlinkSync(pdfPath)
        controller.close()

      } catch (error) {
        console.error('Error general:', error)
        sendEvent({ error: error.message || 'Error al procesar el PDF' })
        
        try {
          if (pdfPath && existsSync(pdfPath)) unlinkSync(pdfPath)
        } catch (e) {}
        
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

export const maxDuration = 60
