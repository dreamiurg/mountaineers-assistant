const personUidMap = new Map<string, string>()
let personCounter = 0

function getAnonymousPersonId(uid: string): string {
  if (!personUidMap.has(uid)) {
    personCounter++
    personUidMap.set(uid, `person_${String(personCounter).padStart(3, '0')}`)
  }
  return personUidMap.get(uid)!
}

function sanitizeUrl(url: string): string {
  if (!url) return url

  // Sanitize member URLs
  return url.replace(/\/members\/[^/]+/, '/members/[redacted]')
}

export function sanitizeErrorMessage(message: string): string {
  let sanitized = message

  // Redact quoted strings (likely activity titles)
  sanitized = sanitized.replace(/"[^"]+"/g, '"[redacted]"')

  // Redact member slugs
  sanitized = sanitized.replace(/\/members\/[a-z0-9-]+/g, '/members/[redacted]')

  // Redact slug-like identifiers (lowercase with hyphens)
  sanitized = sanitized.replace(/\b[a-z]+-[a-z-]+\b/g, '[redacted]')

  return sanitized
}

export function sanitizeDiagnosticData(data: unknown): unknown {
  // Reset counter for each sanitization call
  personUidMap.clear()
  personCounter = 0

  return sanitizeRecursive(data)
}

function sanitizeRecursive(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeRecursive(item))
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      // Check if field name contains sensitive keywords using pattern matching
      const isTitleField = key === 'title' || key.toLowerCase().includes('title')
      const isNameField = key === 'name' || /name/i.test(key)
      const isSlugField = key === 'slug' || key.toLowerCase().includes('slug')
      const isUrlField = key === 'href' || key === 'url' || /url|link/i.test(key)

      if (isTitleField) {
        sanitized[key] = '[Activity Title Redacted]'
      } else if (isNameField) {
        sanitized[key] = '[Name Redacted]'
      } else if (isSlugField && typeof value === 'string') {
        // Treat slug fields like person UIDs - anonymize them
        sanitized[key] = getAnonymousPersonId(value)
      } else if (key === 'uid' && typeof value === 'string' && !value.startsWith('act-')) {
        sanitized[key] = getAnonymousPersonId(value)
      } else if (isUrlField && typeof value === 'string') {
        sanitized[key] = sanitizeUrl(value)
      } else if (key === 'error' && typeof value === 'string') {
        // Sanitize error messages that may contain PII
        sanitized[key] = sanitizeErrorMessage(value)
      } else if (key === 'avatar') {
        sanitized[key] = null
      } else {
        sanitized[key] = sanitizeRecursive(value)
      }
    }
    return sanitized
  }

  return data
}
