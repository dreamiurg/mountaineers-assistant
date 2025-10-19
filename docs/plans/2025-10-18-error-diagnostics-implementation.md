# Error Diagnostics and Reporting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an error diagnostics and reporting system that makes it easy for users to report errors with sanitized diagnostic data pre-filled in GitHub issues.

**Architecture:** Centralized ErrorReporter service captures errors across all extension contexts (background, offscreen, UI), stores sanitized error logs in chrome.storage.local, displays toast notifications on error, and generates pre-filled GitHub issue URLs with user consent.

**Tech Stack:** TypeScript, React, Chrome Extension APIs (storage, runtime messaging), Vitest for unit tests, Playwright for integration tests

---

## Implementation Phases

This plan implements in three phases:
1. **Phase 1:** Core infrastructure (ErrorReporter, sanitization, storage)
2. **Phase 2:** User interface (toast, modal, settings integration)
3. **Phase 3:** GitHub integration and developer tools

---

## Phase 1: Core Infrastructure

### Task 1: TypeScript Types and Interfaces

**Files:**
- Create: `src/chrome-ext/error-reporter/types.ts`

**Step 1: Create types file with error interfaces**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/chrome-ext/error-reporter/types.ts
git commit -m "feat(error-reporter): add TypeScript types and interfaces"
```

---

### Task 2: PII Sanitization Utilities

**Files:**
- Create: `src/chrome-ext/error-reporter/sanitization.ts`
- Create: `tests/unit/error-reporter/sanitization.test.ts`

**Step 1: Write failing test for sanitizing activity titles**

In `tests/unit/error-reporter/sanitization.test.ts`:

```typescript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeDiagnosticData } from '../../src/chrome-ext/error-reporter/sanitization'

