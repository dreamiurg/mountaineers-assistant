import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatDate,
  formatDateRange,
  formatNumber,
  getActivityTypeColors,
  initials,
  titleCase,
  toExternalHref,
} from '../../../src/chrome-ext/insights/utils'

describe('formatNumber', () => {
  it('formats integers with locale separators', () => {
    assert.strictEqual(formatNumber(1234), '1,234')
    assert.strictEqual(formatNumber(1000000), '1,000,000')
  })

  it('handles zero', () => {
    assert.strictEqual(formatNumber(0), '0')
  })

  it('handles null and undefined as zero', () => {
    assert.strictEqual(formatNumber(null), '0')
    assert.strictEqual(formatNumber(undefined), '0')
  })
})

describe('formatDate', () => {
  it('formats a valid date', () => {
    const date = new Date('2024-03-15')
    const result = formatDate(date)
    assert.ok(result.includes('Mar'))
    assert.ok(result.includes('15'))
    assert.ok(result.includes('2024'))
  })

  it('returns dash for null', () => {
    assert.strictEqual(formatDate(null), '–')
  })

  it('returns dash for undefined', () => {
    assert.strictEqual(formatDate(undefined), '–')
  })
})

describe('formatDateRange', () => {
  it('formats a date range', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-12-31')
    const result = formatDateRange(start, end)
    assert.ok(result.includes('Jan'))
    assert.ok(result.includes('Dec'))
    assert.ok(result.includes('–'))
  })

  it('returns only end date when start is null', () => {
    const end = new Date('2024-06-15')
    const result = formatDateRange(null, end)
    assert.ok(result.includes('Jun'))
  })

  it('returns only start date when end is null', () => {
    const start = new Date('2024-06-15')
    const result = formatDateRange(start, null)
    assert.ok(result.includes('Jun'))
  })

  it('returns dash when both are null', () => {
    assert.strictEqual(formatDateRange(null, null), '–')
  })
})

describe('titleCase', () => {
  it('converts lowercase to title case', () => {
    assert.strictEqual(titleCase('hello world'), 'Hello World')
  })

  it('handles hyphenated words', () => {
    assert.strictEqual(titleCase('ice-climbing'), 'Ice Climbing')
  })

  it('handles underscored words', () => {
    assert.strictEqual(titleCase('snow_camping'), 'Snow Camping')
  })

  it('returns Uncategorized for null', () => {
    assert.strictEqual(titleCase(null), 'Uncategorized')
  })

  it('returns Uncategorized for undefined', () => {
    assert.strictEqual(titleCase(undefined), 'Uncategorized')
  })

  it('returns Uncategorized for empty string', () => {
    assert.strictEqual(titleCase(''), 'Uncategorized')
  })
})

describe('toExternalHref', () => {
  it('returns absolute URL for relative path', () => {
    assert.strictEqual(
      toExternalHref('/activities/123'),
      'https://www.mountaineers.org/activities/123'
    )
  })

  it('returns absolute URL unchanged', () => {
    assert.strictEqual(
      toExternalHref('https://www.mountaineers.org/activities/123'),
      'https://www.mountaineers.org/activities/123'
    )
  })

  it('returns null for null input', () => {
    assert.strictEqual(toExternalHref(null), null)
  })

  it('returns null for undefined input', () => {
    assert.strictEqual(toExternalHref(undefined), null)
  })

  it('returns null for empty string', () => {
    assert.strictEqual(toExternalHref(''), null)
  })
})

describe('initials', () => {
  it('extracts initials from full name', () => {
    assert.strictEqual(initials('John Doe'), 'JD')
  })

  it('extracts first two initials from long name', () => {
    assert.strictEqual(initials('John Michael Doe'), 'JM')
  })

  it('handles single name', () => {
    assert.strictEqual(initials('John'), 'J')
  })

  it('handles extra whitespace', () => {
    assert.strictEqual(initials('  John   Doe  '), 'JD')
  })

  it('returns empty string for null', () => {
    assert.strictEqual(initials(null), '')
  })

  it('returns empty string for undefined', () => {
    assert.strictEqual(initials(undefined), '')
  })

  it('returns empty string for empty string', () => {
    assert.strictEqual(initials(''), '')
  })
})

describe('getActivityTypeColors', () => {
  it('returns an array of color strings', () => {
    const colors = getActivityTypeColors()
    assert.ok(Array.isArray(colors))
    assert.ok(colors.length > 0)
    assert.ok(colors.every((c) => typeof c === 'string' && c.startsWith('#')))
  })
})
