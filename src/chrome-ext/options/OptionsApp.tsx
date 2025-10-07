import { useOptionsController } from './hooks/useOptionsController';

export const OptionsApp = () => {
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
  } = useOptionsController();

  const refreshLabel = isRefreshing ? 'Refreshing…' : 'Refresh Cache View';
  const clearLabel = isClearing ? 'Clearing…' : 'Clear Cached Data';
  const saveLabel = isSaving ? 'Saving…' : 'Save Preferences';

  return (
    <main className="min-h-screen bg-brand-surfaceLight text-gray-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6 md:gap-10 md:p-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Mountaineers Assistant Options
          </h1>
          <p className="text-sm text-gray-500">{statusMessage}</p>
        </header>

        <section className="card">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
            <p className="text-sm text-gray-500">Customize your preferences</p>
          </div>
          <div className="flex flex-col gap-4 px-6 py-4">
            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                id="toggle-avatars"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                checked={showAvatars}
                onChange={(event) => setShowAvatars(event.target.checked)}
              />
              <span>Show user profile images on the insights page</span>
            </label>
            <div className="flex flex-col gap-1 text-sm text-gray-700">
              <label htmlFor="fetch-limit-setting" className="font-medium text-gray-700">
                Temporary fetch limit for &ldquo;Fetch New Activities&rdquo;
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="fetch-limit-setting"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  placeholder="All"
                  value={fetchLimitInput}
                  onChange={(event) => setFetchLimitInput(event.target.value)}
                  onBlur={normalizeFetchLimitInput}
                />
                <span className="text-xs text-gray-500">Leave blank to fetch everything.</span>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={savePreferences}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white shadow transition hover:bg-indigo-500 disabled:pointer-events-none disabled:opacity-40"
              >
                {saveLabel}
              </button>
            </div>
          </div>
        </section>

        <section className="card mt-6 md:mt-8">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Cached Activities Data</h2>
            <p className="text-sm text-gray-500">
              This is the data stored locally by the extension.
            </p>
          </div>
          <div className="overflow-auto px-6 py-4">
            <div className="flex flex-wrap gap-2 pb-4">
              <button
                type="button"
                onClick={refreshCache}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white shadow transition hover:bg-indigo-500 disabled:pointer-events-none disabled:opacity-40"
              >
                {refreshLabel}
              </button>
              <button
                type="button"
                onClick={clearCache}
                disabled={isClearing}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-40"
              >
                {clearLabel}
              </button>
            </div>
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs text-slate-100 shadow-inner">
              {cacheContent}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
};

export default OptionsApp;
