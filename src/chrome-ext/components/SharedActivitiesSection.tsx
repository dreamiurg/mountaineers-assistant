export interface SharedActivity {
  uid: string
  title: string
  date: string
  href: string
}

export interface SharedActivitiesSectionProps {
  activities: SharedActivity[]
  maxActivities?: number
}

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateString
  }
}

/**
 * Storybook-friendly component demonstrating the shared activities section
 * that is injected into mountaineers.org member profile pages.
 *
 * This renders as an inline section matching the site's existing style
 * (similar to COMMITTEES, COURSE BADGES sections).
 */
export function SharedActivitiesSection({
  activities,
  maxActivities = 5,
}: SharedActivitiesSectionProps) {
  if (activities.length === 0) {
    return null
  }

  const activitiesToShow = activities.slice(0, maxActivities)
  const remaining = activities.length - activitiesToShow.length

  return (
    <div className="ma-shared-section">
      <h3 className="ma-section-header">SHARED ACTIVITIES</h3>
      <p className="ma-section-subheader">
        Activities you've done together
        {remaining > 0 && ` (showing ${activitiesToShow.length} of ${activities.length})`}
      </p>

      <ul className="ma-activity-list">
        {activitiesToShow.map((activity) => (
          <li key={activity.uid} className="ma-activity-item">
            <a
              href={activity.href}
              className="ma-activity-link"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.preventDefault()}
            >
              <span className="ma-activity-title">{activity.title}</span>
              <span className="ma-activity-date">{formatDate(activity.date)}</span>
            </a>
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <div className="ma-view-all">
          <span className="ma-view-all-text">
            + {remaining} more shared {remaining === 1 ? 'activity' : 'activities'}
          </span>
        </div>
      )}

      <div className="ma-attribution">
        <span className="ma-attribution-icon">⛰️</span>
        <span className="ma-attribution-text">
          Powered by{' '}
          <a href="#" className="ma-attribution-link" onClick={(e) => e.preventDefault()}>
            Mountaineers Assistant
          </a>
        </span>
      </div>
    </div>
  )
}
