import type { Preview } from '@storybook/react-webpack5'

import '../src/chrome-ext/tailwind.css'
import '../src/chrome-ext/insights.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        app_surface: { name: 'App Surface', value: '#f8fafc' },
        dark: { name: 'Dark', value: '#020617' },
      },
    },
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },

  initialGlobals: {
    backgrounds: {
      value: 'app_surface',
    },
  },
}

export default preview
