import { parseActivityPage } from './calendar/activity-parser'
import { injectCalendarButton } from './calendar/button-injector'

interface SharedActivity {
  uid: string
  title: string
  date: string
  href: string
}

const MAX_ACTIVITIES_TO_SHOW = 5

enum PageType {
  MemberProfile,
  Activity,
  Unknown,
}

async function init(): Promise<void> {
  const pageType = detectPageType()

  switch (pageType) {
    case PageType.MemberProfile:
      await initMemberProfileFeatures()
      break
    case PageType.Activity:
      initActivityPageFeatures()
      break
    case PageType.Unknown:
      // Not a page we handle
      break
  }
}

function detectPageType(): PageType {
  const pathname = window.location.pathname

  // Check for member profile page
  if (pathname.match(/^\/members\/[^/?#]+/)) {
    return PageType.MemberProfile
  }

  // Check for activity page
  if (pathname.match(/^\/activities\/[^/?#]+/) || pathname.includes('/climb/')) {
    return PageType.Activity
  }

  return PageType.Unknown
}

async function initMemberProfileFeatures(): Promise<void> {
  const memberUid = extractMemberUidFromUrl()
  if (!memberUid) {
    return
  }

  const response = await chrome.runtime.sendMessage({
    type: 'get-shared-activities',
    memberUid,
  })

  if (!response || !response.activities || response.activities.length === 0) {
    return
  }

  const activities: SharedActivity[] = response.activities
  injectSharedActivitiesSection(activities, memberUid)
}

function initActivityPageFeatures(): void {
  const activityData = parseActivityPage()
  if (!activityData) {
    console.warn('Mountaineers Assistant: Could not parse activity page')
    return
  }

  injectCalendarButton(activityData)
}

function extractMemberUidFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/members\/([^/?#]+)/)
  return match ? match[1] : null
}

function injectSharedActivitiesSection(activities: SharedActivity[], memberUid: string): void {
  // Find the insertion point - after COMMITTEES section or before COURSE BADGES
  const insertionPoint = findInsertionPoint()
  if (!insertionPoint) {
    console.warn('Mountaineers Assistant: Could not find insertion point for shared activities')
    return
  }

  const section = createSharedActivitiesSection(activities, memberUid)
  insertionPoint.parentElement?.insertBefore(section, insertionPoint)
}

function findInsertionPoint(): Element | null {
  // Look for section headers to find the right spot
  // We want to insert after email/contact info section, before COURSE BADGES
  const allHeaders = document.querySelectorAll('h2, h3, .profile-section-header')

  // First, try to find the COURSE BADGES section and insert before it
  for (const header of allHeaders) {
    const text = header.textContent?.trim().toUpperCase() || ''
    if (text.includes('COURSE BADGES')) {
      return header
    }
  }

  // Fallback: look for email link and insert after it
  const emailLink = document.querySelector('a[href^="mailto:"]')
  if (emailLink) {
    // Find the containing element (usually a div or paragraph)
    const container = emailLink.closest('div, p, li')
    if (container?.nextElementSibling) {
      return container.nextElementSibling
    }
  }

  // Another fallback: look for the committees section and insert after it
  for (const header of allHeaders) {
    const text = header.textContent?.trim().toUpperCase() || ''
    if (text.includes('COMMITTEES')) {
      // Find the next sibling section
      let sibling = header.nextElementSibling
      while (sibling && !sibling.matches('h2, h3, .profile-section-header')) {
        sibling = sibling.nextElementSibling
      }
      if (sibling) {
        return sibling
      }
    }
  }

  // Last fallback: find the main content area and append there
  const mainContent = document.querySelector('.profile-wrapper article, article, .member-profile')
  if (mainContent) {
    // Create a marker element at the end
    const marker = document.createElement('div')
    mainContent.appendChild(marker)
    return marker
  }

  return null
}

function createSharedActivitiesSection(
  activities: SharedActivity[],
  memberUid: string
): HTMLElement {
  const section = document.createElement('div')
  section.className = 'ma-shared-section'

  // Header matching mountaineers.org style
  const header = document.createElement('h3')
  header.className = 'ma-section-header'
  header.textContent = 'SHARED ACTIVITIES'
  section.appendChild(header)

  // Subheader with context
  const subheader = document.createElement('p')
  subheader.className = 'ma-section-subheader'
  const activitiesToShow = activities.slice(0, MAX_ACTIVITIES_TO_SHOW)
  const remaining = activities.length - activitiesToShow.length
  subheader.textContent = `Activities you've done together${remaining > 0 ? ` (showing ${activitiesToShow.length} of ${activities.length})` : ''}`
  section.appendChild(subheader)

  // Build URL for insights page with partner filter
  const insightsUrl = chrome.runtime.getURL(
    `insights.html?partner=${encodeURIComponent(memberUid)}`
  )

  // Activity list
  const list = document.createElement('ul')
  list.className = 'ma-activity-list'

  for (const activity of activitiesToShow) {
    const item = document.createElement('li')
    item.className = 'ma-activity-item'

    const link = document.createElement('a')
    link.href = activity.href
    link.className = 'ma-activity-link'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'

    const title = document.createElement('span')
    title.className = 'ma-activity-title'
    title.textContent = activity.title

    const date = document.createElement('span')
    date.className = 'ma-activity-date'
    date.textContent = formatDate(activity.date)

    link.appendChild(title)
    link.appendChild(date)
    item.appendChild(link)
    list.appendChild(item)
  }

  section.appendChild(list)

  // "View all" link if there are more activities
  if (remaining > 0) {
    const viewAll = document.createElement('div')
    viewAll.className = 'ma-view-all'
    viewAll.innerHTML = `<a href="${insightsUrl}" target="_blank" rel="noopener noreferrer" class="ma-view-all-link">+ ${remaining} more shared ${remaining === 1 ? 'activity' : 'activities'}</a>`
    section.appendChild(viewAll)
  }

  // Attribution footer with extension icon
  const attribution = document.createElement('div')
  attribution.className = 'ma-attribution'
  const dashboardUrl = chrome.runtime.getURL('insights.html')
  const iconUrl = chrome.runtime.getURL('icons/icon16.png')

  const icon = document.createElement('img')
  icon.src = iconUrl
  icon.className = 'ma-attribution-icon'
  icon.alt = 'Mountaineers Assistant'
  icon.width = 16
  icon.height = 16

  const text = document.createElement('span')
  text.className = 'ma-attribution-text'
  text.innerHTML = `Powered by <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" class="ma-attribution-link">Mountaineers Assistant</a>`

  attribution.appendChild(icon)
  attribution.appendChild(text)
  section.appendChild(attribution)

  return section
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) {
      return 'Invalid Date'
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return dateString
  }
}

init().catch((error) => {
  console.error('Mountaineers Assistant content script error:', error)
})
