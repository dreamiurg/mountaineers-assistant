/**
 * Generate calendar service URLs for Google Calendar, Outlook, etc.
 */

import type { CalendarEventData } from './types'

/**
 * Generate Google Calendar URL
 * https://calendar.google.com/calendar/render?action=TEMPLATE&...
 */
export function generateGoogleCalendarURL(event: CalendarEventData): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(event.endDate)}`,
  })

  if (event.location) {
    params.set('location', event.location)
  }

  if (event.description) {
    params.set('details', event.description)
  }

  // Always include URL in description
  const descriptionWithUrl = event.description ? `${event.description}\n\n${event.url}` : event.url
  params.set('details', descriptionWithUrl)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Generate Outlook Calendar URL
 * https://outlook.live.com/calendar/0/deeplink/compose?...
 */
export function generateOutlookCalendarURL(event: CalendarEventData): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.startDate.toISOString(),
    enddt: event.endDate.toISOString(),
  })

  if (event.location) {
    params.set('location', event.location)
  }

  // Outlook uses 'body' for description
  const descriptionWithUrl = event.description ? `${event.description}\n\n${event.url}` : event.url
  params.set('body', descriptionWithUrl)

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

/**
 * Format date for Google Calendar
 * Format: YYYYMMDDTHHmmssZ (UTC)
 */
function formatGoogleDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}
