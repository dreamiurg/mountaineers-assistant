/**
 * Parse activity page DOM to extract event data for calendar export
 */

import type { ActivityPageData } from './types'

/**
 * Extract activity details from current page DOM
 * Reuses parsing pattern from offscreen.ts but adapted for content script context
 */
export function parseActivityPage(): ActivityPageData | null {
  // Get activity title from h1
  const titleElement = document.querySelector('h1, .activity-title')
  const title = normalizeWhitespace(titleElement?.textContent ?? null)

  if (!title) {
    console.warn('Mountaineers Assistant: Could not find activity title')
    return null
  }

  // Extract details from .program-core .details li elements
  const detailItems = Array.from(document.querySelectorAll('.program-core .details li'))

  let activityType: string | null = null
  let difficultyRating: string | null = null
  let leaderRating: string | null = null
  let startDate: Date | null = null
  let endDate: Date | null = null
  let location: string | null = null
  let registrationOpensAt: Date | null = null

  for (const item of detailItems) {
    const label = item.querySelector('label')
    const normalizedLabel = normalizeWhitespace(label?.textContent ?? '')
    if (!normalizedLabel) continue

    const labelText = normalizedLabel.replace(/:$/, '').toLowerCase()
    if (!labelText) continue

    // Clone the item and remove label to get just the value
    const clone = item.cloneNode(true) as HTMLElement
    const cloneLabel = clone.querySelector('label')
    if (cloneLabel) {
      cloneLabel.remove()
    }

    const value = normalizeWhitespace(clone.textContent ?? '')
    if (!value) continue

    // Map labels to fields
    if (labelText === 'activity type') {
      activityType = value
    } else if (labelText === 'difficulty') {
      difficultyRating = value
    } else if (labelText === 'leader rating') {
      leaderRating = value
    } else if (labelText === 'start date' || labelText === 'date') {
      startDate = parseDate(value)
    } else if (labelText === 'end date') {
      endDate = parseDate(value)
    } else if (labelText === 'location' || labelText === 'meeting place') {
      location = value
    } else if (labelText.includes('registration opens')) {
      registrationOpensAt = parseDate(value)
    }
  }

  // Default end date to start date if not specified (most activities are single-day)
  if (startDate && !endDate) {
    endDate = new Date(startDate)
  }

  // Determine if registration is open
  const isRegistrationOpen = determineRegistrationStatus()

  return {
    title,
    activityType,
    difficultyRating,
    leaderRating,
    startDate,
    endDate,
    location,
    registrationOpensAt,
    isRegistrationOpen,
    activityUrl: window.location.href,
  }
}

/**
 * Determine if registration is currently open based on page elements
 */
function determineRegistrationStatus(): boolean {
  // Look for "Registration Opens" text which indicates it's not open yet
  const bodyText = document.body.textContent?.toLowerCase() ?? ''
  if (bodyText.includes('registration opens')) {
    return false
  }

  // Look for "Register" or "Join Waitlist" buttons
  if (findButtonByText(['Register', 'Join Waitlist'])) {
    return true
  }

  // Look for "View Roster" which indicates user might be registered
  if (findButtonByText(['View Roster'])) {
    return true
  }

  // Default to true if we can't determine
  return true
}

/**
 * Find button or link element containing specific text
 */
function findButtonByText(textOptions: string[]): HTMLElement | null {
  const elements = document.querySelectorAll('button, a')
  for (const element of elements) {
    const text = element.textContent?.trim() ?? ''
    if (textOptions.some((option) => text.includes(option))) {
      return element as HTMLElement
    }
  }
  return null
}

/**
 * Normalize whitespace in text content
 * Reused from offscreen.ts
 */
function normalizeWhitespace(value: string | null): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned || null
}

/**
 * Parse date string into Date object
 * Handles various date formats from Mountaineers.org
 */
function parseDate(value: string): Date | null {
  if (!value) {
    return null
  }

  // Try parsing as ISO string first
  const isoDate = new Date(value)
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate
  }

  // Try common Mountaineers.org format: "Sat, Jan 20, 2024, 9:00 AM"
  // Remove day of week if present
  const withoutDayOfWeek = value.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*/i, '')

  const parsed = new Date(withoutDayOfWeek)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed
  }

  console.warn('Mountaineers Assistant: Could not parse date:', value)
  return null
}
