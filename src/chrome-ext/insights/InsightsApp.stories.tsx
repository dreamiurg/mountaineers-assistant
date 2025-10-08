import type { Meta, StoryObj } from '@storybook/react';
import Highcharts from 'highcharts';
import InsightsApp from './InsightsApp';
import sampleData from '../../data/sample-activities.json';
import type { ExtensionCache, ExtensionSettings } from '../shared/types';
import { createChromeMock } from '../stories/chromeMock';

const meta: Meta<typeof InsightsApp> = {
  title: 'Pages/Insights',
  component: InsightsApp,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => {
      (window as typeof window & { Highcharts?: typeof Highcharts }).Highcharts = Highcharts;

      createChromeMock({
        data: sampleData as ExtensionCache,
        settings: {
          showAvatars: true,
          fetchLimit: null,
        } as ExtensionSettings,
      });

      return (
        <div className="min-h-screen bg-slate-50">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof InsightsApp>;

export const Default: Story = {
  render: () => <InsightsApp />,
};