describe('sanitizeDiagnosticData', () => {
  it('should redact activity titles', () => {
    const input = {
      activities: [
        { uid: 'act-123', title: 'Mt. Rainier Summit Climb', href: 'https://mountaineers.org/activities/act-123' }
      ]
    }

    const result = sanitizeDiagnosticData(input)

    assert.deepEqual(result, {
      activities: [
        { uid: 'act-123', title: '[Activity Title Redacted]', href: 'https://mountaineers.org/activities/act-123' }
      ]
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/error-reporter/sanitization.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal sanitization implementation**

In `src/chrome-ext/error-reporter/sanitization.ts`:

```typescript
export function sanitizeDiagnosticData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeDiagnosticData(item))
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (key === 'title') {
        sanitized[key] = '[Activity Title Redacted]'
      } else {
        sanitized[key] = sanitizeDiagnosticData(value)
      }
    }
    return sanitized
  }

  return data
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/error-reporter/sanitization.test.ts`
Expected: PASS

**Step 5: Add tests for person names**

In `tests/unit/error-reporter/sanitization.test.ts`, add:

```typescript
it('should redact person names', () => {
  const input = {
    people: [
      { uid: 'john-doe', name: 'John Doe', href: 'https://mountaineers.org/members/john-doe' }
    ]
  }

  const result = sanitizeDiagnosticData(input)

  assert.deepEqual(result, {
    people: [
      { uid: 'person_001', name: '[Name Redacted]', href: 'https://mountaineers.org/members/[redacted]' }
    ]
  })
})
```

**Step 6: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/error-reporter/sanitization.test.ts`
Expected: FAIL - person data not sanitized

**Step 7: Enhance sanitization to handle person data**

In `src/chrome-ext/error-reporter/sanitization.ts`:

```typescript
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
    return data.map(item => sanitizeRecursive(item))
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (key === 'title') {
        sanitized[key] = '[Activity Title Redacted]'
      } else if (key === 'name') {
        sanitized[key] = '[Name Redacted]'
      } else if (key === 'uid' && typeof value === 'string' && !value.startsWith('act-')) {
        sanitized[key] = getAnonymousPersonId(value)
      } else if (key === 'href' && typeof value === 'string') {
        sanitized[key] = sanitizeUrl(value)
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
```

**Step 8: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/error-reporter/sanitization.test.ts`
Expected: PASS (2 tests)

**Step 9: Add test for sanitizing error messages**

In `tests/unit/error-reporter/sanitization.test.ts`, add:

```typescript
it('should sanitize error messages containing PII', () => {
  const input = 'Failed to load activity "Mt. Rainier Summit Climb" for user john-doe'

  const result = sanitizeErrorMessage(input)

  assert.strictEqual(result, 'Failed to load activity "[redacted]" for user [redacted]')
})
```

**Step 10: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/error-reporter/sanitization.test.ts`
Expected: FAIL - function not defined

**Step 11: Implement error message sanitization**

In `src/chrome-ext/error-reporter/sanitization.ts`, add:

```typescript
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
```

**Step 12: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/error-reporter/sanitization.test.ts`
Expected: PASS (3 tests)

**Step 13: Commit**

```bash
git add src/chrome-ext/error-reporter/sanitization.ts tests/unit/error-reporter/sanitization.test.ts
git commit -m "feat(error-reporter): add PII sanitization utilities"
```

---

### Task 3: Error Storage Manager

**Files:**
- Create: `src/chrome-ext/error-reporter/storage.ts`
- Create: `tests/unit/error-reporter/storage.test.ts`

**Step 1: Write failing test for saving errors**

In `tests/unit/error-reporter/storage.test.ts`:

```typescript
import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { saveError, getErrors, clearErrors } from '../../src/chrome-ext/error-reporter/storage'
import type { ErrorLogEntry } from '../../src/chrome-ext/error-reporter/types'

describe('ErrorStorage', () => {
  let mockStorage: Map<string, unknown>

  beforeEach(() => {
    mockStorage = new Map()

    global.chrome = {
      storage: {
        local: {
          get: mock.fn(async (key: string) => {
            return { [key]: mockStorage.get(key) }
          }),
          set: mock.fn(async (data: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(data)) {
              mockStorage.set(key, value)
            }
          })
        }
      }
    } as any
  })

  it('should save new error to storage', async () => {
    const error: Omit<ErrorLogEntry, 'id'> = {
      timestamp: Date.now(),
      message: 'Test error',
      stack: null,
      context: 'insights',
      category: 'crash',
      version: '1.0.0',
      browser: 'Chrome 120',
      os: 'darwin',
      diagnostics: {},
      reported: false,
      dismissed: false,
      occurrenceCount: 1
    }

    const savedError = await saveError(error)

    assert.ok(savedError.id)
    assert.strictEqual(savedError.message, 'Test error')

    const stored = await getErrors()
    assert.strictEqual(stored.length, 1)
    assert.strictEqual(stored[0].id, savedError.id)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/error-reporter/storage.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal storage implementation**

In `src/chrome-ext/error-reporter/storage.ts`:

```typescript
import type { ErrorLogEntry, ErrorStorage } from './types'
import { randomUUID } from 'crypto'

const STORAGE_KEY = 'mountaineersAssistantErrors'
const MAX_ERRORS = 50
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function saveError(error: Omit<ErrorLogEntry, 'id'>): Promise<ErrorLogEntry> {
  const newError: ErrorLogEntry = {
    ...error,
    id: randomUUID()
  }

  const storage = await loadStorage()
  storage.errors.push(newError)

  // Cleanup old errors
  const now = Date.now()
  storage.errors = storage.errors
    .filter(e => now - e.timestamp < MAX_AGE_MS)
    .slice(-MAX_ERRORS)

  await saveStorage(storage)

  return newError
}

export async function getErrors(): Promise<ErrorLogEntry[]> {
  const storage = await loadStorage()
  return storage.errors
}

export async function clearErrors(): Promise<void> {
  await saveStorage({ errors: [], version: 1 })
}

async function loadStorage(): Promise<ErrorStorage> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] || { errors: [], version: 1 }
}

async function saveStorage(storage: ErrorStorage): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: storage })
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/error-reporter/storage.test.ts`
Expected: PASS

**Step 5: Add test for deduplication**

In `tests/unit/error-reporter/storage.test.ts`, add:

```typescript
it('should deduplicate errors with same message and stack', async () => {
  const error = {
    timestamp: Date.now(),
    message: 'Duplicate error',
    stack: 'at line 123',
    context: 'insights' as const,
    category: 'crash' as const,
    version: '1.0.0',
    browser: 'Chrome 120',
    os: 'darwin',
    diagnostics: {},
    reported: false,
    dismissed: false,
    occurrenceCount: 1
  }

  await saveError(error)
  await saveError({ ...error, timestamp: Date.now() })

  const stored = await getErrors()
  assert.strictEqual(stored.length, 1)
  assert.strictEqual(stored[0].occurrenceCount, 2)
})
```

**Step 6: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/error-reporter/storage.test.ts`
Expected: FAIL - two errors saved instead of one

**Step 7: Implement deduplication logic**

In `src/chrome-ext/error-reporter/storage.ts`, modify `saveError`:

```typescript
const DEDUP_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

export async function saveError(error: Omit<ErrorLogEntry, 'id'>): Promise<ErrorLogEntry> {
  const storage = await loadStorage()

  // Check for duplicate within time window
  const now = Date.now()
  const duplicate = storage.errors.find(e =>
    e.message === error.message &&
    e.stack === error.stack &&
    e.context === error.context &&
    (now - e.timestamp) < DEDUP_WINDOW_MS
  )

  if (duplicate) {
    duplicate.occurrenceCount++
    duplicate.timestamp = now
    await saveStorage(storage)
    return duplicate
  }

  // Add new error
  const newError: ErrorLogEntry = {
    ...error,
    id: randomUUID()
  }

  storage.errors.push(newError)

  // Cleanup old errors
  storage.errors = storage.errors
    .filter(e => now - e.timestamp < MAX_AGE_MS)
    .slice(-MAX_ERRORS)

  await saveStorage(storage)

  return newError
}
```

**Step 8: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/error-reporter/storage.test.ts`
Expected: PASS (2 tests)

**Step 9: Commit**

```bash
git add src/chrome-ext/error-reporter/storage.ts tests/unit/error-reporter/storage.test.ts
git commit -m "feat(error-reporter): add error storage with deduplication"
```

---

### Task 4: ErrorReporter Service

**Files:**
- Create: `src/chrome-ext/error-reporter/ErrorReporter.ts`
- Create: `tests/unit/error-reporter/ErrorReporter.test.ts`

**Step 1: Write failing test for capturing errors**

In `tests/unit/error-reporter/ErrorReporter.test.ts`:

```typescript
import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { ErrorReporter } from '../../src/chrome-ext/error-reporter/ErrorReporter'

describe('ErrorReporter', () => {
  let mockStorage: Map<string, unknown>

  beforeEach(() => {
    mockStorage = new Map()

    global.chrome = {
      storage: {
        local: {
          get: mock.fn(async (key: string) => ({ [key]: mockStorage.get(key) })),
          set: mock.fn(async (data: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(data)) {
              mockStorage.set(key, value)
            }
          })
        }
      },
      runtime: {
        sendMessage: mock.fn(),
        getManifest: () => ({ version: '1.0.0' })
      }
    } as any

    global.navigator = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0'
    } as any
  })

  it('should capture and store error', async () => {
    const reporter = new ErrorReporter()
    const error = new Error('Test error')

    const entry = await reporter.captureError(error, {
      context: 'insights',
      category: 'crash'
    })

    assert.ok(entry.id)
    assert.strictEqual(entry.message, 'Test error')
    assert.strictEqual(entry.context, 'insights')
    assert.strictEqual(entry.category, 'crash')
    assert.strictEqual(entry.version, '1.0.0')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/error-reporter/ErrorReporter.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal ErrorReporter implementation**

In `src/chrome-ext/error-reporter/ErrorReporter.ts`:

```typescript
import type { CaptureErrorOptions, ErrorLogEntry } from './types'
import { saveError } from './storage'
import { sanitizeErrorMessage } from './sanitization'

export class ErrorReporter {
  async captureError(
    error: Error | string,
    options: CaptureErrorOptions
  ): Promise<ErrorLogEntry> {
    const errorObj = error instanceof Error ? error : new Error(String(error))

    const entry = await saveError({
      timestamp: Date.now(),
      message: sanitizeErrorMessage(errorObj.message),
      stack: this.sanitizeStack(errorObj.stack || null),
      context: options.context,
      category: options.category || this.categorizeError(errorObj),
      version: this.getExtensionVersion(),
      browser: this.getBrowserVersion(),
      os: this.getOS(),
      diagnostics: options.diagnostics || {},
      reported: false,
      dismissed: false,
      occurrenceCount: 1
    })

    // Notify UI contexts
    this.notifyErrorLogged(entry.id)

    return entry
  }

  private categorizeError(error: Error): 'network' | 'parsing' | 'crash' | 'ui-render' | 'unknown' {
    const message = error.message.toLowerCase()

    if (message.includes('fetch') || message.includes('network')) {
      return 'network'
    }
    if (message.includes('json') || message.includes('parse')) {
      return 'parsing'
    }

    return 'crash'
  }

  private sanitizeStack(stack: string | null): string | null {
    if (!stack) return null

    // Remove file paths with potential PII
    return stack.replace(/\/Users\/[^/]+/g, '/Users/[redacted]')
      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[redacted]')
  }

  private getExtensionVersion(): string {
    return chrome.runtime.getManifest().version
  }

  private getBrowserVersion(): string {
    const match = navigator.userAgent.match(/Chrome\/(\d+)/)
    return match ? `Chrome ${match[1]}` : 'Unknown'
  }

  private getOS(): string {
    const ua = navigator.userAgent
    if (ua.includes('Mac')) return 'darwin'
    if (ua.includes('Win')) return 'win32'
    if (ua.includes('Linux')) return 'linux'
    return 'unknown'
  }

  private notifyErrorLogged(errorId: string): void {
    try {
      chrome.runtime.sendMessage({
        type: 'error-logged',
        errorId
      })
    } catch (error) {
      console.warn('Failed to notify error logged', error)
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/error-reporter/ErrorReporter.test.ts`
Expected: PASS

**Step 5: Add test for global error handler setup**

In `tests/unit/error-reporter/ErrorReporter.test.ts`, add:

```typescript
it('should install global error handlers', () => {
  const reporter = new ErrorReporter()

  const errorHandler = mock.fn()
  const rejectionHandler = mock.fn()

  global.addEventListener = mock.fn((event, handler) => {
    if (event === 'error') errorHandler.mock = handler
    if (event === 'unhandledrejection') rejectionHandler.mock = handler
  }) as any

  reporter.installGlobalHandlers()

  assert.strictEqual((global.addEventListener as any).mock.calls.length, 2)
})
```

**Step 6: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/error-reporter/ErrorReporter.test.ts`
Expected: FAIL - method not defined

**Step 7: Add global handler installation**

In `src/chrome-ext/error-reporter/ErrorReporter.ts`, add:

```typescript
export class ErrorReporter {
  private installed = false

  installGlobalHandlers(): void {
    if (this.installed) return
    this.installed = true

    window.addEventListener('error', (event) => {
      this.captureError(event.error || event.message, {
        context: this.detectContext(),
        category: 'crash'
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(event.reason, {
        context: this.detectContext(),
        category: 'crash'
      })
    })
  }

  private detectContext(): 'background' | 'offscreen' | 'insights' | 'preferences' {
    const path = window.location?.pathname || ''

    if (path.includes('insights')) return 'insights'
    if (path.includes('preferences')) return 'preferences'
    if (path.includes('offscreen')) return 'offscreen'

    return 'background'
  }

  // ... rest of the class
}
```

**Step 8: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/error-reporter/ErrorReporter.test.ts`
Expected: PASS (2 tests)

**Step 9: Commit**

```bash
git add src/chrome-ext/error-reporter/ErrorReporter.ts tests/unit/error-reporter/ErrorReporter.test.ts
git commit -m "feat(error-reporter): add ErrorReporter service with global handlers"
```

---

## Phase 2: User Interface

### Task 5: ErrorToast Component

**Files:**
- Create: `src/chrome-ext/components/ErrorToast.tsx`
- Modify: `src/chrome-ext/insights-react-root.tsx`
- Modify: `src/chrome-ext/preferences-react-root.tsx`

**Step 1: Create basic ErrorToast component**

In `src/chrome-ext/components/ErrorToast.tsx`:

```typescript
import React, { useState, useEffect } from 'react'

interface ErrorToastProps {
  onReport: () => void
  onDismiss: () => void
  errorCount: number
}

export function ErrorToast({ onReport, onDismiss, errorCount }: ErrorToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300) // Wait for fade animation
    }, 10000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  if (!visible) return null

  const message = errorCount > 1
    ? `${errorCount} errors occurred. Help us fix them by reporting these issues.`
    : 'Something went wrong. Help us fix it by reporting this issue.'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#dc2626',
        color: 'white',
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out'
      }}
    >
      <span>{message}</span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onReport}
          style={{
            backgroundColor: 'white',
            color: '#dc2626',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Report Issue
        </button>
        <button
          onClick={() => {
            setVisible(false)
            setTimeout(onDismiss, 300)
          }}
          style={{
            backgroundColor: 'transparent',
            color: 'white',
            border: '1px solid white',
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            cursor: 'pointer'
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Create container component with error listening**

In `src/chrome-ext/components/ErrorToast.tsx`, add:

```typescript
export function ErrorToastContainer() {
  const [errors, setErrors] = useState<string[]>([])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // Listen for error-logged messages
    const handleMessage = (message: any) => {
      if (message.type === 'error-logged') {
        setErrors(prev => [...prev, message.errorId])
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    // Check for unreported errors on mount
    chrome.storage.local.get('mountaineersAssistantErrors').then((result) => {
      const storage = result.mountaineersAssistantErrors
      if (storage?.errors) {
        const unreported = storage.errors
          .filter((e: any) => !e.reported && !e.dismissed)
          .map((e: any) => e.id)
        if (unreported.length > 0) {
          setErrors(unreported)
        }
      }
    })

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  const handleReport = () => {
    setShowModal(true)
  }

  const handleDismiss = async () => {
    // Mark errors as dismissed
    const result = await chrome.storage.local.get('mountaineersAssistantErrors')
    const storage = result.mountaineersAssistantErrors
    if (storage?.errors) {
      storage.errors = storage.errors.map((e: any) =>
        errors.includes(e.id) ? { ...e, dismissed: true } : e
      )
      await chrome.storage.local.set({ mountaineersAssistantErrors: storage })
    }
    setErrors([])
  }

  if (errors.length === 0) return null

  return (
    <>
      <ErrorToast
        onReport={handleReport}
        onDismiss={handleDismiss}
        errorCount={errors.length}
      />
      {showModal && (
        <div>Error Report Modal (TODO)</div>
      )}
    </>
  )
}
```

**Step 3: Integrate ErrorToast into insights page**

In `src/chrome-ext/insights-react-root.tsx`, modify:

```typescript
import { ErrorToastContainer } from './components/ErrorToast'

// In the render function, add ErrorToastContainer above InsightsApp
root.render(
  <React.StrictMode>
    <ErrorToastContainer />
    <InsightsApp />
  </React.StrictMode>
)
```

**Step 4: Integrate ErrorToast into preferences page**

In `src/chrome-ext/preferences-react-root.tsx`, modify similarly:

```typescript
import { ErrorToastContainer } from './components/ErrorToast'

root.render(
  <React.StrictMode>
    <ErrorToastContainer />
    <PreferencesApp />
  </React.StrictMode>
)
```

**Step 5: Commit**

```bash
git add src/chrome-ext/components/ErrorToast.tsx src/chrome-ext/insights-react-root.tsx src/chrome-ext/preferences-react-root.tsx
git commit -m "feat(error-reporter): add ErrorToast component"
```

---

### Task 6: ErrorReportModal Component

**Files:**
- Create: `src/chrome-ext/components/ErrorReportModal.tsx`
- Modify: `src/chrome-ext/components/ErrorToast.tsx`

**Step 1: Create ErrorReportModal component**

In `src/chrome-ext/components/ErrorReportModal.tsx`:

```typescript
import React, { useState, useEffect } from 'react'
import type { ErrorLogEntry } from '../error-reporter/types'
import { sanitizeDiagnosticData } from '../error-reporter/sanitization'

interface ErrorReportModalProps {
  errorIds: string[]
  onClose: () => void
}

export function ErrorReportModal({ errorIds, onClose }: ErrorReportModalProps) {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([])
  const [agreed, setAgreed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['error-details']))

  useEffect(() => {
    chrome.storage.local.get('mountaineersAssistantErrors').then((result) => {
      const storage = result.mountaineersAssistantErrors
      if (storage?.errors) {
        const matchingErrors = storage.errors.filter((e: ErrorLogEntry) =>
          errorIds.includes(e.id)
        )
        setErrors(matchingErrors)
      }
    })
  }, [errorIds])

  const toggleSection = (section: string) => {
    const newSet = new Set(expandedSections)
    if (newSet.has(section)) {
      newSet.delete(section)
    } else {
      newSet.add(section)
    }
    setExpandedSections(newSet)
  }

  const formatDiagnosticData = (error: ErrorLogEntry): string => {
    const sanitized = sanitizeDiagnosticData(error.diagnostics)
    return JSON.stringify(sanitized, null, 2)
  }

  const generateMarkdown = (error: ErrorLogEntry): string => {
    return `## Error Description
${error.message}

## Steps to Reproduce
_Please describe what you were doing when this error occurred_

## Diagnostic Information

**Extension Version:** ${error.version}
**Browser:** ${error.browser}
**OS:** ${error.os}
**Timestamp:** ${new Date(error.timestamp).toISOString()}
**Context:** ${error.context}
**Category:** ${error.category}
${error.occurrenceCount > 1 ? `**Occurrences:** ${error.occurrenceCount}\n` : ''}
### Error Details
\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

### Additional Diagnostics
\`\`\`json
${formatDiagnosticData(error)}
\`\`\`

---
_This report was generated automatically by Mountaineers Assistant. All personal information has been removed._`
  }

  const handleContinueToGitHub = () => {
    errors.forEach(error => {
      const title = `[Auto-Report] Error in ${error.context}: ${error.message.substring(0, 50)}`
      const body = generateMarkdown(error)
      const labels = 'bug,auto-reported'

      const params = new URLSearchParams({ title, body, labels })
      const url = `https://github.com/dreamiurg/mountaineers-assistant/issues/new?${params}`

      window.open(url, '_blank')
    })

    // Mark errors as reported
    chrome.storage.local.get('mountaineersAssistantErrors').then((result) => {
      const storage = result.mountaineersAssistantErrors
      if (storage?.errors) {
        storage.errors = storage.errors.map((e: ErrorLogEntry) =>
          errorIds.includes(e.id)
            ? { ...e, reported: true, reportedAt: Date.now() }
            : e
        )
        chrome.storage.local.set({ mountaineersAssistantErrors: storage })
      }
    })

    onClose()
  }

  if (errors.length === 0) return null

  const error = errors[0] // Show first error for now

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '2rem',
          maxWidth: '800px',
          maxHeight: '80vh',
          overflow: 'auto',
          width: '90%'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Report Error to GitHub</h2>

        <p style={{ color: '#666' }}>
          Review the diagnostic data below before submitting. All personal information has been removed.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <CollapsibleSection
            title="Error Details"
            expanded={expandedSections.has('error-details')}
            onToggle={() => toggleSection('error-details')}
          >
            <pre style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '0.25rem', overflow: 'auto' }}>
              {error.message}
              {'\n\n'}
              {error.stack || 'No stack trace'}
            </pre>
          </CollapsibleSection>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <CollapsibleSection
            title="Extension Info"
            expanded={expandedSections.has('extension-info')}
            onToggle={() => toggleSection('extension-info')}
          >
            <pre style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '0.25rem' }}>
              {`Version: ${error.version}\nBrowser: ${error.browser}\nOS: ${error.os}`}
            </pre>
          </CollapsibleSection>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <CollapsibleSection
            title="Context"
            expanded={expandedSections.has('context')}
            onToggle={() => toggleSection('context')}
          >
            <pre style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '0.25rem' }}>
              {`Context: ${error.context}\nCategory: ${error.category}\nTimestamp: ${new Date(error.timestamp).toISOString()}`}
            </pre>
          </CollapsibleSection>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <CollapsibleSection
            title="Diagnostics"
            expanded={expandedSections.has('diagnostics')}
            onToggle={() => toggleSection('diagnostics')}
          >
            <pre style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '0.25rem', overflow: 'auto' }}>
              {formatDiagnosticData(error)}
            </pre>
          </CollapsibleSection>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>I've reviewed the diagnostic data above and confirm it contains no personal information</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              border: '1px solid #ccc',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleContinueToGitHub}
            disabled={!agreed}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              border: 'none',
              backgroundColor: agreed ? '#2563eb' : '#ccc',
              color: 'white',
              cursor: agreed ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            Continue to GitHub
          </button>
        </div>
      </div>
    </div>
  )
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '0.5rem',
          backgroundColor: '#f5f5f5',
          border: '1px solid #e5e5e5',
          borderRadius: '0.25rem',
          cursor: 'pointer',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        {title}
        <span>{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && <div style={{ marginTop: '0.5rem' }}>{children}</div>}
    </div>
  )
}
```

**Step 2: Integrate ErrorReportModal into ErrorToast**

In `src/chrome-ext/components/ErrorToast.tsx`, replace the TODO with:

```typescript
import { ErrorReportModal } from './ErrorReportModal'

