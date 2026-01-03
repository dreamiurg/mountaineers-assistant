const { resolve } = require('node:path')
const { defineConfig } = require('vite')
const { viteStaticCopy } = require('vite-plugin-static-copy')
const reactPlugin = require('@vitejs/plugin-react')
const tailwindcss = require('@tailwindcss/vite')
const packageJson = require('./package.json')

const chromeExtensionRoot = resolve(__dirname, 'src/chrome-ext')

module.exports = defineConfig({
  root: chromeExtensionRoot,
  publicDir: false,
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    tailwindcss.default(),
    reactPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.',
        },
        {
          src: 'vendor/**/*',
          dest: 'vendor',
        },
      ],
    }),
  ],
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(chromeExtensionRoot, 'background.ts'),
        offscreen: resolve(chromeExtensionRoot, 'offscreen.html'),
        preferences: resolve(chromeExtensionRoot, 'preferences.html'),
        insights: resolve(chromeExtensionRoot, 'insights.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo && assetInfo.name) {
            return assetInfo.name
          }
          return '[name][extname]'
        },
      },
    },
  },
  server: {
    open: false,
  },
})
