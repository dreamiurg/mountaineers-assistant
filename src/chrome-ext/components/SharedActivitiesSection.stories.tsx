import type { Meta, StoryObj } from '@storybook/react-webpack5'
import {
  SharedActivitiesSection,
  type SharedActivitiesSectionProps,
  type SharedActivity,
} from './SharedActivitiesSection'
import '../content-script.css'
import './SharedActivitiesSection.stories.css'

const meta: Meta<typeof SharedActivitiesSection> = {
  title: 'ContentScript/SharedActivitiesSection',
  component: SharedActivitiesSection,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
## Shared Activities Section

This section is injected into mountaineers.org member profile pages, appearing
as a native-looking section similar to COMMITTEES or COURSE BADGES.

### Features
- **Native Look**: Matches the site's orange headers and cyan links
- **Activity List**: Shows recent shared activities with dates
- **Truncation**: Shows up to 5 activities by default with a "more" indicator
- **Clickable Links**: Each activity links to its page on mountaineers.org
        `,
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof SharedActivitiesSection>

const sampleActivities: SharedActivity[] = [
  {
    uid: 'act-1',
    title: 'Intro to Alpine Climbing - Mount Rainier',
    date: '2024-06-15',
    href: 'https://www.mountaineers.org/activities/activity-1',
  },
  {
    uid: 'act-2',
    title: 'Basic Rock - Exit 38',
    date: '2024-05-22',
    href: 'https://www.mountaineers.org/activities/activity-2',
  },
  {
    uid: 'act-3',
    title: 'Navigation Field Trip - Tiger Mountain',
    date: '2024-04-10',
    href: 'https://www.mountaineers.org/activities/activity-3',
  },
]

/** Wrapper that simulates a mountaineers.org profile page */
function ProfilePageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="ma-profile-demo">
      <div className="ma-profile-card">
        {/* Simulated profile header */}
        <div className="ma-demo-header">
          <div className="ma-demo-avatar">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </div>
          <div className="ma-demo-info">
            <h1 className="ma-demo-name">Vienna Christensen</h1>
            <p className="ma-demo-meta">Pronouns: she/her</p>
            <p className="ma-demo-meta">
              Branch: <a href="#">Seattle</a>
            </p>
          </div>
        </div>

        {/* Simulated COMMITTEES section */}
        <div className="ma-demo-section">
          <h3 className="ma-demo-section-header">COMMITTEES</h3>
          <div className="ma-demo-section-content">
            <a href="#">
              <span className="arrow">▶</span> Mountaineers Leadership Development
            </a>
            <a href="#">
              <span className="arrow">▶</span> Snowshoe Council
            </a>
          </div>
        </div>

        {/* INJECTED: Shared Activities Section */}
        {children}

        {/* Simulated COURSE BADGES section */}
        <div className="ma-demo-section">
          <h3 className="ma-demo-section-header">COURSE BADGES</h3>
          <div className="ma-demo-badges">
            <div className="ma-demo-badge">
              <div className="ma-demo-badge-icon">GPS</div>
              <div className="ma-demo-badge-label">Basic GPS Course</div>
            </div>
            <div className="ma-demo-badge">
              <div className="ma-demo-badge-icon">NAV</div>
              <div className="ma-demo-badge-label">Basic Navigation Course</div>
            </div>
            <div className="ma-demo-badge">
              <div className="ma-demo-badge-icon">SAFE</div>
              <div className="ma-demo-badge-label">Emotional Safety Course</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Section with a few shared activities - the most common case
 */
export const InProfileContext: Story = {
  args: {
    activities: sampleActivities,
  },
  render: (args: SharedActivitiesSectionProps) => (
    <ProfilePageWrapper>
      <SharedActivitiesSection {...args} />
    </ProfilePageWrapper>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows the shared activities section as it would appear in a mountaineers.org profile page, between COMMITTEES and COURSE BADGES sections.',
      },
    },
  },
}

/**
 * Single shared activity
 */
export const SingleActivity: Story = {
  args: {
    activities: [sampleActivities[0]],
  },
  render: (args: SharedActivitiesSectionProps) => (
    <ProfilePageWrapper>
      <SharedActivitiesSection {...args} />
    </ProfilePageWrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'When you have just one shared activity with a member.',
      },
    },
  },
}

/**
 * Many activities (shows truncation)
 */
export const ManyActivities: Story = {
  args: {
    activities: [
      ...sampleActivities,
      {
        uid: 'act-4',
        title: 'Intermediate Alpine Climbing - Liberty Ridge',
        date: '2024-03-20',
        href: 'https://www.mountaineers.org/activities/activity-4',
      },
      {
        uid: 'act-5',
        title: 'Crevasse Rescue Practice - Paradise',
        date: '2024-02-28',
        href: 'https://www.mountaineers.org/activities/activity-5',
      },
      {
        uid: 'act-6',
        title: 'Snow Travel Skills - Snoqualmie Pass',
        date: '2024-01-15',
        href: 'https://www.mountaineers.org/activities/activity-6',
      },
      {
        uid: 'act-7',
        title: 'Winter Camping Fundamentals',
        date: '2023-12-10',
        href: 'https://www.mountaineers.org/activities/activity-7',
      },
      {
        uid: 'act-8',
        title: 'Avalanche Safety Course - AIARE Level 1',
        date: '2023-11-18',
        href: 'https://www.mountaineers.org/activities/activity-8',
      },
    ],
    maxActivities: 5,
  },
  render: (args: SharedActivitiesSectionProps) => (
    <ProfilePageWrapper>
      <SharedActivitiesSection {...args} />
    </ProfilePageWrapper>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'When there are many shared activities, only the first 5 are shown with a count of remaining activities.',
      },
    },
  },
}

/**
 * No shared activities (section is hidden)
 */
export const NoActivities: Story = {
  args: {
    activities: [],
  },
  render: (args: SharedActivitiesSectionProps) => (
    <ProfilePageWrapper>
      <SharedActivitiesSection {...args} />
      <div
        style={{
          padding: '12px 16px',
          background: '#fef3c7',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#92400e',
        }}
      >
        Note: When there are no shared activities, the section is not rendered at all.
      </div>
    </ProfilePageWrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'When there are no shared activities, the section is completely hidden.',
      },
    },
  },
}

/**
 * Standalone section (without profile context)
 */
export const Standalone: Story = {
  args: {
    activities: sampleActivities,
  },
  decorators: [
    (Story: React.ComponentType) => (
      <div style={{ padding: '20px', background: 'white', maxWidth: '500px' }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: 'The section component rendered standalone without the profile page wrapper.',
      },
    },
  },
}
