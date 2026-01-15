/**
 * Create split button UI for calendar export
 * Split button = primary action button + dropdown for alternatives
 */

import { generateGoogleCalendarURL, generateOutlookCalendarURL } from './calendar-services'
import { downloadICS, generateICS, generateICSFilename } from './ics-generator'
import type { CalendarButtonConfig, CalendarService } from './types'

/**
 * Create split button element with dropdown
 */
export function createSplitButton(config: CalendarButtonConfig): HTMLElement {
  const container = document.createElement('div')
  container.className = 'ma-calendar-button-container'

  // Primary button (default action: download .ics)
  const primaryButton = document.createElement('button')
  primaryButton.className = 'ma-calendar-primary'
  primaryButton.textContent = config.primaryLabel
  primaryButton.type = 'button'

  primaryButton.addEventListener('click', (e) => {
    e.preventDefault()
    handlePrimaryAction(config)
  })

  // Dropdown toggle button
  const dropdownToggle = document.createElement('button')
  dropdownToggle.className = 'ma-calendar-dropdown-toggle'
  dropdownToggle.textContent = '▾'
  dropdownToggle.type = 'button'
  dropdownToggle.setAttribute('aria-label', 'More calendar options')

  // Dropdown menu
  const dropdown = document.createElement('div')
  dropdown.className = 'ma-calendar-dropdown'
  dropdown.hidden = true

  // Add dropdown options
  const options: Array<{ label: string; service: CalendarService }> = [
    { label: 'Google Calendar', service: 'google' },
    { label: 'Outlook', service: 'outlook' },
    { label: 'Apple Calendar', service: 'apple' },
    { label: 'Download .ics', service: 'ics' },
  ]

  for (const option of options) {
    const item = document.createElement('button')
    item.className = 'ma-calendar-dropdown-item'
    item.textContent = option.label
    item.type = 'button'

    item.addEventListener('click', (e) => {
      e.preventDefault()
      handleCalendarService(option.service, config)
      dropdown.hidden = true
    })

    dropdown.appendChild(item)
  }

  // Toggle dropdown on click
  dropdownToggle.addEventListener('click', (e) => {
    e.preventDefault()
    dropdown.hidden = !dropdown.hidden
  })

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target as Node)) {
      dropdown.hidden = true
    }
  })

  container.appendChild(primaryButton)
  container.appendChild(dropdownToggle)
  container.appendChild(dropdown)

  return container
}

/**
 * Handle primary button action (download .ics)
 */
function handlePrimaryAction(config: CalendarButtonConfig): void {
  const icsContent = generateICS(config.eventData)
  const filename = generateICSFilename(config.eventData.title, config.eventData.startDate)
  downloadICS(filename, icsContent)
}

/**
 * Handle calendar service selection
 */
function handleCalendarService(service: CalendarService, config: CalendarButtonConfig): void {
  switch (service) {
    case 'google': {
      const url = generateGoogleCalendarURL(config.eventData)
      window.open(url, '_blank', 'noopener,noreferrer')
      break
    }
    case 'outlook': {
      const url = generateOutlookCalendarURL(config.eventData)
      window.open(url, '_blank', 'noopener,noreferrer')
      break
    }
    case 'apple':
    case 'ics': {
      // Apple Calendar and generic .ics both download the file
      const icsContent = generateICS(config.eventData)
      const filename = generateICSFilename(config.eventData.title, config.eventData.startDate)
      downloadICS(filename, icsContent)
      break
    }
  }
}
