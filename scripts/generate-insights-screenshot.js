#!/usr/bin/env node

const { execSync } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require('playwright')

const STORAGE_KEY = 'mountaineersAssistantData'
const SETTINGS_KEY = 'mountaineersAssistantSettings'
const ACTIVE_TAB_URL = 'https://www.mountaineers.org/my-dashboard'

const repoRoot = path.resolve(__dirname, '..')
const distDir = path.join(repoRoot, 'dist')
const sampleDataPath = path.join(repoRoot, 'src', 'data', 'sample-activities.json')
const outputDir = path.join(repoRoot, 'artifacts')
const outputPath = path.join(outputDir, 'insights-1280x800.png')

function runBuild() {
  console.log('Building extension bundle (npm run build)…')
  execSync('npm run build', {
    stdio: 'inherit',
    cwd: repoRoot,
  })
}

async function seedExtensionStorage(serviceWorker, payload) {
  await serviceWorker.evaluate(
    async ({ storageKey, settingsKey, cache, settings }) => {
      // biome-ignore lint/correctness/noUndeclaredVariables: chrome is injected by the MV3 execution context
      await chrome.storage.local.set({
        [storageKey]: cache,
        [settingsKey]: settings,
      })
    },
    {
      storageKey: STORAGE_KEY,
      settingsKey: SETTINGS_KEY,
      cache: payload.cache,
      settings: payload.settings,
    }
  )
}

