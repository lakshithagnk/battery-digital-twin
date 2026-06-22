export function numberFmt(value, digits = 2, fallback = '—') {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return number.toFixed(digits)
}

export function percentFmt(value, digits = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const percent = Math.abs(number) <= 1 ? number * 100 : number
  return `${percent.toFixed(digits)}%`
}

export function timeFmt(seconds) {
  const value = Number(seconds) || 0
  const h = Math.floor(value / 3600)
  const m = Math.floor((value % 3600) / 60)
  const s = Math.floor(value % 60)
  if (h) return `${h}h ${m}m ${s}s`
  if (m) return `${m}m ${s}s`
  return `${s}s`
}

export function dateTimeFmt(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export function shortTime(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString()
}

export function fileSizeFmt(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function safeJson(value) {
  return JSON.stringify(value, null, 2)
}
