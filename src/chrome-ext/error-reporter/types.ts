export type ErrorContext = 'background' | 'offscreen' | 'insights' | 'preferences'

export type ErrorCategory = 'network' | 'parsing' | 'crash' | 'ui-render' | 'unknown'

export interface ErrorLogEntry {
  id: string
  timestamp: number
  message: string
  stack: string | null
  context: ErrorContext
  category: ErrorCategory
  version: string
  browser: string
  os: string
  diagnostics: Record<string, unknown>
  reported: boolean
  reportedAt?: number
  dismissed: boolean
  occurrenceCount: number
}

export interface ErrorStorage {
  errors: ErrorLogEntry[]
  version: 1
}

export interface CaptureErrorOptions {
  context: ErrorContext
  category?: ErrorCategory
  diagnostics?: Record<string, unknown>
}
