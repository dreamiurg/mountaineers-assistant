import type { Meta, StoryObj } from '@storybook/react';
import OptionsApp from './OptionsApp';
import sampleData from '../../data/sample-activities.json';
import type { ExtensionCache, ExtensionSettings } from '../shared/types';
import { createChromeMock } from '../stories/chromeMock';

const meta: Meta<typeof OptionsApp> = {
  title: 'Pages/Options',
  component: OptionsApp,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => {
      createChromeMock({
        data: sampleData as ExtensionCache,
        settings: {
          showAvatars: true,
          fetchLimit: 5,
        } as ExtensionSettings,
      });
      return (
        <div className="min-h-screen bg-brand-surfaceLight">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof OptionsApp>;

export const Default: Story = {
  render: () => <OptionsApp />,
};
