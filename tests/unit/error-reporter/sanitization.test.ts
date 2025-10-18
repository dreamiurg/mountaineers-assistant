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

  it('should redact activityTitle field in CollectorProgressMessage', () => {
    const input = {
      type: 'refresh-progress',
      stage: 'collecting',
      activityUid: 'act-456',
      activityTitle: 'Ice Climbing Workshop'
    }

    const result = sanitizeDiagnosticData(input)

    assert.deepEqual(result, {
      type: 'refresh-progress',
      stage: 'collecting',
      activityUid: 'act-456',
      activityTitle: '[Activity Title Redacted]'
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

  it('should anonymize slug fields', () => {
    const input = {
      members: [
        { slug: 'john-doe', name: 'John Doe' },
        { slug: 'jane-smith', name: 'Jane Smith' }
      ]
    }

    const result = sanitizeDiagnosticData(input)

    assert.deepEqual(result, {
      members: [
        { slug: 'person_001', name: '[Name Redacted]' },
        { slug: 'person_002', name: '[Name Redacted]' }
      ]
    })
  })

  it('should anonymize fields containing "slug" in the name', () => {
    const input = {
      userSlug: 'john-doe',
      memberSlug: 'jane-smith',
      profileSlug: 'bob-jones'
    }

    const result = sanitizeDiagnosticData(input)

    assert.deepEqual(result, {
      userSlug: 'person_001',
      memberSlug: 'person_002',
      profileSlug: 'person_003'
    })
  })

  it('should sanitize url field', () => {
    const input = {
      activity: {
        uid: 'act-123',
        url: 'https://mountaineers.org/members/john-doe/profile'
      }
    }

    const result = sanitizeDiagnosticData(input)

    assert.deepEqual(result, {
      activity: {
        uid: 'act-123',
        url: 'https://mountaineers.org/members/[redacted]/profile'
      }
    })
  })

  it('should sanitize link field', () => {
    const input = {
      member: {
        name: 'John Doe',
        link: 'https://mountaineers.org/members/john-doe'
      }
    }

    const result = sanitizeDiagnosticData(input)

    assert.deepEqual(result, {
      member: {
        name: '[Name Redacted]',
        link: 'https://mountaineers.org/members/[redacted]'
      }
    })
  })

  it('should sanitize fields with "url" or "link" in the name', () => {
    const input = {
      profileUrl: 'https://mountaineers.org/members/john-doe',
      memberLink: 'https://mountaineers.org/members/jane-smith',
      avatarURL: 'https://mountaineers.org/members/bob-jones/avatar'
    }

    const result = sanitizeDiagnosticData(input)

    assert.deepEqual(result, {
      profileUrl: 'https://mountaineers.org/members/[redacted]',
      memberLink: 'https://mountaineers.org/members/[redacted]',
      avatarURL: 'https://mountaineers.org/members/[redacted]/avatar'
    })
  })

  it('should handle CollectorProgressMessage with all PII fields', () => {
    const input = {
      type: 'refresh-progress',
      origin: 'collector',
      stage: 'collecting',
      timestamp: 1234567890,
      total: 10,
      completed: 5,
      activityUid: 'act-789',
      activityTitle: 'Mountain Scrambling Course',
      error: 'Failed to load activity for member john-doe'
    }

    const result = sanitizeDiagnosticData(input)

    assert.deepEqual(result, {
      type: 'refresh-progress',
      origin: 'collector',
      stage: 'collecting',
      timestamp: 1234567890,
      total: 10,
      completed: 5,
      activityUid: 'act-789',
      activityTitle: '[Activity Title Redacted]',
      error: 'Failed to load activity for member [redacted]'
    })
  })

  it('should sanitize error messages containing PII', () => {
    const input = 'Failed to load activity "Mt. Rainier Summit Climb" for user john-doe'

    const result = sanitizeErrorMessage(input)

    assert.strictEqual(result, 'Failed to load activity "[redacted]" for user [redacted]')
  })
})
