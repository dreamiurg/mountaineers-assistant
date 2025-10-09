import type { Meta, StoryObj } from '@storybook/react';
import PopupApp from './PopupApp';
import sampleData from '../../data/sample-activities.json';
import type { ExtensionCache } from '../shared/types';
import { createChromeMock } from '../stories/chromeMock';

const progressUpdates = [
  { delay: 100, stage: 'fetching-activities' },
  { delay: 500, stage: 'activities-collected', total: 3, completed: 0 },
  { delay: 900, stage: 'loading-details', total: 3, completed: 0 },
  { delay: 1300, stage: 'loading-roster', total: 3, completed: 0 },
  { delay: 1700, stage: 'loading-details', total: 3, completed: 1 },
  { delay: 2100, stage: 'loading-roster', total: 3, completed: 1 },
  { delay: 2500, stage: 'loading-details', total: 3, completed: 2 },
  { delay: 2900, stage: 'loading-roster', total: 3, completed: 2 },
  { delay: 3300, stage: 'finalizing', total: 3, completed: 3 },
] as const;

const meta: Meta<typeof PopupApp> = {
  title: 'Pages/Popup',
  component: PopupApp,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => {
      createChromeMock({
        data: sampleData as ExtensionCache,
        popupSummary: {
          activityCount: (sampleData as ExtensionCache).activities.length,
          lastUpdated: (sampleData as ExtensionCache).lastUpdated ?? new Date().toISOString(),
          newActivities: 3,
        },
        progressUpdates: progressUpdates.map((update) => ({ ...update })),
      });
      return (
        <div className="min-w-[320px]">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof PopupApp>;

export const Default: Story = {
  render: () => <PopupApp />,
};