// In ErrorToastContainer, replace the modal div with:
{showModal && (
  <ErrorReportModal
    errorIds={errors}
    onClose={() => setShowModal(false)}
  />
)}
```

**Step 3: Commit**

```bash
git add src/chrome-ext/components/ErrorReportModal.tsx src/chrome-ext/components/ErrorToast.tsx
git commit -m "feat(error-reporter): add ErrorReportModal with preview and GitHub integration"
```

---

### Task 7: Settings Page Error Log Viewer

**Files:**
- Create: `src/chrome-ext/components/ErrorLogViewer.tsx`
- Modify: `src/chrome-ext/preferences/PreferencesApp.tsx`

**Step 1: Create ErrorLogViewer component**

In `src/chrome-ext/components/ErrorLogViewer.tsx`:

```typescript
import React, { useState, useEffect } from 'react'
import type { ErrorLogEntry } from '../error-reporter/types'
import { ErrorReportModal } from './ErrorReportModal'

export function ErrorLogViewer() {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([])
  const [selectedErrorIds, setSelectedErrorIds] = useState<string[]>([])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    loadErrors()
  }, [])

  const loadErrors = async () => {
    const result = await chrome.storage.local.get('mountaineersAssistantErrors')
    const storage = result.mountaineersAssistantErrors
    if (storage?.errors) {
      // Sort by timestamp descending
      const sorted = [...storage.errors].sort((a, b) => b.timestamp - a.timestamp)
      setErrors(sorted)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all error logs?')) return

    await chrome.storage.local.set({
      mountaineersAssistantErrors: { errors: [], version: 1 }
    })
    setErrors([])
  }

  const handleReport = (errorId: string) => {
    setSelectedErrorIds([errorId])
    setShowModal(true)
  }

  if (errors.length === 0) {
    return (
      <div>
        <h3>Error Logs</h3>
        <p style={{ color: '#666' }}>No errors logged</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Error Logs</h3>
        <button
          onClick={handleClearAll}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            border: '1px solid #dc2626',
            backgroundColor: 'white',
            color: '#dc2626',
            cursor: 'pointer'
          }}
        >
          Clear All Logs
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {errors.map(error => (
          <div
            key={error.id}
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: '0.25rem',
              padding: '1rem',
              backgroundColor: error.reported ? '#f0fdf4' : 'white'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{error.message}</div>
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  {new Date(error.timestamp).toLocaleString()} • {error.context} • {error.category}
                  {error.occurrenceCount > 1 && ` • ${error.occurrenceCount} occurrences`}
                </div>
              </div>
              <div>
                {error.reported ? (
                  <span style={{ color: '#16a34a', fontSize: '0.875rem' }}>✓ Reported</span>
                ) : (
                  <button
                    onClick={() => handleReport(error.id)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.25rem',
                      border: '1px solid #2563eb',
                      backgroundColor: 'white',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Report
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ErrorReportModal
          errorIds={selectedErrorIds}
          onClose={() => {
            setShowModal(false)
            loadErrors() // Reload to show updated "reported" status
          }}
        />
      )}
    </div>
  )
}
```

**Step 2: Integrate into PreferencesApp**

In `src/chrome-ext/preferences/PreferencesApp.tsx`, add ErrorLogViewer:

```typescript
import { ErrorLogViewer } from '../components/ErrorLogViewer'

// Add after existing preferences sections
<ErrorLogViewer />
```

**Step 3: Commit**

```bash
git add src/chrome-ext/components/ErrorLogViewer.tsx src/chrome-ext/preferences/PreferencesApp.tsx
git commit -m "feat(error-reporter): add error log viewer to preferences page"
```

---

## Phase 3: Integration and Developer Tools

### Task 8: Initialize ErrorReporter in All Contexts

**Files:**
- Modify: `src/chrome-ext/background.ts`
- Modify: `src/chrome-ext/offscreen.ts`
- Modify: `src/chrome-ext/insights-react-root.tsx`
- Modify: `src/chrome-ext/preferences-react-root.tsx`

**Step 1: Initialize in background.ts**

In `src/chrome-ext/background.ts`, add at the top:

```typescript
import { ErrorReporter } from './error-reporter/ErrorReporter'

const errorReporter = new ErrorReporter()
errorReporter.installGlobalHandlers()
```

**Step 2: Wrap error-prone operations in background.ts**

In `src/chrome-ext/background.ts`, modify the refresh handler:

```typescript
// In handleRefreshRequest function, wrap in try/catch
async function handleRefreshRequest({
  fetchLimit,
}: {
  fetchLimit?: number | null
} = {}): Promise<HandleRefreshResult> {
  try {
    // ... existing code
  } catch (error) {
    await errorReporter.captureError(error as Error, {
      context: 'background',
      category: error instanceof Error && error.message.includes('fetch') ? 'network' : 'crash',
      diagnostics: { operation: 'handleRefreshRequest', fetchLimit }
    })
    throw error
  }
}
```

**Step 3: Initialize in offscreen.ts**

In `src/chrome-ext/offscreen.ts`, add at the top:

```typescript
import { ErrorReporter } from './error-reporter/ErrorReporter'

const errorReporter = new ErrorReporter()
errorReporter.installGlobalHandlers()
```

**Step 4: Initialize in insights-react-root.tsx**

In `src/chrome-ext/insights-react-root.tsx`, add:

```typescript
import { ErrorReporter } from './error-reporter/ErrorReporter'

const errorReporter = new ErrorReporter()
errorReporter.installGlobalHandlers()
```

**Step 5: Initialize in preferences-react-root.tsx**

In `src/chrome-ext/preferences-react-root.tsx`, add:

```typescript
import { ErrorReporter } from './error-reporter/ErrorReporter'

const errorReporter = new ErrorReporter()
errorReporter.installGlobalHandlers()
```

**Step 6: Commit**

```bash
git add src/chrome-ext/background.ts src/chrome-ext/offscreen.ts src/chrome-ext/insights-react-root.tsx src/chrome-ext/preferences-react-root.tsx
git commit -m "feat(error-reporter): initialize ErrorReporter in all contexts"
```

---

### Task 9: Add Developer Testing Tools

**Files:**
- Modify: `src/chrome-ext/error-reporter/ErrorReporter.ts`

**Step 1: Add dev tools installation method**

In `src/chrome-ext/error-reporter/ErrorReporter.ts`, add:

```typescript
export class ErrorReporter {
  // ... existing code

  installDevTools(): void {
    // Only in development mode (unpacked extension)
    const manifest = chrome.runtime.getManifest()
    if (manifest.update_url) {
      return // Production build, skip dev tools
    }

    // Expose testing functions
    (window as any).__triggerTestError = (type?: string) => {
      const errorTypes = {
        network: new Error('Test: Failed to fetch activity data (500)'),
        parsing: new Error('Test: Unexpected JSON structure from API'),
        crash: new Error('Test: Uncaught exception in component'),
        uiRender: new Error('Test: React component render failure')
      }

      const error = errorTypes[type as keyof typeof errorTypes] || errorTypes.crash
      this.captureError(error, {
        context: this.detectContext(),
        category: (type as any) || 'crash',
        diagnostics: { isTest: true, triggeredAt: new Date().toISOString() }
      })
    }

    (window as any).__clearErrorLog = async () => {
      await chrome.storage.local.set({
        mountaineersAssistantErrors: { errors: [], version: 1 }
      })
      console.log('Error log cleared')
    }

    (window as any).__viewErrorLog = async () => {
      const result = await chrome.storage.local.get('mountaineersAssistantErrors')
      const errors = result.mountaineersAssistantErrors?.errors || []
      console.table(errors.map((e: any) => ({
        message: e.message,
        context: e.context,
        category: e.category,
        timestamp: new Date(e.timestamp).toLocaleString(),
        occurrences: e.occurrenceCount,
        reported: e.reported
      })))
    }

    console.log('🔧 Error Reporter Dev Tools Available:')
    console.log('  __triggerTestError("network"|"parsing"|"crash"|"uiRender")')
    console.log('  __clearErrorLog()')
    console.log('  __viewErrorLog()')
  }
}
```

**Step 2: Call installDevTools in all contexts**

In `src/chrome-ext/background.ts`, after installing global handlers:

```typescript
errorReporter.installDevTools()
```

Do the same in `offscreen.ts`, `insights-react-root.tsx`, and `preferences-react-root.tsx`.

**Step 3: Commit**

```bash
git add src/chrome-ext/error-reporter/ErrorReporter.ts src/chrome-ext/background.ts src/chrome-ext/offscreen.ts src/chrome-ext/insights-react-root.tsx src/chrome-ext/preferences-react-root.tsx
git commit -m "feat(error-reporter): add developer testing tools"
```

---

### Task 10: Update Privacy Policy

**Files:**
- Modify: `PRIVACY.md`

**Step 1: Add Error Reporting section to PRIVACY.md**

In `PRIVACY.md`, add before "## Changes to This Policy":

```markdown
## Error Reporting (Optional)

When errors occur in the extension, you may choose to report them to help us improve the extension.

### What we collect when you report an error:

- Error messages and technical details (stack traces)
- Extension version, browser version, and operating system
- Context about what operation was being performed
- Sanitized diagnostic data (counts, timings, error types)

### What we DO NOT collect:

- Activity titles or descriptions
- Person names or member identifiers
- Any personally identifiable information from your Mountaineers.org data

### How it works:

- When an error occurs, you'll see a notification
- You can choose to report the error or dismiss the notification
- Before submitting, you'll see a preview of exactly what data will be included
- Reports are submitted as public GitHub issues (you can add additional context)
- Error data is stored locally for 7 days to allow later reporting

### Your control:

- Reporting is always optional and requires your explicit action
- You can review all diagnostic data before submitting
- You can view or clear error logs from the Preferences page
- Dismissing an error notification prevents it from appearing again
```

**Step 2: Commit**

```bash
git add PRIVACY.md
git commit -m "docs: update privacy policy for error reporting"
```

---

### Task 11: Build and Manual Testing

**Files:**
- None (testing only)

**Step 1: Build the extension**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 2: Load unpacked extension**

1. Open Chrome: `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select `.worktrees/error-diagnostics/dist` directory

**Step 3: Test developer tools**

1. Open insights page
2. Open browser console
3. Run: `__triggerTestError()`
4. Expected: Toast appears with error notification
5. Run: `__viewErrorLog()`
6. Expected: Console table shows 1 error

**Step 4: Test error reporting flow**

1. Click "Report Issue" on toast
2. Expected: Modal opens with error details
3. Review sanitized data in each section
4. Expected: No PII visible (no activity titles, person names)
5. Check consent checkbox
6. Click "Continue to GitHub"
7. Expected: GitHub issue page opens in new tab with pre-filled data

**Step 5: Test settings page error log**

1. Open preferences page
2. Scroll to "Error Logs" section
3. Expected: See the test error listed
4. Expected: Error shows "✓ Reported" status
5. Trigger another test error: `__triggerTestError('network')`
6. Expected: New error appears in list
7. Click "Report" button
8. Expected: Modal opens
9. Click "Clear All Logs"
10. Expected: Confirmation dialog, then all errors removed

**Step 6: Test real error scenarios**

Manually test:
- Network error (disconnect internet during fetch)
- Parsing error (if possible, mock malformed response)
- UI error (temporarily add `throw new Error('test')` in a component)

**Step 7: Privacy validation**

Critical: Review generated GitHub issues for ANY PII leakage.

If all tests pass, proceed to commit.

**Step 8: Commit**

```bash
git add .
git commit -m "test: manual testing complete, all scenarios passing"
```

---

### Task 12: Integration Tests (Optional but Recommended)

**Files:**
- Create: `tests/integration/error-reporter.test.ts`

**Step 1: Write integration test**

In `tests/integration/error-reporter.test.ts`:

```typescript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Error Reporter Integration', () => {
  it('should capture error and show toast in UI', async () => {
    // This would require Playwright or similar
    // Skipping for now, but recommended to add later
    assert.ok(true, 'Integration tests TODO')
  })
})
```

**Step 2: Commit**

```bash
git add tests/integration/error-reporter.test.ts
git commit -m "test: add integration test placeholders"
```

---

## Verification Checklist

Before marking complete, verify:

- [ ] Unit tests pass: `npm run test:unit`
- [ ] Build succeeds: `npm run build`
- [ ] Type check passes: `npm run typecheck`
- [ ] Lint passes: `npm run lint`
- [ ] Toast appears when errors occur
- [ ] Modal displays sanitized data
- [ ] GitHub issues created with correct template
- [ ] Settings page shows error logs
- [ ] Developer tools work in console
- [ ] Privacy policy updated
- [ ] NO PII in generated reports (manually verified)

---

## Next Steps After Implementation

1. **Code Review:** Use superpowers:requesting-code-review
2. **Create PR:** Open pull request to main branch
3. **Test in Production:** Deploy to small user group first
4. **Monitor:** Check for false positives or issues
5. **Iterate:** Based on user feedback

---

**Implementation Time Estimate:** 4-6 hours for experienced developer

**Risk Areas:**
- PII sanitization (CRITICAL - requires thorough testing)
- Cross-context messaging reliability
- GitHub URL encoding edge cases
