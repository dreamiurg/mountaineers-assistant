import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ExtensionCache, ExtensionSettings } from '../../shared/types'

const STORAGE_KEY = 'mountaineersAssistantData'
const SETTINGS_KEY = 'mountaineersAssistantSettings'

const defaultSettings: ExtensionSettings = {
  showAvatars: true,
  fetchLimit: null,
}

interface PreferencesControllerState {
  statusMessage: string
  cacheContent: string
  showAvatars: boolean
  fetchLimitInput: string
  isRefreshing: boolean
  isClearing: boolean
  isSaving: boolean
}

interface PreferencesControllerActions {
  setShowAvatars: (value: boolean) => void
  setFetchLimitInput: (value: string) => void
  normalizeFetchLimitInput: () => void
  refreshCache: () => Promise<void>
  clearCache: () => Promise<void>
  savePreferences: () => Promise<void>
}

export const usePreferencesController = (): PreferencesControllerState &
  PreferencesControllerActions => {
  const [statusMessage, setStatusMessage] = useState<string>('Loading cached data…')
  const [cacheContent, setCacheContent] = useState<string>('// loading…')
  const [showAvatars, setShowAvatarsState] = useState<boolean>(defaultSettings.showAvatars)
  const [fetchLimitInput, setFetchLimitInputState] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isClearing, setIsClearing] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const setShowAvatars = useCallback((value: boolean) => {
    setShowAvatarsState(Boolean(value))
  }, [])

  const setFetchLimitInput = useCallback((value: string) => {
    setFetchLimitInputState(value)
  }, [])

  const normalizeFetchLimitInput = useCallback(() => {
    setFetchLimitInputState((current) => {
      const parsed = parseFetchLimit(current)
      if (parsed !== null) {
        return String(parsed)
      }
      if (!current.trim()) {
        return ''
      }
      return current
    })
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const stored = await chrome.storage.local.get(SETTINGS_KEY)
      const settings = normalizeSettings(stored?.[SETTINGS_KEY])
      setShowAvatarsState(Boolean(settings.showAvatars))
      setFetchLimitInputState(settings.fetchLimit ? String(settings.fetchLimit) : '')
      return settings
    } catch (error) {
      console.error('Mountaineers Assistant preferences: failed to load settings', error)
      setStatusMessage(error instanceof Error ? error.message : 'Unable to read saved preferences.')
      throw error
    }
  }, [])

  const loadCache = useCallback(async () => {
    setStatusMessage('Loading cached data…')
    setCacheContent('')

    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY)
      const payload = stored?.[STORAGE_KEY] as ExtensionCache | undefined

      if (!payload) {
        setStatusMessage(
          'No cached data found yet. Refresh activities from the Insights tab to populate this view.'
        )
        setCacheContent('// cache empty')
        return null
      }

      const summary = buildSummary(payload)
      setStatusMessage(summary)
      setCacheContent(JSON.stringify(payload, null, 2))
      return payload
    } catch (error) {
      console.error('Mountaineers Assistant preferences: failed to load cache', error)
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to read cached activity data.'
      )
      setCacheContent('// error loading cache')
      throw error
    }
  }, [])

  const refreshCache = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([loadCache(), loadSettings()])
    } catch {
      // Errors already reported inside helpers.
    } finally {
      setIsRefreshing(false)
    }
  }, [loadCache, loadSettings])

  const clearCache = useCallback(async () => {
    const confirmed = window.confirm(
      'Clearing the cache will remove all downloaded activities and related data. Do you want to continue?'
    )

    if (!confirmed) {
      return
    }

    setIsClearing(true)
    setStatusMessage('Clearing cached data…')
    try {
      await chrome.storage.local.remove(STORAGE_KEY)
      await loadCache()
      setStatusMessage('Cached data cleared.')
    } catch (error) {
      console.error('Mountaineers Assistant preferences: failed to clear cache', error)
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to clear cached activity data.'
      )
    } finally {
      setIsClearing(false)
    }
  }, [loadCache])

  const savePreferences = useCallback(async () => {
    const trimmed = fetchLimitInput.trim()
    const parsedLimit = parseFetchLimit(trimmed)

    if (trimmed && parsedLimit === null) {
      setStatusMessage('Enter a positive number or leave fetch limit blank to fetch everything.')
      return
    }

    setIsSaving(true)
    try {
      const stored = await chrome.storage.local.get(SETTINGS_KEY)
      const current = normalizeSettings(stored?.[SETTINGS_KEY])
      const next: ExtensionSettings = {
        ...current,
        showAvatars,
        fetchLimit: parsedLimit,
      }
      await chrome.storage.local.set({ [SETTINGS_KEY]: next })
      setStatusMessage('Preferences saved.')
      setFetchLimitInputState(parsedLimit ? String(parsedLimit) : '')
    } catch (error) {
      console.error('Mountaineers Assistant preferences: failed to save preferences', error)
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to save preferences right now.'
      )
    } finally {
      setIsSaving(false)
    }
  }, [fetchLimitInput, showAvatars])

  useEffect(() => {
    refreshCache()
  }, [refreshCache])

  useEffect(() => {
    const storageListener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName
    ) => {
      if (areaName !== 'local') {
        return
      }
      if (changes[STORAGE_KEY]) {
        loadCache().catch(() => {
          // Error already handled in loadCache.
        })
      }
      if (changes[SETTINGS_KEY]) {
        loadSettings().catch(() => {
          // Error already handled in loadSettings.
        })
      }
    }

    chrome.storage.onChanged.addListener(storageListener)
    return () => {
      chrome.storage.onChanged.removeListener(storageListener)
    }
  }, [loadCache, loadSettings])

  return useMemo(
    () => ({
      statusMessage,
      cacheContent,
      showAvatars,
      fetchLimitInput,
      isRefreshing,
      isClearing,
      isSaving,
      setShowAvatars,
      setFetchLimitInput,
      normalizeFetchLimitInput,
      refreshCache,
      clearCache,
      savePreferences,
    }),
    [
      cacheContent,
      clearCache,
      fetchLimitInput,
      isClearing,
      isRefreshing,
      isSaving,
      normalizeFetchLimitInput,
      refreshCache,
      savePreferences,
      setFetchLimitInput,
      setShowAvatars,
      showAvatars,
      statusMessage,
    ]
  )
}

function normalizeSettings(value: unknown): ExtensionSettings {
  if (!value || typeof value !== 'object') {
    return { ...defaultSettings }
  }
  const candidate = value as Partial<ExtensionSettings>
  const fetchLimit = candidate.fetchLimit ?? null
  return {
    showAvatars:
      typeof candidate.showAvatars === 'boolean'
        ? candidate.showAvatars
        : defaultSettings.showAvatars,
    fetchLimit:
      typeof fetchLimit === 'number' && Number.isFinite(fetchLimit) && fetchLimit > 0
        ? Math.floor(fetchLimit)
        : defaultSettings.fetchLimit,
  }
}

function parseFetchLimit(value: string): number | null {
  if (!value) {
    return null
  }
  const parsed = Number.parseInt(value.trim(), 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

function buildSummary(cache: ExtensionCache): string {
  const activityCount = Array.isArray(cache.activities) ? cache.activities.length : 0
  const peopleCount = Array.isArray(cache.people) ? cache.people.length : 0
  const rosterCount = Array.isArray(cache.rosterEntries) ? cache.rosterEntries.length : 0
  const lastUpdated = cache.lastUpdated ? formatTimestamp(cache.lastUpdated) : 'never'
  return `Cached ${activityCount} activities, ${peopleCount} people, ${rosterCount} roster entries — last refreshed ${lastUpdated}.`
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}
