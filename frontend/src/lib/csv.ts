export type CsvCell = string | number | null | undefined

// A spreadsheet treats a cell starting with = + - @ (or a tab/return) as a
// formula. Some text in the ledger comes from outside (customer company names
// typed at signup), so neutralise those cells before they reach Excel.
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''

  let text = value
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

/**
 * Downloads rows as a CSV file. A byte-order mark is added so Excel reads
 * accents and symbols correctly; Google Sheets and LibreOffice open it too.
 */
export function downloadCsv(filename: string, rows: CsvCell[][]) {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
