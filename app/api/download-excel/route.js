import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(request) {
  try {
    const body = await request.json()
    const { productos, total_general } = body

    console.log('Recibiendo solicitud de Excel con', productos?.length, 'productos')

    if (!productos || productos.length === 0) {
      return NextResponse.json({ error: 'No hay productos para exportar' }, { status: 400 })
    }

    // Crear workbook y worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet([])

    // Encabezados
    XLSX.utils.sheet_add_aoa(worksheet, [[
      '#',
      'Descripción',
      'Cantidad',
      'Precio Unitario',
      'Total Extraído',
      'Cant × Precio',
      'Diferencia',
      'Estado'
    ]], { origin: 'A1' })

    // Agregar productos con fórmulas
    productos.forEach((prod, index) => {
      const rowNum = index + 2 // Fila 2 en adelante (1 es encabezado)
      
      XLSX.utils.sheet_add_aoa(worksheet, [[
        index + 1,
        prod.descripcion || '',
        parseFloat(prod.cantidad) || 0,
        parseFloat(prod.precio) || 0,
        parseFloat(prod.total) || 0
      ]], { origin: `A${rowNum}` })
      
      // Agregar fórmulas
      worksheet[`F${rowNum}`] = { f: `C${rowNum}*D${rowNum}` } // Cant × Precio
      worksheet[`G${rowNum}`] = { f: `ABS(E${rowNum}-F${rowNum})` } // Diferencia
      worksheet[`H${rowNum}`] = { f: `IF(G${rowNum}>0.01,"⚠️ Revisar","✓")` } // Estado
    })

    // Fila de totales
    const totalRow = productos.length + 2
    XLSX.utils.sheet_add_aoa(worksheet, [[
      '',
      'TOTAL GENERAL',
      '',
      ''
    ]], { origin: `A${totalRow}` })
    
    // Fórmulas para totales
    worksheet[`E${totalRow}`] = { f: `SUM(E2:E${totalRow - 1})` } // Total Extraído
    worksheet[`F${totalRow}`] = { f: `SUM(F2:F${totalRow - 1})` } // Cant × Precio
    worksheet[`G${totalRow}`] = { f: `ABS(E${totalRow}-F${totalRow})` } // Diferencia
    worksheet[`H${totalRow}`] = { f: `IF(G${totalRow}>0.01,"⚠️ Revisar","✓")` } // Estado

    // Ajustar ancho de columnas
    worksheet['!cols'] = [
      { wch: 5 },   // #
      { wch: 50 },  // Descripción
      { wch: 12 },  // Cantidad
      { wch: 15 },  // Precio Unitario
      { wch: 15 },  // Total Extraído
      { wch: 15 },  // Cant × Precio
      { wch: 12 },  // Diferencia
      { wch: 12 }   // Estado
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos')

    // Generar buffer del archivo Excel
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      cellFormula: true // Importante: mantener las fórmulas
    })

    console.log('Excel generado, tamaño:', excelBuffer.length, 'bytes')

    // Retornar el archivo con headers correctos
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="factura_${Date.now()}.xlsx"`,
        'Content-Length': excelBuffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Error generando Excel:', error)
    return NextResponse.json({ 
      error: 'Error al generar archivo Excel',
      details: error.message 
    }, { status: 500 })
  }
}
