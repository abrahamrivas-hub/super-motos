'use client'

import { useState } from 'react'

export default function Home() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)
    setStatus('Iniciando...')

    const formData = new FormData()
    formData.append('pdf', file)

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            
            if (data.error) {
              setError(data.error)
              setLoading(false)
              return
            }
            
            if (data.status) {
              setStatus(data.status)
            }
            
            if (data.result) {
              setResult(data.result)
              setLoading(false)
            }
          }
        }
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto',
        background: '#1e1e1e',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        border: '1px solid #2a2a2a'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f3460 0%, #16213e 100%)',
          padding: '40px',
          color: 'white',
          textAlign: 'center',
          borderBottom: '2px solid #00d4ff'
        }}>
          <h1 style={{ 
            margin: '0 0 10px 0',
            fontSize: '2.5rem',
            fontWeight: '700',
            color: '#00d4ff'
          }}>
            📄 Extractor de Facturas
          </h1>
          <p style={{ 
            margin: 0,
            fontSize: '1.1rem',
            opacity: 0.9,
            color: '#b0b0b0'
          }}>
            Sube tu PDF y extrae todos los productos automáticamente
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '40px', background: '#1e1e1e' }}>
          {/* Upload Form */}
          <form onSubmit={handleSubmit} style={{ marginBottom: '40px' }}>
            <div style={{
              border: '3px dashed #00d4ff',
              borderRadius: '15px',
              padding: '40px',
              textAlign: 'center',
              background: '#2a2a2a',
              transition: 'all 0.3s'
            }}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                style={{ display: 'none' }}
                id="fileInput"
              />
              <label 
                htmlFor="fileInput"
                style={{
                  cursor: 'pointer',
                  display: 'inline-block'
                }}
              >
                <div style={{
                  fontSize: '3rem',
                  marginBottom: '15px'
                }}>
                  📎
                </div>
                <div style={{
                  fontSize: '1.2rem',
                  color: '#00d4ff',
                  fontWeight: '600',
                  marginBottom: '10px'
                }}>
                  {file ? file.name : 'Selecciona un archivo PDF'}
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  color: '#b0b0b0'
                }}>
                  Haz clic para seleccionar o arrastra aquí
                </div>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={!file || loading}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '18px',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: 'white',
                background: loading ? '#3a3a3a' : 'linear-gradient(135deg, #00d4ff 0%, #0f3460 100%)',
                border: 'none',
                borderRadius: '12px',
                cursor: loading || !file ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: loading || !file ? 'none' : '0 4px 15px rgba(0, 212, 255, 0.4)'
              }}
            >
              {loading ? `⏳ ${status}` : '🚀 Extraer Datos'}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div style={{ 
              padding: '20px',
              background: '#3a1a1a',
              border: '2px solid #ff4444',
              borderRadius: '12px',
              marginBottom: '30px',
              color: '#ff6666'
            }}>
              <strong>❌ Error:</strong> {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div>
              {/* Summary Card */}
              <div style={{
                background: 'linear-gradient(135deg, #0f3460 0%, #16213e 100%)',
                padding: '30px',
                borderRadius: '15px',
                marginBottom: '30px',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                gap: '20px',
                border: '2px solid #00d4ff'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#00d4ff' }}>
                    {result.productos.length}
                  </div>
                  <div style={{ fontSize: '1rem', opacity: 0.9, color: '#b0b0b0' }}>
                    Productos
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#00d4ff' }}>
                    ${result.total_general}
                  </div>
                  <div style={{ fontSize: '1rem', opacity: 0.9, color: '#b0b0b0' }}>
                    Total General
                  </div>
                </div>
              </div>

              {/* Products Table */}
              <div style={{
                overflowX: 'auto',
                borderRadius: '15px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                border: '1px solid #2a2a2a'
              }}>
                <table style={{ 
                  width: '100%',
                  borderCollapse: 'collapse',
                  background: '#2a2a2a'
                }}>
                  <thead>
                    <tr style={{ 
                      background: 'linear-gradient(135deg, #0f3460 0%, #16213e 100%)',
                      color: 'white',
                      borderBottom: '2px solid #00d4ff'
                    }}>
                      <th style={{ 
                        padding: '18px',
                        textAlign: 'left',
                        fontWeight: '600',
                        fontSize: '1rem',
                        color: '#00d4ff'
                      }}>
                        Descripción
                      </th>
                      <th style={{ 
                        padding: '18px',
                        textAlign: 'right',
                        fontWeight: '600',
                        fontSize: '1rem',
                        color: '#00d4ff'
                      }}>
                        Cantidad
                      </th>
                      <th style={{ 
                        padding: '18px',
                        textAlign: 'right',
                        fontWeight: '600',
                        fontSize: '1rem',
                        color: '#00d4ff'
                      }}>
                        Precio
                      </th>
                      <th style={{ 
                        padding: '18px',
                        textAlign: 'right',
                        fontWeight: '600',
                        fontSize: '1rem',
                        color: '#00d4ff'
                      }}>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.productos.map((prod, idx) => (
                      <tr 
                        key={idx}
                        style={{ 
                          borderBottom: '1px solid #3a3a3a',
                          background: idx % 2 === 0 ? '#2a2a2a' : '#1e1e1e',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#0f3460'}
                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#2a2a2a' : '#1e1e1e'}
                      >
                        <td style={{ 
                          padding: '16px',
                          fontSize: '0.95rem',
                          color: '#e0e0e0'
                        }}>
                          {prod.descripcion}
                        </td>
                        <td style={{ 
                          padding: '16px',
                          textAlign: 'right',
                          fontWeight: '500',
                          fontSize: '0.95rem',
                          color: '#e0e0e0'
                        }}>
                          {prod.cantidad}
                        </td>
                        <td style={{ 
                          padding: '16px',
                          textAlign: 'right',
                          fontWeight: '500',
                          fontSize: '0.95rem',
                          color: '#e0e0e0'
                        }}>
                          ${prod.precio}
                        </td>
                        <td style={{ 
                          padding: '16px',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: '#00d4ff',
                          fontSize: '0.95rem'
                        }}>
                          ${prod.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
