/**
 * Unit tests for calendar export modules
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  generateGoogleCalendarURL,
  generateOutlookCalendarURL,
} from '../../src/chrome-ext/calendar/calendar-services'
import { generateICS, generateICSFilename } from '../../src/chrome-ext/calendar/ics-generator'
import type { CalendarEventData } from '../../src/chrome-ext/calendar/types'

describe('ICS Generation', () => {
  it('generates valid iCalendar format', () => {
    const event: CalendarEventData = {
      title: 'Mt. Si Summit Climb',
      startDate: new Date('2026-01-20T15:00:00Z'), // 7 AM PST
      endDate: new Date('2026-01-20T23:00:00Z'), // 3 PM PST
      location: 'Mt. Si Trailhead, North Bend, WA',
      description: 'Difficulty: Moderate',
      url: 'https://www.mountaineers.org/activities/test',
    }

    const ics = generateICS(event)

    // Verify RFC 5545 structure
    assert.ok(ics.includes('BEGIN:VCALENDAR'))
    assert.ok(ics.includes('END:VCALENDAR'))
    assert.ok(ics.includes('BEGIN:VEVENT'))
    assert.ok(ics.includes('END:VEVENT'))
    assert.ok(ics.includes('VERSION:2.0'))
    assert.ok(ics.includes('PRODID:-//Mountaineers Assistant//EN'))

    // Verify event details (note: commas are escaped per RFC 5545)
    assert.ok(ics.includes('SUMMARY:Mt. Si Summit Climb'))
    assert.ok(ics.includes('LOCATION:Mt. Si Trailhead\\, North Bend\\, WA'))
    assert.ok(ics.includes('DESCRIPTION:Difficulty: Moderate'))
    assert.ok(ics.includes('URL:https://www.mountaineers.org/activities/test'))

    // Verify dates are in UTC format (YYYYMMDDTHHMMSSZ)
    assert.ok(ics.includes('DTSTART:20260120T150000Z'))
    assert.ok(ics.includes('DTEND:20260120T230000Z'))
  })

  it('escapes special characters in ICS format', () => {
    const event: CalendarEventData = {
      title: 'Test; Event, With\\Special\nCharacters',
      startDate: new Date('2026-01-20T15:00:00Z'),
      endDate: new Date('2026-01-20T23:00:00Z'),
      location: null,
      description: null,
      url: 'https://test.com',
    }

    const ics = generateICS(event)

    // Verify characters are escaped according to RFC 5545
    assert.ok(ics.includes('SUMMARY:Test\\; Event\\, With\\\\Special\\nCharacters'))
  })

  it('generates valid filename from event data', () => {
    const filename = generateICSFilename('Mt. Si Summit Climb', new Date('2026-01-20T15:00:00Z'))

    assert.ok(filename.startsWith('2026-01-20-'))
    assert.ok(filename.includes('mt-si-summit-climb'))
    assert.ok(filename.endsWith('.ics'))
  })

  it('limits filename length', () => {
    const longTitle = 'A'.repeat(100)
    const filename = generateICSFilename(longTitle, new Date('2026-01-20T15:00:00Z'))

    // Should not exceed reasonable length (date + hyphen + 50 chars + .ics)
    assert.ok(filename.length < 70)
  })
})

describe('Google Calendar URL Generation', () => {
  it('generates valid Google Calendar URL', () => {
    const event: CalendarEventData = {
      title: 'Mt. Si Summit Climb',
      startDate: new Date('2026-01-20T15:00:00Z'),
      endDate: new Date('2026-01-20T23:00:00Z'),
      location: 'Mt. Si Trailhead',
      description: 'Difficulty: Moderate',
      url: 'https://www.mountaineers.org/activities/test',
    }

    const url = generateGoogleCalendarURL(event)

    assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'))
    assert.ok(url.includes('action=TEMPLATE'))
    assert.ok(url.includes('text=Mt.+Si+Summit+Climb'))
    assert.ok(url.includes('dates=20260120T150000Z%2F20260120T230000Z'))
    assert.ok(url.includes('location=Mt.+Si+Trailhead'))
  })

  it('includes activity URL in description', () => {
    const event: CalendarEventData = {
      title: 'Test Event',
      startDate: new Date('2026-01-20T15:00:00Z'),
      endDate: new Date('2026-01-20T23:00:00Z'),
      location: null,
      description: 'Test description',
      url: 'https://www.mountaineers.org/activities/test',
    }

    const url = generateGoogleCalendarURL(event)

    // URL should include activity URL in details
    assert.ok(url.includes('details='))
    assert.ok(url.includes('mountaineers.org'))
  })
})

describe('Outlook Calendar URL Generation', () => {
  it('generates valid Outlook Calendar URL', () => {
    const event: CalendarEventData = {
      title: 'Mt. Si Summit Climb',
      startDate: new Date('2026-01-20T15:00:00Z'),
      endDate: new Date('2026-01-20T23:00:00Z'),
      location: 'Mt. Si Trailhead',
      description: 'Difficulty: Moderate',
      url: 'https://www.mountaineers.org/activities/test',
    }

    const url = generateOutlookCalendarURL(event)

    assert.ok(url.startsWith('https://outlook.live.com/calendar/0/deeplink/compose?'))
    assert.ok(url.includes('path=%2Fcalendar%2Faction%2Fcompose'))
    assert.ok(url.includes('subject=Mt.+Si+Summit+Climb'))
    assert.ok(url.includes('startdt=2026-01-20T15%3A00%3A00.000Z'))
    assert.ok(url.includes('enddt=2026-01-20T23%3A00%3A00.000Z'))
    assert.ok(url.includes('location=Mt.+Si+Trailhead'))
  })

  it('includes activity URL in body', () => {
    const event: CalendarEventData = {
      title: 'Test Event',
      startDate: new Date('2026-01-20T15:00:00Z'),
      endDate: new Date('2026-01-20T23:00:00Z'),
      location: null,
      description: null,
      url: 'https://www.mountaineers.org/activities/test',
    }

    const url = generateOutlookCalendarURL(event)

    // URL should include activity URL in body
    assert.ok(url.includes('body='))
    assert.ok(url.includes('mountaineers.org'))
  })
})
