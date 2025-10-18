/**
 * Unit tests for offscreen document management
 * Tests the ensureOffscreenDocument function from background.ts
 */

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

// Mock Chrome APIs
type MockFunction = {
  calls: unknown[][]
  mockResolvedValue: (value: unknown) => void
  mockRejectedValue: (error: Error) => void
  mockImplementation: (fn: (...args: unknown[]) => unknown) => void
  reset: () => void
  _impl?: (...args: unknown[]) => unknown
  _resolvedValue?: unknown
  _rejectedValue?: Error
}

function createMockFunction(): MockFunction {
  const mock: MockFunction = {
    calls: [],
    mockResolvedValue(value: unknown) {
      mock._resolvedValue = value
      mock._rejectedValue = undefined
    },
    mockRejectedValue(error: Error) {
      mock._rejectedValue = error
      mock._resolvedValue = undefined
    },
    mockImplementation(fn: (...args: unknown[]) => unknown) {
      mock._impl = fn
    },
    reset() {
      mock.calls = []
      mock._resolvedValue = undefined
      mock._rejectedValue = undefined
      mock._impl = undefined
    },
  }
  return mock
}

// Create mock Chrome API
const mockGetContexts = createMockFunction()
const mockCreateDocument = createMockFunction()

// Set up global chrome mock
const mockChrome = {
  runtime: {
    getContexts: (...args: unknown[]) => {
      mockGetContexts.calls.push(args)
      if (mockGetContexts._impl) {
        return mockGetContexts._impl(...args)
      }
      if (mockGetContexts._rejectedValue) {
        return Promise.reject(mockGetContexts._rejectedValue)
      }
      return Promise.resolve(mockGetContexts._resolvedValue ?? [])
    },
    ContextType: {
      OFFSCREEN_DOCUMENT: 'OFFSCREEN_DOCUMENT',
    },
  },
  offscreen: {
    createDocument: (...args: unknown[]) => {
      mockCreateDocument.calls.push(args)
      if (mockCreateDocument._impl) {
        return mockCreateDocument._impl(...args)
      }
      if (mockCreateDocument._rejectedValue) {
        return Promise.reject(mockCreateDocument._rejectedValue)
      }
      return Promise.resolve(mockCreateDocument._resolvedValue ?? undefined)
    },
    Reason: {
      DOM_SCRAPING: 'DOM_SCRAPING',
    },
  },
}

// Set up global chrome
// @ts-expect-error - Overriding global chrome for testing
;(global as typeof globalThis).chrome = mockChrome

// Function under test (copied from background.ts)
async function ensureOffscreenDocument(): Promise<void> {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  })

  if (existingContexts.length > 0) {
    return // Already exists, reuse it
  }

  // Create new offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
    justification: 'Fetch and parse Mountaineers.org activity data using DOM APIs',
  })
}

describe('ensureOffscreenDocument', () => {
  beforeEach(() => {
    mockGetContexts.reset()
    mockCreateDocument.reset()
  })

  afterEach(() => {
    mockGetContexts.reset()
    mockCreateDocument.reset()
  })

  it('should create offscreen document if none exists', async () => {
    // Arrange: No existing contexts
    mockGetContexts.mockResolvedValue([])
    mockCreateDocument.mockResolvedValue(undefined)

    // Act
    await ensureOffscreenDocument()

    // Assert: getContexts was called
    assert.equal(mockGetContexts.calls.length, 1, 'getContexts should be called once')
    assert.deepEqual(
      mockGetContexts.calls[0],
      [{ contextTypes: ['OFFSCREEN_DOCUMENT'] }],
      'getContexts should be called with correct context type'
    )

    // Assert: createDocument was called
    assert.equal(mockCreateDocument.calls.length, 1, 'createDocument should be called once')
    assert.deepEqual(
      mockCreateDocument.calls[0],
      [
        {
          url: 'offscreen.html',
          reasons: ['DOM_SCRAPING'],
          justification: 'Fetch and parse Mountaineers.org activity data using DOM APIs',
        },
      ],
      'createDocument should be called with correct parameters'
    )
  })

  it('should reuse existing offscreen document', async () => {
    // Arrange: Existing context
    mockGetContexts.mockResolvedValue([{ contextType: 'OFFSCREEN_DOCUMENT' }])

    // Act
    await ensureOffscreenDocument()

    // Assert: getContexts was called
    assert.equal(mockGetContexts.calls.length, 1, 'getContexts should be called once')

    // Assert: createDocument was NOT called
    assert.equal(
      mockCreateDocument.calls.length,
      0,
      'createDocument should not be called when document exists'
    )
  })

  it('should throw error if creation fails', async () => {
    // Arrange: No existing contexts, but creation fails
    mockGetContexts.mockResolvedValue([])
    mockCreateDocument.mockRejectedValue(new Error('Creation failed'))

    // Act & Assert
    await assert.rejects(
      async () => {
        await ensureOffscreenDocument()
      },
      {
        message: 'Creation failed',
      },
      'Should throw error when creation fails'
    )

    // Verify getContexts was called
    assert.equal(mockGetContexts.calls.length, 1, 'getContexts should be called')

    // Verify createDocument was attempted
    assert.equal(mockCreateDocument.calls.length, 1, 'createDocument should be attempted')
  })

  it('should throw error if getContexts fails', async () => {
    // Arrange: getContexts fails
    mockGetContexts.mockRejectedValue(new Error('Failed to get contexts'))

    // Act & Assert
    await assert.rejects(
      async () => {
        await ensureOffscreenDocument()
      },
      {
        message: 'Failed to get contexts',
      },
      'Should throw error when getContexts fails'
    )

    // Verify getContexts was called
    assert.equal(mockGetContexts.calls.length, 1, 'getContexts should be called')

    // Verify createDocument was not called
    assert.equal(
      mockCreateDocument.calls.length,
      0,
      'createDocument should not be called when getContexts fails'
    )
  })

  it('should handle multiple existing contexts', async () => {
    // Arrange: Multiple existing contexts
    mockGetContexts.mockResolvedValue([
      { contextType: 'OFFSCREEN_DOCUMENT' },
      { contextType: 'OFFSCREEN_DOCUMENT' },
    ])

    // Act
    await ensureOffscreenDocument()

    // Assert: getContexts was called
    assert.equal(mockGetContexts.calls.length, 1, 'getContexts should be called once')

    // Assert: createDocument was NOT called (any existing context is sufficient)
    assert.equal(
      mockCreateDocument.calls.length,
      0,
      'createDocument should not be called when contexts exist'
    )
  })

  it('should use correct URL and reason when creating document', async () => {
    // Arrange
    mockGetContexts.mockResolvedValue([])
    mockCreateDocument.mockResolvedValue(undefined)

    // Act
    await ensureOffscreenDocument()

    // Assert: Verify specific properties of createDocument call
    const createCall = mockCreateDocument.calls[0]?.[0] as Record<string, unknown>
    assert.ok(createCall, 'createDocument should be called')
    assert.equal(createCall.url, 'offscreen.html', 'URL should be offscreen.html')
    assert.deepEqual(createCall.reasons, ['DOM_SCRAPING'], 'Reason should be DOM_SCRAPING')
    assert.equal(typeof createCall.justification, 'string', 'Justification should be a string')
    assert.ok((createCall.justification as string).length > 0, 'Justification should not be empty')
  })
})
