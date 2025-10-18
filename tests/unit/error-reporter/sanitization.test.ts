import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeDiagnosticData, sanitizeErrorMessage } from '../../../src/chrome-ext/error-reporter/sanitization'

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

  it('should sanitize error messages containing PII', () => {
    const input = 'Failed to load activity "Mt. Rainier Summit Climb" for user john-doe'

    const result = sanitizeErrorMessage(input)

    assert.strictEqual(result, 'Failed to load activity "[redacted]" for user [redacted]')
  })
})
