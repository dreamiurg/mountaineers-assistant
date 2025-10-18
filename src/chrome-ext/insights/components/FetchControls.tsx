import React from 'react'
import type { RefreshSummary } from '../../shared/types'

interface FetchControlsProps {
  onFetch: () => void
  isLoading: boolean
  statusMessage: string
  summary: RefreshSummary
  fetchLimit: number | null
}

export const FetchControls: React.FC<FetchControlsProps> = ({
  onFetch,
  isLoading,
  statusMessage,
  summary,
  fetchLimit,
}) => {
  const buttonText = fetchLimit
    ? `Fetch New Activities (limit: ${fetchLimit})`
    : 'Fetch New Activities'

  return (
    <div className="glass-card space-y-4 rounded-2xl p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Activity Data</h2>
          <p className="text-sm text-slate-500">
            Fetch latest activity history from mountaineers.org.
          </p>
        </div>
        <button
          data-testid="fetch-button"
          onClick={onFetch}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-600/25 transition-colors hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-60"
        >
          {isLoading && (
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          )}
          {buttonText}
        </button>
      </div>
      {statusMessage && (
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p
            className={`text-sm ${
              statusMessage.toLowerCase().includes('error') ||
              statusMessage.toLowerCase().includes('log in')
                ? 'text-rose-600'
                : 'text-slate-700'
            }`}
          >
            {statusMessage}
          </p>
          {statusMessage.toLowerCase().includes('log in') && (
            <a
              href="https://www.mountaineers.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-sky-600 hover:text-sky-700 hover:underline"
            >
              Open Mountaineers.org →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
