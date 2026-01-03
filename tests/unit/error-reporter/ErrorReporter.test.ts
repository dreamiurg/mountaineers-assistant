import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isAuthError } from '../../../src/chrome-ext/error-reporter/ErrorReporter'

describe('isAuthError', () => {
  it('returns true for login required message', () => {
    const error = new Error('Please log in to Mountaineers.org')
    assert.strictEqual(isAuthError(error), true)
  })

  it('returns true for unable to locate message', () => {
    const error = new Error('Unable to locate user profile')
    assert.strictEqual(isAuthError(error), true)
  })

  it('returns true for My Activities message', () => {
    const error = new Error('Could not find My Activities page')
    assert.strictEqual(isAuthError(error), true)
  })

  it('returns true for 401 status', () => {
    const error = new Error('HTTP 401 response')
    assert.strictEqual(isAuthError(error), true)
  })

  it('returns true for Unauthorized message', () => {
    const error = new Error('Unauthorized access')
    assert.strictEqual(isAuthError(error), true)
  })

  it('returns false for network errors', () => {
    const error = new Error('Failed to fetch')
    assert.strictEqual(isAuthError(error), false)
  })

  it('returns false for parsing errors', () => {
    const error = new Error('Unexpected token in JSON')
    assert.strictEqual(isAuthError(error), false)
  })

  it('handles string input', () => {
    assert.strictEqual(isAuthError('Please log in to Mountaineers.org'), true)
    assert.strictEqual(isAuthError('Some other error'), false)
  })

  it('handles non-error objects', () => {
    assert.strictEqual(isAuthError({ message: 'Unauthorized' }), false)
    assert.strictEqual(isAuthError(null), false)
    assert.strictEqual(isAuthError(undefined), false)
  })
})
