import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  addError,
  clearErrorLog,
  getUnreportedErrors,
  loadErrorLog,
  markErrorDismissed,
  markErrorReported,
  saveErrorLog,
} from '../../../src/chrome-ext/error-reporter/storage'
import type { ErrorLogEntry } from '../../../src/chrome-ext/error-reporter/types'

// Mock chrome.storage.local
const storageMock = new Map<string, unknown>()
global.chrome = {
  storage: {
    local: {
      get: async (key: string) => {
        return { [key]: storageMock.get(key) }
      },
      set: async (items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) {
          storageMock.set(key, value)
        }
      },
      remove: async (key: string) => {
        storageMock.delete(key)
      },
    },
  },
  // biome-ignore lint/suspicious/noExplicitAny: Mock object for testing
} as any

function createTestError(overrides: Partial<ErrorLogEntry> = {}): ErrorLogEntry {
  return {
    id: 'test-id',
    timestamp: Date.now(),
    message: 'Test error',
    stack: 'Error: Test error\n  at test.ts:1:1',
    context: 'background',
    category: 'crash',
    version: '1.0.0',
    browser: 'Chrome 120',
    os: 'darwin',
    diagnostics: {},
    reported: false,
    dismissed: false,
    occurrenceCount: 1,
    ...overrides,
  }
}

describe('error-reporter storage', () => {
  beforeEach(() => {
    storageMock.clear()
  })

  describe('loadErrorLog', () => {
    it('returns empty array when no errors stored', async () => {
      const errors = await loadErrorLog()
      assert.deepEqual(errors, [])
    })

    it('loads errors from storage', async () => {
      const testError = createTestError()
      await saveErrorLog([testError])

      const errors = await loadErrorLog()
      assert.deepEqual(errors, [testError])
    })

    it('filters out errors older than 7 days', async () => {
      const oldError = createTestError({
        id: 'old',
        timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
      })
      const recentError = createTestError({
        id: 'recent',
        timestamp: Date.now(),
      })

      await saveErrorLog([oldError, recentError])
      const errors = await loadErrorLog()

      assert.equal(errors.length, 1)
      assert.equal(errors[0].id, 'recent')
    })

    it('saves cleaned list when old errors are removed', async () => {
      const oldError = createTestError({
        timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
      })
      await saveErrorLog([oldError])

      const errors = await loadErrorLog()

      // Verify old errors were removed
      assert.equal(errors.length, 0)
    })
  })

  describe('addError', () => {
    it('adds new error to empty log', async () => {
      const error = createTestError()
      await addError(error)

      const errors = await loadErrorLog()
      assert.equal(errors.length, 1)
      assert.deepEqual(errors[0], error)
    })

    it('deduplicates errors within 5 minute window', async () => {
      const originalTimestamp = Date.now() - 2 * 60 * 1000 // 2 minutes ago
      const error1 = createTestError({
        id: 'error-1',
        timestamp: originalTimestamp,
      })
      await saveErrorLog([error1])

      const error2 = createTestError({
        id: 'error-2',
        timestamp: Date.now(),
      })
      await addError(error2)

      const errors = await loadErrorLog()
      assert.equal(errors.length, 1)
      assert.equal(errors[0].occurrenceCount, 2)
      assert.ok(errors[0].timestamp > originalTimestamp)
    })

    it('creates separate entry for errors outside dedup window', async () => {
      const error1 = createTestError({
        id: 'error-1',
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
      })
      await saveErrorLog([error1])

      const error2 = createTestError({
        id: 'error-2',
        timestamp: Date.now(),
      })
      await addError(error2)

      const errors = await loadErrorLog()
      assert.equal(errors.length, 2)
    })

    it('creates separate entry for different error messages', async () => {
      const error1 = createTestError({
        id: 'error-1',
        message: 'Error A',
      })
      await saveErrorLog([error1])

      const error2 = createTestError({
        id: 'error-2',
        message: 'Error B',
      })
      await addError(error2)

      const errors = await loadErrorLog()
      assert.equal(errors.length, 2)
    })

    it('creates separate entry for different contexts', async () => {
      const error1 = createTestError({
        id: 'error-1',
        context: 'background',
      })
      await saveErrorLog([error1])

      const error2 = createTestError({
        id: 'error-2',
        context: 'insights',
      })
      await addError(error2)

      const errors = await loadErrorLog()
      assert.equal(errors.length, 2)
    })

    it('enforces max 50 errors limit', async () => {
      // Create 50 errors with unique messages to avoid deduplication
      const errors = Array.from({ length: 50 }, (_, i) =>
        createTestError({
          id: `error-${i}`,
          message: `Test error ${i}`,
          timestamp: Date.now() + i * 1000,
        })
      )
      await saveErrorLog(errors)

      // Add one more with unique message
      const newError = createTestError({
        id: 'error-51',
        message: 'Test error 51',
        timestamp: Date.now() + 51000,
      })
      await addError(newError)

      const result = await loadErrorLog()
      assert.equal(result.length, 50)
      // Oldest error should be removed
      assert.equal(
        result.find((e) => e.id === 'error-0'),
        undefined
      )
      // Newest error should be present
      assert.ok(result.find((e) => e.id === 'error-51'))
    })
  })

  describe('markErrorReported', () => {
    it('marks error as reported', async () => {
      const error = createTestError({ id: 'test-id' })
      await saveErrorLog([error])

      await markErrorReported('test-id')

      const errors = await loadErrorLog()
      assert.equal(errors[0].reported, true)
      assert.ok(errors[0].reportedAt)
    })

    it('does nothing if error not found', async () => {
      await markErrorReported('non-existent')
      // Should not throw
    })
  })

  describe('markErrorDismissed', () => {
    it('marks error as dismissed', async () => {
      const error = createTestError({ id: 'test-id' })
      await saveErrorLog([error])

      await markErrorDismissed('test-id')

      const errors = await loadErrorLog()
      assert.equal(errors[0].dismissed, true)
    })

    it('does nothing if error not found', async () => {
      await markErrorDismissed('non-existent')
      // Should not throw
    })
  })

  describe('getUnreportedErrors', () => {
    it('returns only unreported and undismissed errors', async () => {
      const unreported = createTestError({ id: 'unreported' })
      const reported = createTestError({ id: 'reported', reported: true })
      const dismissed = createTestError({ id: 'dismissed', dismissed: true })

      await saveErrorLog([unreported, reported, dismissed])

      const errors = await getUnreportedErrors()
      assert.equal(errors.length, 1)
      assert.equal(errors[0].id, 'unreported')
    })
  })

  describe('clearErrorLog', () => {
    it('removes all errors from storage', async () => {
      const error = createTestError()
      await saveErrorLog([error])

      await clearErrorLog()

      const errors = await loadErrorLog()
      assert.deepEqual(errors, [])
    })
  })
})
