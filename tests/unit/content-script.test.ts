/**
 * Unit tests for content script utilities
 * Tests the shared activities content script functions
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

// Extracted functions for testing (duplicated from content-script.ts since it's a browser module)

function extractMemberUidFromUrl(pathname: string): string | null {
  const match = pathname.match(/^\/members\/([^/?#]+)/)
  return match ? match[1] : null
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) {
      return 'Invalid Date'
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return dateString
  }
}

describe('extractMemberUidFromUrl', () => {
  it('extracts member uid from valid member profile path', () => {
    assert.strictEqual(extractMemberUidFromUrl('/members/john-doe'), 'john-doe')
    assert.strictEqual(extractMemberUidFromUrl('/members/serena-capozi'), 'serena-capozi')
  })

  it('extracts member uid with special characters', () => {
    assert.strictEqual(extractMemberUidFromUrl('/members/john-123'), 'john-123')
    assert.strictEqual(extractMemberUidFromUrl('/members/user_name'), 'user_name')
  })

  it('extracts member uid ignoring query strings', () => {
    assert.strictEqual(extractMemberUidFromUrl('/members/john-doe?tab=activities'), 'john-doe')
  })

  it('extracts member uid ignoring hash fragments', () => {
    assert.strictEqual(extractMemberUidFromUrl('/members/john-doe#section'), 'john-doe')
  })

  it('returns null for non-member paths', () => {
    assert.strictEqual(extractMemberUidFromUrl('/activities/123'), null)
    assert.strictEqual(extractMemberUidFromUrl('/'), null)
    assert.strictEqual(extractMemberUidFromUrl('/about'), null)
  })

  it('returns null for member list path without specific member', () => {
    // Note: this depends on implementation - /members/ alone may or may not match
    // Current implementation requires something after /members/
    assert.strictEqual(extractMemberUidFromUrl('/members/'), null)
  })

  it('handles nested member paths', () => {
    // Should only extract the first segment after /members/
    assert.strictEqual(extractMemberUidFromUrl('/members/john-doe/activities'), 'john-doe')
  })
})

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2024-03-15')
    assert.ok(result.includes('Mar'))
    assert.ok(result.includes('15'))
    assert.ok(result.includes('2024'))
  })

  it('formats a date with time component', () => {
    const result = formatDate('2024-03-15T10:30:00Z')
    assert.ok(result.includes('Mar'))
    assert.ok(result.includes('2024'))
  })

  it('returns original string for invalid date', () => {
    assert.strictEqual(formatDate('not-a-date'), 'Invalid Date')
  })

  it('handles empty string', () => {
    const result = formatDate('')
    // Empty string creates Invalid Date
    assert.strictEqual(result, 'Invalid Date')
  })
})
