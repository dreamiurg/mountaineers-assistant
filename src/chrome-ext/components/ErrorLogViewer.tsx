import { useEffect, useState } from 'react'
import { clearErrorLog, loadErrorLog } from '../error-reporter/storage'
import type { ErrorLogEntry } from '../error-reporter/types'

interface ErrorLogViewerProps {
  onReportClick: (errorId: string) => void
}

export function ErrorLogViewer({ onReportClick }: ErrorLogViewerProps) {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([])
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    loadErrors()
  }, [])

  const loadErrors = async () => {
    const allErrors = await loadErrorLog()
    setErrors(allErrors)
  }

  const handleClearAll = async () => {
    await clearErrorLog()
    setErrors([])
    setShowClearConfirm(false)
  }

  if (errors.length === 0) {
    return (
      <article className="glass-card space-y-6 rounded-2xl p-6">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-slate-900">Error Logs</h2>
          <p className="text-sm text-slate-500">
            View and report errors that occurred in the extension
          </p>
        </div>
        <div className="text-center py-8">
          <svg
            className="w-12 h-12 text-green-500 mx-auto mb-3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-600 font-medium">No errors logged</p>
          <p className="text-sm text-slate-500 mt-1">Everything is working smoothly!</p>
        </div>
      </article>
    )
  }

  return (
    <article className="glass-card space-y-6 rounded-2xl p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-slate-900">Error Logs</h2>
          <p className="text-sm text-slate-500">
            {errors.length} {errors.length === 1 ? 'error' : 'errors'} logged
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowClearConfirm(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200/70 bg-rose-50/90 px-4 py-2 text-sm font-medium text-rose-600 shadow transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-3">
        {errors.map((error) => (
          <div key={error.id} className="border border-slate-200 rounded-lg p-4 bg-white/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      error.category === 'network'
                        ? 'bg-orange-100 text-orange-700'
                        : error.category === 'parsing'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {error.category}
                  </span>
                  <span className="text-xs text-slate-500">{error.context}</span>
                  {error.occurrenceCount > 1 && (
                    <span className="text-xs text-slate-500">({error.occurrenceCount}x)</span>
                  )}
                  {error.reported && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                      Reported
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-900 font-medium truncate">{error.message}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(error.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onReportClick(error.id)}
                  className="px-3 py-1.5 text-xs font-medium text-sky-600 bg-sky-50 rounded hover:bg-sky-100 border border-sky-200 transition-colors"
                  disabled={error.reported}
                >
                  {error.reported ? 'Reported' : 'Report'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Clear all error logs?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This will permanently delete all logged errors. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-md hover:bg-rose-700"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
