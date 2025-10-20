import type { ErrorLogEntry } from './types'

const GITHUB_REPO = 'dreamiurg/mountaineers-assistant'

/**
 * Generate GitHub issue URL with pre-filled error data
 */
export function generateGitHubIssueURL(error: ErrorLogEntry): string {
  const title = `[Auto-Report] Error in ${error.context}: ${sanitizeForTitle(error.message)}`
  const body = formatGitHubIssueBody(error)
  const labels = 'bug,auto-reported'

  const params = new URLSearchParams({
    title,
    body,
    labels,
  })

  return `https://github.com/${GITHUB_REPO}/issues/new?${params}`
}

/**
 * Sanitize error message for use in issue title
 */
function sanitizeForTitle(message: string): string {
  // Truncate to reasonable length
  const maxLength = 80
  const truncated = message.length > maxLength ? `${message.substring(0, maxLength)}...` : message

  // Remove newlines and extra whitespace
  return truncated.replace(/\s+/g, ' ').trim()
}

/**
 * Format error data as GitHub issue body
 */
export function formatGitHubIssueBody(error: ErrorLogEntry): string {
  const sections: string[] = []

  // Error Description
  sections.push('## Error Description')
  sections.push(error.message)
  sections.push('')

  // Steps to Reproduce
  sections.push('## Steps to Reproduce')
  sections.push('_Please describe what you were doing when this error occurred_')
  sections.push('')

  // Diagnostic Information
  sections.push('## Diagnostic Information')
  sections.push('')
  sections.push(`**Extension Version:** ${error.version}`)
  sections.push(`**Browser:** ${error.browser}`)
  sections.push(`**OS:** ${error.os}`)
  sections.push(`**Timestamp:** ${new Date(error.timestamp).toISOString()}`)
  sections.push(`**Context:** ${error.context}`)
  sections.push(`**Category:** ${error.category}`)

  if (error.occurrenceCount > 1) {
    sections.push(`**Occurrences:** ${error.occurrenceCount}`)
  }

  sections.push('')

  // Error Details
  if (error.stack) {
    sections.push('### Error Details')
    sections.push('```')
    sections.push(error.stack)
    sections.push('```')
    sections.push('')
  }

  // Additional Diagnostics
  if (Object.keys(error.diagnostics).length > 0) {
    sections.push('### Additional Diagnostics')
    sections.push('```json')
    sections.push(JSON.stringify(error.diagnostics, null, 2))
    sections.push('```')
    sections.push('')
  }

  // Footer
  sections.push('---')
  sections.push(
    '_This report was generated automatically by Mountaineers Assistant. All personal information has been removed._'
  )

  return sections.join('\n')
}

/**
 * Format error data for preview in modal
 */
export function formatErrorPreview(error: ErrorLogEntry): string {
  return formatGitHubIssueBody(error)
}
