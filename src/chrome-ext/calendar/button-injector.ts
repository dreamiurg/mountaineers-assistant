/**
 * Inject calendar export button into activity pages
 */

import { createInlineCalendarLinks } from './split-button'
import type { ActivityPageData, CalendarButtonConfig, CalendarEventData } from './types'

/**
 * Inject calendar button into activity page
 */
export function injectCalendarButton(activityData: ActivityPageData): void {
  // Build calendar button configuration
  const config = buildButtonConfig(activityData)
  if (!config) {
    console.warn('Mountaineers Assistant: Could not build calendar button config')
    return
  }

  // Find insertion point based on registration status
  const insertionPoint = findInsertionPoint(activityData)
  if (!insertionPoint) {
    console.warn('Mountaineers Assistant: Could not find insertion point for calendar button')
    return
  }

  // Create and inject inline calendar links
  const calendarLinks = createInlineCalendarLinks(config)
  insertionPoint.appendChild(calendarLinks)

  console.info('Mountaineers Assistant: Calendar links injected')
}

/**
 * Find insertion point for calendar links
 * Places links inline with the date or registration open information
 */
function findInsertionPoint(activityData: ActivityPageData): HTMLElement | null {
  // Strategy: Find the line that shows the activity date or registration open date
  // and insert our calendar links right after it

  // If registration is not open yet, look for "Registration Open:" line
  if (!activityData.isRegistrationOpen && activityData.registrationOpensAt) {
    const regOpenElements = Array.from(
      document.querySelectorAll('p, div, li, dt, dd, span, .detail-item, .info-item')
    )

    for (const el of regOpenElements) {
      const text = el.textContent?.trim() || ''
      if (text.match(/Registration Open:/i)) {
        // Found the registration open line
        const wrapper = document.createElement('span')
        wrapper.className = 'ma-calendar-inline-wrapper'
        wrapper.textContent = ' '
        el.appendChild(wrapper)
        return wrapper
      }
    }
  }

  // Otherwise, look for the activity date line (usually at the top of the activity details)
  // Look for date patterns like "Wed, Sep 16, 2026" or similar
  const dateElements = Array.from(
    document.querySelectorAll('p, div, li, dt, dd, span, .detail-item, .info-item, .date')
  )

  for (const el of dateElements) {
    const text = el.textContent?.trim() || ''
    // Match common date patterns
    if (text.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\w+\s+\d{1,2},?\s+\d{4}/)) {
      // Found a date line
      const wrapper = document.createElement('span')
      wrapper.className = 'ma-calendar-inline-wrapper'
      wrapper.textContent = ' '
      el.appendChild(wrapper)
      return wrapper
    }
  }

  // Fallback: look for any element with the date text
  if (activityData.startDate) {
    const dateStr = activityData.startDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    for (const el of dateElements) {
      if (el.textContent?.includes(dateStr)) {
        const wrapper = document.createElement('span')
        wrapper.className = 'ma-calendar-inline-wrapper'
        wrapper.textContent = ' '
        el.appendChild(wrapper)
        return wrapper
      }
    }
  }

  return null
}

/**
 * Build calendar button configuration from activity data
 */
function buildButtonConfig(activityData: ActivityPageData): CalendarButtonConfig | null {
  // Decide between activity event or registration reminder
  if (!activityData.isRegistrationOpen && activityData.registrationOpensAt) {
    // Registration not open yet - create reminder
    return buildRegistrationReminderConfig(activityData)
  }

  // Registration open or user registered - create activity event
  return buildActivityEventConfig(activityData)
}

/**
 * Build configuration for registration reminder
 */
function buildRegistrationReminderConfig(
  activityData: ActivityPageData
): CalendarButtonConfig | null {
  if (!activityData.registrationOpensAt || !activityData.title) {
    return null
  }

  const title = `Register: ${activityData.title}`
  const startDate = activityData.registrationOpensAt
  // Set reminder duration to 30 minutes
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)

  const eventData: CalendarEventData = {
    title,
    startDate,
    endDate,
    location: 'Online - Mountaineers.org',
    description: `Registration opens for ${activityData.title}`,
    url: activityData.activityUrl,
  }

  const dateStr = formatDateForLabel(startDate)

  return {
    primaryAction: 'remind-to-register',
    primaryLabel: `Remind Me to Register (${dateStr})`,
    primaryDate: dateStr,
    eventData,
  }
}

/**
 * Build configuration for activity event
 */
function buildActivityEventConfig(activityData: ActivityPageData): CalendarButtonConfig | null {
  if (!activityData.startDate || !activityData.endDate || !activityData.title) {
    return null
  }

  // Build event title with activity type if available
  const title = activityData.activityType
    ? `[${activityData.activityType}] ${activityData.title}`
    : activityData.title

  // Build description
  const descriptionParts: string[] = []
  if (activityData.difficultyRating) {
    descriptionParts.push(`Difficulty: ${activityData.difficultyRating}`)
  }
  if (activityData.leaderRating) {
    descriptionParts.push(`Leader Rating: ${activityData.leaderRating}`)
  }

  const eventData: CalendarEventData = {
    title,
    startDate: activityData.startDate,
    endDate: activityData.endDate,
    location: activityData.location,
    description: descriptionParts.length > 0 ? descriptionParts.join(' | ') : null,
    url: activityData.activityUrl,
  }

  const dateStr = formatDateRangeForLabel(activityData.startDate, activityData.endDate)

  return {
    primaryAction: 'download-ics',
    primaryLabel: `Add to Calendar (${dateStr})`,
    primaryDate: dateStr,
    eventData,
  }
}

/**
 * Format date for button label (e.g., "Jan 20, 9:00 AM")
 */
function formatDateForLabel(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format date range for button label (e.g., "Jan 20-22" or "Jan 20")
 */
function formatDateRangeForLabel(startDate: Date, endDate: Date): string {
  const isSameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate()

  if (isSameDay) {
    return startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const isSameMonth =
    startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()

  if (isSameMonth) {
    const month = startDate.toLocaleDateString('en-US', { month: 'short' })
    const startDay = startDate.getDate()
    const endDay = endDate.getDate()
    return `${month} ${startDay}-${endDay}`
  }

  // Different months
  const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${start} - ${end}`
}
