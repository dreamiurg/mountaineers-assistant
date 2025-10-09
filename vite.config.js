const { resolve } = require('node:path');
const { defineConfig } = require('vite');
const { viteStaticCopy } = require('vite-plugin-static-copy');
const reactPlugin = require('@vitejs/plugin-react');

const chromeExtensionRoot = resolve(__dirname, 'src/chrome-ext');

module.exports = defineConfig({
  root: chromeExtensionRoot,
  publicDir: false,
  plugins: [
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
        collect: resolve(chromeExtensionRoot, 'collect.ts'),
        popup: resolve(chromeExtensionRoot, 'popup.html'),
        preferences: resolve(chromeExtensionRoot, 'preferences.html'),
        insights: resolve(chromeExtensionRoot, 'insights.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo && assetInfo.name) {
            return assetInfo.name;
          }
          return '[name][extname]';
        },
      },
    },
  },
  server: {
    open: false,
  },
});
