import { sanitizeDiagnosticData, sanitizeErrorMessage } from './sanitization'
import { addError } from './storage'
import type { CaptureErrorOptions, ErrorCategory, ErrorLogEntry } from './types'

/**
 * Check if an error is an authentication error (normal user flow, not a bug)
 */
export function isAuthError(error: Error | unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error)
  return (
    errorMessage.includes('Please log in to Mountaineers.org') ||
    errorMessage.includes('Unable to locate') ||
    errorMessage.includes('My Activities') ||
    errorMessage.includes('401') ||
    errorMessage.includes('Unauthorized')
  )
}

class ErrorReporter {
  private static instance: ErrorReporter | null = null
  private capturing = false // Prevent infinite loops

  private constructor() {}

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  /**
   * Capture and store an error with sanitized diagnostic data
   */
  async captureError(error: Error | unknown, options: CaptureErrorOptions): Promise<string> {
    // Prevent infinite loops if error reporting itself causes errors
    if (this.capturing) {
      console.warn('ErrorReporter: already capturing an error, skipping to prevent loop')
      return 'skipped-loop-prevention'
    }

    this.capturing = true
    try {
      return await this.captureErrorInternal(error, options)
    } finally {
      this.capturing = false
    }
  }

  private async captureErrorInternal(
    error: Error | unknown,
    options: CaptureErrorOptions
  ): Promise<string> {
    const errorId = this.generateErrorId()
    const timestamp = Date.now()

    // Extract error message and stack
    let message = 'Unknown error'
    let stack: string | null = null

    if (error instanceof Error) {
      message = error.message
      stack = error.stack || null
    } else if (typeof error === 'string') {
      message = error
    } else if (error && typeof error === 'object') {
      message = JSON.stringify(error)
    }

    // Sanitize error message and stack
    const sanitizedMessage = sanitizeErrorMessage(message)
    const sanitizedStack = stack ? this.sanitizeStack(stack) : null

    // Auto-categorize if not provided
    const category = options.category || this.categorizeError(error, message)

    // Get environment information
    const version = this.getExtensionVersion()
    const browser = this.getBrowserInfo()
    const os = this.getOSInfo()

    // Sanitize diagnostic data
    const sanitizedDiagnostics = options.diagnostics
      ? sanitizeDiagnosticData(options.diagnostics)
      : {}

    const errorEntry: ErrorLogEntry = {
      id: errorId,
      timestamp,
      message: sanitizedMessage,
      stack: sanitizedStack,
      context: options.context,
      category,
      version,
      browser,
      os,
      diagnostics: sanitizedDiagnostics as Record<string, unknown>,
      reported: false,
      dismissed: false,
      occurrenceCount: 1,
    }

    // Store error (wrapped in try-catch to prevent infinite loops)
    try {
      await addError(errorEntry)
    } catch (storageError) {
      console.error('ErrorReporter: failed to store error', storageError)
      // Don't rethrow - we don't want error reporting to break the app
    }

    // Notify UI contexts (insights, preferences) about new error
    try {
      this.notifyUIContexts(errorId)
    } catch (notifyError) {
      console.error('ErrorReporter: failed to notify UI contexts', notifyError)
      // Don't rethrow
    }

    return errorId
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Categorize error based on type and message
   */
  private categorizeError(error: unknown, message: string): ErrorCategory {
    // Network errors
    if (error instanceof TypeError && (message.includes('fetch') || message.includes('network'))) {
      return 'network'
    }

    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('HTTP')
    ) {
      return 'network'
    }

    // Parsing errors
    if (error instanceof SyntaxError || message.includes('JSON.parse')) {
      return 'parsing'
    }

    if (
      message.includes('Unexpected token') ||
      message.includes('parse') ||
      message.includes('Invalid JSON')
    ) {
      return 'parsing'
    }

    // Default to crash
    return 'crash'
  }

  /**
   * Sanitize stack trace by removing PII
   */
  private sanitizeStack(stack: string): string {
    let sanitized = stack

    // Sanitize any quoted strings in stack traces (likely activity titles)
    sanitized = sanitized.replace(/"[^"]+"/g, '"[redacted]"')

    // Sanitize member URLs in stack traces
    sanitized = sanitized.replace(/\/members\/[a-z0-9-]+/g, '/members/[redacted]')

    return sanitized
  }

  /**
   * Get extension version from manifest
   */
  private getExtensionVersion(): string {
    try {
      return chrome?.runtime?.getManifest?.()?.version ?? 'unknown'
    } catch {
      return 'unknown'
    }
  }

  /**
   * Get browser information
   */
  private getBrowserInfo(): string {
    try {
      const userAgent = navigator?.userAgent ?? ''
      const match = userAgent.match(/Chrome\/(\d+)/)
      return match ? `Chrome ${match[1]}` : 'Unknown Browser'
    } catch {
      return 'Unknown Browser'
    }
  }

  /**
   * Get OS information
   */
  private getOSInfo(): string {
    try {
      const platform = (navigator?.platform ?? '').toLowerCase()

      if (platform.includes('mac')) return 'darwin'
      if (platform.includes('win')) return 'win32'
      if (platform.includes('linux')) return 'linux'

      return platform || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  /**
   * Notify UI contexts about new error
   */
  private notifyUIContexts(errorId: string): void {
    // Send message to all contexts (insights, preferences pages)
    // UI pages will listen for this and show toast
    try {
      chrome?.runtime
        ?.sendMessage({
          type: 'error-logged',
          errorId,
        })
        .catch(() => {
          // Ignore errors if no UI is open
        })
    } catch {
      // Ignore if chrome.runtime not available
    }
  }
}

// Export singleton instance
export const errorReporter = ErrorReporter.getInstance()
