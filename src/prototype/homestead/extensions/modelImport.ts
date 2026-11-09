// Mirrors Platform utils/blobFilename.ts and ModelFolderField.vue.
export function isModelFilename(name: string) {
  return (
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(name) &&
    !name.includes('..') &&
    /\.[A-Za-z0-9]+$/.test(name)
  )
}
export function isModelDirectory(path: string) {
  if (!path || path.length > 255 || /[\r\n\u2028\u2029]/.test(path))
    return false
  const segments = path.split('/')
  return (
    !['configs', 'custom_nodes'].includes(segments[0].toLowerCase()) &&
    segments.every(
      (segment) =>
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(segment) &&
        !segment.endsWith('.') &&
        !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(segment.split('.')[0])
    )
  )
}
export function modelImportUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== 'https:' || !parsed.host) return null
    if (parsed.hostname === 'huggingface.co') {
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (parts.length < 5 || !['resolve', 'blob'].includes(parts[2]))
        return null
      if (parts[2] === 'blob') parts[2] = 'resolve'
      parsed.pathname = '/' + parts.join('/')
    }
    return parsed.href
  } catch {
    return null
  }
}
export function importFilename(value: string) {
  try {
    const name = decodeURIComponent(
      new URL(value.trim()).pathname.split('/').at(-1) ?? ''
    )
    return isModelFilename(name) ? name : ''
  } catch {
    return ''
  }
}
export interface ModelImportInput {
  mode: 'file' | 'url'
  filename: string
  directory: string
  url: string
  file: File | null
}
