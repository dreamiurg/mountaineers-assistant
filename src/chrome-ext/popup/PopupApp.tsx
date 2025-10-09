import { usePopupController } from './hooks/usePopupController';

const formatRelative = (isoString: string | null | undefined): string => {
  if (!isoString) {
    return 'Never refreshed';
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 'Never refreshed';
  }
  return `Last refreshed ${date.toLocaleString()}`;
};

export const PopupApp = () => {
  const {
    summary,
    statusMessage,
    showSpinner,
    actionsDisabled,
    insightsDisabled,
    refreshAll,
    openInsights,
    openPreferences,
  } = usePopupController();

  return (
    <main className="flex min-w-[280px] flex-col gap-4 bg-brand-surfaceLight p-4 text-gray-900">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight">Mountaineers Assistant</h1>
        <p className="text-sm text-gray-500">{formatRelative(summary.lastUpdated)}</p>
      </header>

      <section className="card p-4" aria-live="polite">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Activities cached</span>
          <span className="text-3xl font-semibold text-gray-900">{summary.activityCount ?? 0}</span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={openInsights}
          disabled={insightsDisabled}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white shadow transition hover:bg-indigo-500 disabled:pointer-events-none disabled:opacity-40"
        >
          Open My Insights
        </button>
        <button
          type="button"
          onClick={refreshAll}
          disabled={actionsDisabled}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
        >
          Fetch New Activities
        </button>
        <button
          type="button"
          onClick={openPreferences}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
        >
          Preferences
        </button>
        <div
          role="status"
          className="flex min-h-[1.5rem] items-center gap-2 text-sm text-amber-600"
        >
          <span
            className={[
              'h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent',
              showSpinner ? '' : 'hidden',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          ></span>
          <span>{statusMessage}</span>
        </div>
      </section>
    </main>
  );
};

export default PopupApp;
