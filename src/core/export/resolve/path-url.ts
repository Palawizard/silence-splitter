function encodePathPart(part: string): string {
  return encodeURIComponent(part)
}

/** Convert an absolute Windows, UNC, or POSIX path to an RFC-compatible file URL. */
export function filePathToUrl(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/')

  if (normalized.startsWith('//')) {
    const [host, ...parts] = normalized.slice(2).split('/')
    if (!host || parts.length === 0) {
      throw new Error(`Invalid UNC media path: ${filePath}`)
    }
    return `file://${host}/${parts.map(encodePathPart).join('/')}`
  }

  if (/^[A-Za-z]:\//.test(normalized)) {
    const drive = normalized.slice(0, 2)
    const parts = normalized.slice(3).split('/').map(encodePathPart)
    return `file:///${drive}/${parts.join('/')}`
  }

  if (normalized.startsWith('/')) {
    return `file:///${normalized.slice(1).split('/').map(encodePathPart).join('/')}`
  }

  throw new Error(`Media path must be absolute: ${filePath}`)
}
