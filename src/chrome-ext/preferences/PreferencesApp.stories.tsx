import type { Meta, StoryObj } from '@storybook/react-webpack5'
import PreferencesApp from './PreferencesApp'
import '../preferences.css'
import sampleData from '../../data/sample-activities.json'
import type { ExtensionCache, ExtensionSettings } from '../shared/types'
import { createChromeMock } from '../stories/chromeMock'

const meta: Meta<typeof PreferencesApp> = {
  title: 'Pages/Preferences',
  component: PreferencesApp,
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
      })
      return <Story />
    },
  ],
}

export default meta

type Story = StoryObj<typeof PreferencesApp>

export const Default: Story = {
  render: () => <PreferencesApp />,
}
