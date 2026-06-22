import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { DATASET_COLUMNS } from '../config/schema'

function normalizeDatasetRow(row, index = 0) {
  return {
    ...(row || {}),
    __id: crypto.randomUUID?.() ?? `${Date.now()}-${index}`,
    __index: index
  }
}

export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: ({ data, meta }) => {
        const rows = data.map((row, index) => normalizeDatasetRow(row, index))
        resolve({ rows, columns: meta.fields?.length ? meta.fields : DATASET_COLUMNS })
      },
      error: reject
    })
  })
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = event => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'array', cellDates: false })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
        const rows = data.map((row, index) => normalizeDatasetRow(row, index))
        const columns = data[0] ? Object.keys(data[0]) : DATASET_COLUMNS
        resolve({ rows, columns, sheetName: workbook.SheetNames[0] })
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export async function parseBatteryFile(file) {
  const lower = file.name.toLowerCase()
  const parsed = lower.endsWith('.xlsx') || lower.endsWith('.xls')
    ? await parseExcelFile(file)
    : await parseCsvFile(file)

  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: file.name.replace(/\.(csv|xlsx|xls)$/i, ''),
    rows: parsed.rows,
    columns: parsed.columns,
    originalColumns: parsed.columns,
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: lower.endsWith('.csv') ? 'csv' : 'excel',
    size: file.size,
    sheetName: parsed.sheetName ?? null
  }
}

export function exportRowsCsv(rows, columns = DATASET_COLUMNS) {
  return Papa.unparse(rows.map(row => {
    const obj = {}
    columns.forEach(column => { obj[column] = row[column] ?? '' })
    return obj
  }))
}