async function applyChromeStubs(context, payload) {
  await context.addInitScript(
    ({ activeTabUrl, summaryPayload, cachePayload, settingsPayload, storageKey, settingsKey }) => {
      const applyStubs = () => {
        const chromeApi = globalThis.chrome
        if (!chromeApi) {
          return false
        }

        const clone = (value) => {
          if (typeof structuredClone === 'function') {
            return structuredClone(value)
          }
          return JSON.parse(JSON.stringify(value))
        }

        let cacheState = clone(cachePayload)
        let settingsState = clone(settingsPayload)

        const storageListeners = []

        if (
          chromeApi.storage &&
          chromeApi.storage.onChanged &&
          chromeApi.storage.onChanged.addListener &&
          !chromeApi.storage.onChanged.addListener.__maStubbed
        ) {
          const originalAdd = chromeApi.storage.onChanged.addListener.bind(
            chromeApi.storage.onChanged
          )
          const wrappedAdd = (listener) => {
            storageListeners.push(listener)
            return originalAdd(listener)
          }
          Object.defineProperty(wrappedAdd, '__maStubbed', {
            value: true,
            configurable: false,
            enumerable: false,
            writable: false,
          })
          Object.defineProperty(chromeApi.storage.onChanged, 'addListener', {
            configurable: true,
            value: wrappedAdd,
          })
        }

        const emitStorageChange = (key, newValue, oldValue) => {
          if (!storageListeners.length) {
            return
          }
          const change = {
            [key]: {
              newValue,
              oldValue,
            },
          }
          for (const listener of storageListeners) {
            try {
              listener(change, 'local')
            } catch (error) {
              console.warn('Mountaineers Assistant stub: storage listener error', error)
            }
          }
        }

        const stubTab = {
          id: 1,
          index: 0,
          windowId: 1,
          highlighted: true,
          active: true,
          pinned: false,
          incognito: false,
          url: activeTabUrl,
        }

        if (chromeApi.tabs && chromeApi.tabs.query && !chromeApi.tabs.query.__maStubbed) {
          const originalQuery = chromeApi.tabs.query.bind(chromeApi.tabs)
          const stubbedQuery = (queryInfo, callback) => {
            if (queryInfo && queryInfo.active && queryInfo.currentWindow) {
              const result = [stubTab]
              if (typeof callback === 'function') {
                callback(result)
                return undefined
              }
              return Promise.resolve(result)
            }
            return originalQuery(queryInfo, callback)
          }
          Object.defineProperty(stubbedQuery, '__maStubbed', {
            value: true,
            configurable: false,
            enumerable: false,
            writable: false,
          })
          Object.defineProperty(chromeApi.tabs, 'query', {
            configurable: true,
            value: stubbedQuery,
          })
        }

        if (
          chromeApi.runtime &&
          chromeApi.runtime.sendMessage &&
          !chromeApi.runtime.sendMessage.__maStubbed
        ) {
          const originalSendMessage = chromeApi.runtime.sendMessage.bind(chromeApi.runtime)
          const stubbedSendMessage = (message, optionsOrCallback, maybeCallback) => {
            const callback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
            const payload = message || {}
            if (payload.type === 'get-refresh-status') {
              if (typeof callback === 'function') {
                callback({ success: true, inProgress: false })
              }
              return undefined
            }
            if (payload.type === 'start-refresh') {
              if (typeof callback === 'function') {
                callback({
                  success: true,
                  summary: summaryPayload,
                })
              }
              return undefined
            }
            return originalSendMessage(message, optionsOrCallback, maybeCallback)
          }
          Object.defineProperty(stubbedSendMessage, '__maStubbed', {
            value: true,
            configurable: false,
            enumerable: false,
            writable: false,
          })
          Object.defineProperty(chromeApi.runtime, 'sendMessage', {
            configurable: true,
            value: stubbedSendMessage,
          })
        }

        if (
          chromeApi.storage &&
          chromeApi.storage.local &&
          chromeApi.storage.local.get &&
          !chromeApi.storage.local.get.__maStubbed
        ) {
          const originalGet = chromeApi.storage.local.get.bind(chromeApi.storage.local)
          const originalSet = chromeApi.storage.local.set.bind(chromeApi.storage.local)
          const originalRemove = chromeApi.storage.local.remove.bind(chromeApi.storage.local)
          const originalClear = chromeApi.storage.local.clear.bind(chromeApi.storage.local)

          const resolveKeys = (keys) => {
            if (!keys) {
              return [storageKey, settingsKey]
            }
            if (typeof keys === 'string') {
              return [keys]
            }
            if (Array.isArray(keys)) {
              return keys
            }
            return Object.keys(keys)
          }

          const stubbedGet = (keys) => {
            const requested = resolveKeys(keys)
            const touchesManagedKeys = requested.some(
              (key) => key === storageKey || key === settingsKey
            )
            if (!touchesManagedKeys) {
              return originalGet(keys)
            }
            const result = {}
            for (const key of requested) {
              if (key === storageKey) {
                result[key] = clone(cacheState)
              } else if (key === settingsKey) {
                result[key] = clone(settingsState)
              }
            }
            if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
              for (const [fallbackKey, fallbackValue] of Object.entries(keys)) {
                if (!(fallbackKey in result)) {
                  result[fallbackKey] = fallbackValue
                }
              }
            }
            return Promise.resolve(result)
          }

          const stubbedSet = (items) => {
            let updated = false
            if (Object.hasOwn(items, storageKey)) {
              const previous = clone(cacheState)
              const nextValue = items[storageKey] == null ? null : clone(items[storageKey])
              cacheState = nextValue
              emitStorageChange(storageKey, clone(cacheState), previous)
              updated = true
            }
            if (Object.hasOwn(items, settingsKey)) {
              const previous = clone(settingsState)
              const nextSettings = items[settingsKey]
              settingsState = {
                ...clone(settingsPayload),
                ...(nextSettings ? clone(nextSettings) : {}),
              }
              emitStorageChange(settingsKey, clone(settingsState), previous)
              updated = true
            }
            if (!updated) {
              return originalSet(items)
            }
            return Promise.resolve()
          }

          const stubbedRemove = (keys) => {
            const requested = resolveKeys(keys)
            let touched = false
            if (requested.includes(storageKey)) {
              const previous = clone(cacheState)
              cacheState = null
              emitStorageChange(storageKey, null, previous)
              touched = true
            }
            if (requested.includes(settingsKey)) {
              const previous = clone(settingsState)
              settingsState = clone(settingsPayload)
              emitStorageChange(settingsKey, clone(settingsState), previous)
              touched = true
            }
            if (!touched) {
              return originalRemove(keys)
            }
            return Promise.resolve()
          }

          const stubbedClear = () => {
            const prevCache = clone(cacheState)
            const prevSettings = clone(settingsState)
            cacheState = null
            settingsState = clone(settingsPayload)
            emitStorageChange(storageKey, null, prevCache)
            emitStorageChange(settingsKey, clone(settingsState), prevSettings)
            return originalClear()
          }

          Object.defineProperty(stubbedGet, '__maStubbed', {
            value: true,
            configurable: false,
            enumerable: false,
            writable: false,
          })

          Object.assign(chromeApi.storage.local, {
            get: stubbedGet,
            set: stubbedSet,
            remove: stubbedRemove,
            clear: stubbedClear,
          })
        }

        return true
      }

      if (!applyStubs()) {
        const interval = setInterval(() => {
          if (applyStubs()) {
            clearInterval(interval)
          }
        }, 10)
      }
    },
    {
      activeTabUrl: ACTIVE_TAB_URL,
      summaryPayload: payload.summary,
      cachePayload: payload.cache,
      settingsPayload: payload.settings,
      storageKey: STORAGE_KEY,
      settingsKey: SETTINGS_KEY,
    }
  )
}

