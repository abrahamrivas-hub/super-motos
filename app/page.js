'use client'

import { useState } from 'react'

export default function Home() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('pdf', file)

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar PDF')
      }

      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto',
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '40px',
          color: 'white',
          textAlign: 'center'
        }}>
          <h1 style={{ 
            margin: '0 0 10px 0',
            fontSize: '2.5rem',
            fontWeight: '700'
          }}>
            📄 Extractor de Facturas
          </h1>
          <p style={{ 
            margin: 0,
            fontSize: '1.1rem',
            opacity: 0.9
          }}>
            Sube tu PDF y extrae todos los productos automáticamente
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '40px' }}>
          {/* Upload Form */}
          <form onSubmit={handleSubmit} style={{ marginBottom: '40px' }}>
            <div style={{
              border: '3px dashed #667eea',
              borderRadius: '15px',
              padding: '40px',
              textAlign: 'center',
              background: '#f8f9ff',
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
                  color: '#667eea',
                  fontWeight: '600',
                  marginBottom: '10px'
                }}>
                  {file ? file.name : 'Selecciona un archivo PDF'}
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  color: '#666'
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
                background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                cursor: loading || !file ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                boxShadow: loading || !file ? 'none' : '0 4px 15px rgba(102, 126, 234, 0.4)'
              }}
            >
              {loading ? '⏳ Procesando...' : '🚀 Extraer Datos'}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div style={{ 
              padding: '20px',
              background: '#fee',
              border: '2px solid #fcc',
              borderRadius: '12px',
              marginBottom: '30px',
              color: '#c33'
            }}>
              <strong>❌ Error:</strong> {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div>
              {/* Summary Card */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '30px',
                borderRadius: '15px',
                marginBottom: '30px',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                gap: '20px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>
                    {result.productos.length}
                  </div>
                  <div style={{ fontSize: '1rem', opacity: 0.9 }}>
                    Productos
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>
                    ${result.total_general}
                  </div>
                  <div style={{ fontSize: '1rem', opacity: 0.9 }}>
                    Total General
                  </div>
                </div>
              </div>

              {/* Products Table */}
              <div style={{
                overflowX: 'auto',
                borderRadius: '15px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
              }}>
                <table style={{ 
                  width: '100%',
                  borderCollapse: 'collapse',
                  background: 'white'
                }}>
                  <thead>
                    <tr style={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white'
                    }}>
                      <th style={{ 
                        padding: '18px',
                        textAlign: 'left',
                        fontWeight: '600',
                        fontSize: '1rem'
                      }}>
                        Descripción
                      </th>
                      <th style={{ 
                        padding: '18px',
                        textAlign: 'right',
                        fontWeight: '600',
                        fontSize: '1rem'
                      }}>
                        Cantidad
                      </th>
                      <th style={{ 
                        padding: '18px',
                        textAlign: 'right',
                        fontWeight: '600',
                        fontSize: '1rem'
                      }}>
                        Precio
                      </th>
                      <th style={{ 
                        padding: '18px',
                        textAlign: 'right',
                        fontWeight: '600',
                        fontSize: '1rem'
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
                          borderBottom: '1px solid #eee',
                          background: idx % 2 === 0 ? '#fafafa' : 'white',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0ff'}
                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#fafafa' : 'white'}
                      >
                        <td style={{ 
                          padding: '16px',
                          fontSize: '0.95rem'
                        }}>
                          {prod.descripcion}
                        </td>
                        <td style={{ 
                          padding: '16px',
                          textAlign: 'right',
                          fontWeight: '500',
                          fontSize: '0.95rem'
                        }}>
                          {prod.cantidad}
                        </td>
                        <td style={{ 
                          padding: '16px',
                          textAlign: 'right',
                          fontWeight: '500',
                          fontSize: '0.95rem'
                        }}>
                          ${prod.precio}
                        </td>
                        <td style={{ 
                          padding: '16px',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: '#667eea',
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
