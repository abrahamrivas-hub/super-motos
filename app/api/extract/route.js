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
        timeout: 120000, // 2 minutos
        maxRetries: 0, // Manejamos los reintentos manualmente
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

        // Obtener número de páginas
        let numPaginas = 1
        try {
          const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' })
          const pagesMatch = pdfInfo.match(/Pages:\s+(\d+)/)
          if (pagesMatch) {
            numPaginas = parseInt(pagesMatch[1])
          }
        } catch (e) {
          console.log('No se pudo obtener info del PDF, asumiendo 1 página')
        }

        sendEvent({ status: `PDF tiene ${numPaginas} página(s)` })

        // Procesar página por página
        const todosLosProductos = []
        
        for (let pagina = 1; pagina <= numPaginas; pagina++) {
          sendEvent({ status: `Procesando página ${pagina}/${numPaginas}...` })
          
          let textoPagina = ''
          try {
            textoPagina = execSync(`pdftotext -layout -f ${pagina} -l ${pagina} "${pdfPath}" -`, { encoding: 'utf8' })
          } catch (pdfError) {
            sendEvent({ status: `Error extrayendo página ${pagina}, continuando...` })
            continue
          }

          if (!textoPagina || textoPagina.trim().length === 0) {
            sendEvent({ status: `Página ${pagina} vacía, continuando...` })
            continue
          }

          sendEvent({ status: `Analizando página ${pagina} con el sistema...` })

          const prompt = `Extrae TODOS los productos de esta página de factura. Lee cada línea cuidadosamente.

${textoPagina}

Responde SOLO con JSON válido:
{"productos": [{"descripcion": "nombre", "cantidad": 10, "precio": 5.50}]}

Si no hay productos en esta página, responde: {"productos": []}`

          let response
          let intentos = 0
          const maxIntentos = 3
          
          while (intentos < maxIntentos) {
            try {
              intentos++
              if (intentos > 1) {
                sendEvent({ status: `Reintentando página ${pagina}... (${intentos}/${maxIntentos})` })
                await new Promise(resolve => setTimeout(resolve, 2000 * intentos))
              }
              
              const stream = await openai.chat.completions.create({
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                stream: true,
                temperature: 0,
                max_tokens: 9000
              })
              
              let fullContent = ''
              for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || ''
                fullContent += content
              }
              
              response = {
                choices: [{
                  message: {
                    content: fullContent
                  }
                }]
              }
              
              break
              
            } catch (apiError) {
              console.error(`Error API página ${pagina} (intento ${intentos}):`, apiError)
              
              if (intentos >= maxIntentos) {
                sendEvent({ status: `Error en página ${pagina}, continuando con siguiente...` })
                response = null
                break
              }
            }
          }

          if (!response) continue

          // Procesar respuesta de esta página
          try {
            let content = response.choices[0].message.content
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
            
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            let jsonStr = jsonMatch ? jsonMatch[0] : content
            
            if (!jsonStr.endsWith('}')) {
              const lastCompleteProduct = jsonStr.lastIndexOf('},')
              if (lastCompleteProduct > 0) {
                jsonStr = jsonStr.substring(0, lastCompleteProduct + 1) + ']}'
              } else {
                jsonStr = jsonStr + ']}'
              }
            }
            
            const resultadoPagina = JSON.parse(jsonStr)
            
            if (resultadoPagina.productos && resultadoPagina.productos.length > 0) {
              // Procesar y agregar productos de esta página
              const productosNuevos = resultadoPagina.productos.map(p => {
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
              
              todosLosProductos.push(...productosNuevos)
              
              // Enviar productos parciales en tiempo real
              sendEvent({ 
                status: `Página ${pagina}: ${productosNuevos.length} productos encontrados`,
                partialResult: {
                  productos: [...todosLosProductos],
                  pagina: pagina,
                  totalPaginas: numPaginas
                }
              })
            } else {
              sendEvent({ status: `Página ${pagina}: sin productos` })
            }
            
          } catch (parseError) {
            console.error(`Error parseando página ${pagina}:`, parseError)
            sendEvent({ status: `Error procesando página ${pagina}, continuando...` })
          }
        }

        sendEvent({ status: 'Consolidando resultados...' })

        if (todosLosProductos.length === 0) {
          sendEvent({ error: 'No se encontraron productos en el PDF' })
          controller.close()
          return
        }

        const totalGeneral = todosLosProductos.reduce((sum, p) => sum + parseFloat(p.total), 0)

        sendEvent({ 
          status: 'Completado',
          result: {
            productos: todosLosProductos,
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

export const maxDuration = 300 // 5 minutos para PDFs grandes
