const path = require('node:path')
const webpack = require('webpack')
const packageJson = require('../package.json')

/** @type {import('@storybook/react-webpack5').StorybookConfig} */
const config = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  webpackFinal: async (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, '..', 'src'),
    }
    config.module = config.module || {}
    config.module.rules = config.module.rules || []
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            ['@babel/preset-react', { runtime: 'automatic' }],
            ['@babel/preset-typescript', { allowDeclareFields: true }],
          ],
        },
      },
    })
    config.resolve.extensions = [...(config.resolve.extensions || []), '.ts', '.tsx']

    // Define __APP_VERSION__ for the Footer component
    config.plugins = config.plugins || []
    config.plugins.push(
      new webpack.DefinePlugin({
        __APP_VERSION__: JSON.stringify(packageJson.version),
      })
    )

    return config
  },
}

module.exports = config
