import { useCallback, useEffect, useRef, useState } from 'react'
import { Footer } from '../components/Footer'
import { usePreferencesController } from './hooks/usePreferencesController'

export const PreferencesApp = () => {
  const {
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
  } = usePreferencesController()

  const refreshLabel = isRefreshing ? 'Refreshing…' : 'Refresh Cache View'
  const clearLabel = isClearing ? 'Clearing…' : 'Clear Cached Data'
  const saveLabel = isSaving ? 'Saving…' : 'Save Preferences'

  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'success' | 'error'>('idle')
  const copyResetRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current)
        copyResetRef.current = null
      }
    }
  }, [])

  const scheduleCopyReset = useCallback(() => {
    if (copyResetRef.current !== null) {
      window.clearTimeout(copyResetRef.current)
    }
    copyResetRef.current = window.setTimeout(() => {
      setCopyFeedback('idle')
      copyResetRef.current = null
    }, 2000)
  }, [])

  const handleCopyCache = useCallback(async () => {
    if (!navigator?.clipboard?.writeText) {
      setCopyFeedback('error')
      scheduleCopyReset()
      return
    }

    try {
      await navigator.clipboard.writeText(cacheContent ?? '')
      setCopyFeedback('success')
    } catch (error) {
      console.error('Mountaineers Assistant preferences: failed to copy cache', error)
      setCopyFeedback('error')
    } finally {
      scheduleCopyReset()
    }
  }, [cacheContent, scheduleCopyReset])

  const copyMessage =
    copyFeedback === 'success'
      ? 'Copied to clipboard.'
      : copyFeedback === 'error'
        ? 'Copy failed. Try again.'
        : ''

  const primaryButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-600/25 transition-colors hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-60'
  const dangerButtonClasses =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200/70 bg-rose-50/90 px-4 py-2 text-sm font-medium text-rose-600 shadow transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:pointer-events-none disabled:opacity-60'
  const controlLabelClasses = 'text-sm font-medium text-slate-800'
  const helperTextClasses = 'text-xs text-slate-500'

  return (
    <main className="relative min-h-screen text-slate-900">
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-0">
        <header className="space-y-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">
              Mountaineers Assistant
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Preferences</h1>
          </div>
        </header>

        <section className="space-y-6">
          <article className="glass-card space-y-6 rounded-2xl p-6">
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-slate-900">Display</h2>
            </div>
            <div className="space-y-5 text-sm text-slate-700">
              <label className="flex items-start gap-3">
                <input
                  id="toggle-avatars"
                  type="checkbox"
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-sky-600 transition focus:ring-sky-500"
                  checked={showAvatars}
                  onChange={(event) => setShowAvatars(event.target.checked)}
                />
                <span>
                  <span className={controlLabelClasses}>
                    Show user profile pictures on the&nbsp;
                    <a
                      href="insights.html"
                      className="text-sky-600 hover:text-sky-500"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Insights
                    </a>{' '}
                    page
                  </span>
                  <span className={`mt-1 block ${helperTextClasses}`}>
                    Toggle portraits for roster partners when they&rsquo;re available.
                  </span>
                </span>
              </label>
            </div>
            <div className="space-y-5 text-sm text-slate-700">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-slate-900">Debug</h2>
              </div>
              <div className="space-y-2">
                <label className={controlLabelClasses} htmlFor="fetch-limit-setting">
                  Fetch this many activities at a time
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="fetch-limit-setting"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    className="w-28 rounded-xl border border-slate-200/70 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/70"
                    placeholder="All"
                    value={fetchLimitInput}
                    onChange={(event) => setFetchLimitInput(event.target.value)}
                    onBlur={normalizeFetchLimitInput}
                  />
                  <span className={helperTextClasses}>Leave blank to fetch everything.</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={savePreferences}
                disabled={isSaving}
                className={primaryButtonClasses}
              >
                {saveLabel}
              </button>
            </div>
          </article>

          <article className="glass-card space-y-6 rounded-2xl p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-slate-900">Cached Activities Data</h2>
                <p className="text-sm text-slate-500">
                  Inspect the locally stored payload and manage when it updates.
                </p>
              </div>
              <div className="flex items-center gap-2" aria-live="polite">
                <button
                  type="button"
                  onClick={handleCopyCache}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  title="Copy cached data"
                  aria-label="Copy cached data"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M9 9V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4" />
                    <path d="M15 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h4" />
                  </svg>
                </button>
                {copyMessage ? <span className="text-xs text-slate-500">{copyMessage}</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={refreshCache}
                disabled={isRefreshing}
                className={primaryButtonClasses}
              >
                {refreshLabel}
              </button>
              <button
                type="button"
                onClick={clearCache}
                disabled={isClearing}
                className={dangerButtonClasses}
              >
                {clearLabel}
              </button>
            </div>
            <pre className="frosted-panel max-h-[520px] overflow-auto whitespace-pre-wrap rounded-2xl px-5 py-4 font-mono text-xs leading-relaxed text-slate-100">
              {cacheContent}
            </pre>
          </article>
        </section>

        <Footer />
      </div>
    </main>
  )
}

export default PreferencesApp
