/**
 * Generate RFC 5545 compliant iCalendar (.ics) files
 */

import type { CalendarEventData } from './types'

/**
 * Generate iCalendar file content for an event
 */
export function generateICS(event: CalendarEventData): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mountaineers Assistant//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${generateUID()}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(event.startDate)}`,
    `DTEND:${formatICSDate(event.endDate)}`,
    `SUMMARY:${escapeICS(event.title)}`,
  ]

  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`)
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`)
  }

  lines.push(`URL:${event.url}`, 'STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR')

  return lines.join('\r\n')
}

/**
 * Format Date object to iCalendar date-time format
 * Format: YYYYMMDDTHHMMSSZ (UTC)
 */
function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * Escape text for iCalendar format
 * RFC 5545 requires escaping: backslash, semicolon, comma, newline
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\') // Backslash must be escaped first
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '') // Remove carriage returns
}

/**
 * Generate unique identifier for calendar event
 * Format: timestamp-random@mountaineers-assistant
 */
function generateUID(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${random}@mountaineers-assistant`
}

/**
 * Trigger download of .ics file
 */
export function downloadICS(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate filename for .ics file based on event data
 */
export function generateICSFilename(eventTitle: string, startDate: Date): string {
  const dateStr = startDate.toISOString().split('T')[0] // YYYY-MM-DD
  const titleSlug = eventTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) // Limit length

  return `${dateStr}-${titleSlug}.ics`
}
