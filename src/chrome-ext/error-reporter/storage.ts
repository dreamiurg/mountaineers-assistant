import type { ErrorLogEntry, ErrorStorage } from './types'

const STORAGE_KEY = 'mountaineersAssistantErrors'
const MAX_ERRORS = 50
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const DEDUP_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Load error log from chrome.storage.local
 */
export async function loadErrorLog(): Promise<ErrorLogEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const storage = result[STORAGE_KEY] as ErrorStorage | undefined

  if (!storage || !storage.errors) {
    return []
  }

  // Clean up old errors
  const now = Date.now()
  const cleanedErrors = storage.errors.filter((error) => now - error.timestamp < MAX_AGE_MS)

  // If we cleaned any errors, save the cleaned list
  if (cleanedErrors.length !== storage.errors.length) {
    await saveErrorLog(cleanedErrors)
  }

  return cleanedErrors
}

/**
 * Save error log to chrome.storage.local
 */
export async function saveErrorLog(errors: ErrorLogEntry[]): Promise<void> {
  const storage: ErrorStorage = {
    errors,
    version: 1,
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: storage })
}

/**
 * Add error to log with deduplication
 */
export async function addError(error: ErrorLogEntry): Promise<void> {
  const errors = await loadErrorLog()

  // Check for duplicates within the deduplication window
  const now = Date.now()
  const duplicateIndex = errors.findIndex(
    (existing) =>
      existing.message === error.message &&
      existing.stack === error.stack &&
      existing.context === error.context &&
      now - existing.timestamp < DEDUP_WINDOW_MS
  )

  if (duplicateIndex !== -1) {
    // Update existing error
    errors[duplicateIndex].occurrenceCount++
    errors[duplicateIndex].timestamp = now // Update to latest occurrence
  } else {
    // Add new error
    errors.push(error)

    // Enforce max errors limit (remove oldest)
    if (errors.length > MAX_ERRORS) {
      errors.sort((a, b) => a.timestamp - b.timestamp)
      errors.splice(0, errors.length - MAX_ERRORS)
    }
  }

  await saveErrorLog(errors)
}

/**
 * Mark error as reported
 */
export async function markErrorReported(errorId: string): Promise<void> {
  const errors = await loadErrorLog()
  const error = errors.find((e) => e.id === errorId)

  if (error) {
    error.reported = true
    error.reportedAt = Date.now()
    await saveErrorLog(errors)
  }
}

/**
 * Mark error as dismissed
 */
export async function markErrorDismissed(errorId: string): Promise<void> {
  const errors = await loadErrorLog()
  const error = errors.find((e) => e.id === errorId)

  if (error) {
    error.dismissed = true
    await saveErrorLog(errors)
  }
}

/**
 * Get unreported and undismissed errors
 */
export async function getUnreportedErrors(): Promise<ErrorLogEntry[]> {
  const errors = await loadErrorLog()
  return errors.filter((error) => !error.reported && !error.dismissed)
}

/**
 * Clear all errors from storage
 */
export async function clearErrorLog(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}
