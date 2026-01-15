/**
 * Inject calendar export button into activity pages
 */

import { createSplitButton } from './split-button'
import type { ActivityPageData, CalendarButtonConfig, CalendarEventData } from './types'

/**
 * Inject calendar button into activity page
 */
export function injectCalendarButton(activityData: ActivityPageData): void {
  // Find insertion point near action buttons
  const insertionPoint = findInsertionPoint()
  if (!insertionPoint) {
    console.warn('Mountaineers Assistant: Could not find insertion point for calendar button')
    return
  }

  // Build calendar button configuration
  const config = buildButtonConfig(activityData)
  if (!config) {
    console.warn('Mountaineers Assistant: Could not build calendar button config')
    return
  }

  // Create and inject button
  const button = createSplitButton(config)
  insertionPoint.appendChild(button)

  console.info('Mountaineers Assistant: Calendar button injected')
}

/**
 * Find insertion point for calendar button
 * Looks for action button containers near registration/roster buttons
 */
function findInsertionPoint(): HTMLElement | null {
  // Try to find existing action button container
  const selectors = [
    '.activity-actions', // Common action button container
    '.program-core .actions', // Program core actions
    '.register-actions', // Registration button area
    'div:has(> button:contains("Register"))', // Div containing register button
    'div:has(> a:contains("Register"))', // Div containing register link
    'div:has(> button:contains("View Roster"))', // Div containing roster button
  ]

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector)
      if (element instanceof HTMLElement) {
        return element
      }
    } catch {
      // :has() might not be supported in all browsers, continue
    }
  }

  // Fallback: create wrapper after .program-core .details
  const programCore = document.querySelector('.program-core')
  if (programCore) {
    const wrapper = document.createElement('div')
    wrapper.className = 'ma-calendar-actions'
    programCore.appendChild(wrapper)
    return wrapper
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
