import type { Meta, StoryObj } from '@storybook/react';
import PopupApp from './PopupApp';
import sampleData from '../../data/sample-activities.json';
import type { ExtensionCache } from '../shared/types';
import { createChromeMock } from '../stories/chromeMock';

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
          newActivities: 2,
        },
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
