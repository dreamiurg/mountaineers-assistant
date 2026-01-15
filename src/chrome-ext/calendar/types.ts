/**
 * Calendar export types and interfaces
 */

export interface ActivityPageData {
  title: string | null
  activityType: string | null
  difficultyRating: string | null
  leaderRating: string | null
  startDate: Date | null
  endDate: Date | null
  location: string | null
  registrationOpensAt: Date | null
  isRegistrationOpen: boolean
  activityUrl: string
}

export interface CalendarEventData {
  title: string
  startDate: Date
  endDate: Date
  location: string | null
  description: string | null
  url: string
}

export interface CalendarButtonConfig {
  primaryAction: 'download-ics' | 'remind-to-register'
  primaryLabel: string
  primaryDate: string
  eventData: CalendarEventData
}

export type CalendarService = 'google' | 'outlook' | 'apple' | 'ics'

export interface CalendarServiceOption {
  label: string
  service: CalendarService
}