async function ensureOutputDir() {
  await fs.mkdir(outputDir, { recursive: true })
}

async function loadSampleData() {
  const rawData = await fs.readFile(sampleDataPath, 'utf8')
  const fixture = JSON.parse(rawData)
  const activities = Array.isArray(fixture.activities) ? fixture.activities : []
  const people = Array.isArray(fixture.people) ? fixture.people : []
  const rosterEntries = Array.isArray(fixture.rosterEntries) ? fixture.rosterEntries : []
  const lastUpdated = typeof fixture.lastUpdated === 'string' ? fixture.lastUpdated : null
  const currentUserUid = typeof fixture.currentUserUid === 'string' ? fixture.currentUserUid : null

  return {
    cache: {
      activities,
      people,
      rosterEntries,
      lastUpdated,
      currentUserUid,
    },
    settings: {
      showAvatars: true,
      fetchLimit: 25,
    },
    summary: {
      activityCount: activities.length,
      lastUpdated,
      newActivities: 0,
    },
  }
}

async function createScreenshot(context, extensionId) {
  const page = await context.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/insights.html`, {
    waitUntil: 'networkidle',
  })
  await page.waitForSelector('text=Activity Insights Dashboard', { state: 'visible' })
  await page.waitForSelector('text=Recent activities', { state: 'visible' })

  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }
      body { scrollbar-width: none; }
      body::-webkit-scrollbar { display: none; }
    `,
  })

  await page.screenshot({
    path: outputPath,
    type: 'png',
    omitBackground: false,
    fullPage: false,
  })
  await page.close()
}

async function main() {
  runBuild()

  const samplePayload = await loadSampleData()
  await ensureOutputDir()

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ma-screenshot-'))
  let context
  try {
    context = await chromium.launchPersistentContext(tempRoot, {
      channel: 'chromium',
      headless: true,
      args: [
        '--headless=new',
        `--disable-extensions-except=${distDir}`,
        `--load-extension=${distDir}`,
        '--disable-sync',
        '--disable-features=DialMediaRouteProvider',
      ],
    })

    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (
        url.startsWith('chrome-extension://') ||
        url.startsWith('devtools://') ||
        url.startsWith('about:') ||
        url.startsWith('data:') ||
        url.startsWith('file:')
      ) {
        route.continue()
        return
      }
      route.abort()
    })

    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker')
    }

    await seedExtensionStorage(serviceWorker, samplePayload)
    await applyChromeStubs(context, samplePayload)

    const extensionUrl = new URL(serviceWorker.url())
    const extensionId = extensionUrl.hostname

    await createScreenshot(context, extensionId)
    console.log(`Saved screenshot to ${path.relative(repoRoot, outputPath)}`)
  } finally {
    if (context) {
      await context.close()
    }
    try {
      await fs.rm(tempRoot, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to clean up temporary profile directory:', error)
    }
  }
}

main().catch((error) => {
  console.error('\nFailed to generate insights screenshot:\n', error)
  process.exitCode = 1
})
