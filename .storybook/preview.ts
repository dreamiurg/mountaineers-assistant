import type { Preview } from '@storybook/react';

import '../src/chrome-ext/styles/tailwind.input.css';
import '../src/chrome-ext/insights.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'App Surface',
      values: [
        { name: 'App Surface', value: '#f8fafc' },
        { name: 'Dark', value: '#020617' },
      ],
    },
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
