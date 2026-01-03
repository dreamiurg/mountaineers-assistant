import { useEffect, useState } from 'react'
import { generateGitHubIssueURL } from '../error-reporter/github'
import { loadErrorLog, markErrorReported } from '../error-reporter/storage'
import type { ErrorLogEntry } from '../error-reporter/types'

interface ErrorReportModalProps {
  errorId: string
  onClose: () => void
}

export function ErrorReportModal({ errorId, onClose }: ErrorReportModalProps) {
  const [error, setError] = useState<ErrorLogEntry | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    info: true,
    diagnostics: true,
  })

  useEffect(() => {
    loadError()
  }, [errorId])

  const loadError = async () => {
    const errors = await loadErrorLog()
    const found = errors.find((e) => e.id === errorId)
    setError(found || null)
  }

  const handleContinueToGitHub = async () => {
    if (!error || !confirmed) return

    // Mark error as reported
    await markErrorReported(error.id)

    // Open GitHub issue in new tab
    const url = generateGitHubIssueURL(error)
    window.open(url, '_blank')

    // Close modal
    onClose()
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  if (!error) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Report Error to GitHub</h2>
          <p className="text-sm text-gray-600 mt-1">
            Review the diagnostic data below before submitting
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Error Details Section */}
            <div className="border border-gray-200 rounded-lg">
              <button
                type="button"
                onClick={() => toggleSection('details')}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">Error Details</span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.details ? 'rotate-180' : ''}`}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedSections.details && (
                <div className="px-4 py-3 border-t border-gray-200">
                  <div className="text-sm space-y-2">
                    <div>
                      <span className="font-medium text-gray-700">Message:</span>
                      <p className="text-gray-900 mt-1">{error.message}</p>
                    </div>
                    {error.stack && (
                      <div>
                        <span className="font-medium text-gray-700">Stack Trace:</span>
                        <pre className="text-xs text-gray-900 mt-1 bg-gray-50 p-2 rounded overflow-x-auto">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Extension Info Section */}
            <div className="border border-gray-200 rounded-lg">
              <button
                type="button"
                onClick={() => toggleSection('info')}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">Extension Info</span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.info ? 'rotate-180' : ''}`}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedSections.info && (
                <div className="px-4 py-3 border-t border-gray-200">
                  <div className="text-sm grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-medium text-gray-700">Version:</span>
                      <span className="text-gray-900 ml-2">{error.version}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Browser:</span>
                      <span className="text-gray-900 ml-2">{error.browser}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">OS:</span>
                      <span className="text-gray-900 ml-2">{error.os}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Context:</span>
                      <span className="text-gray-900 ml-2">{error.context}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Category:</span>
                      <span className="text-gray-900 ml-2">{error.category}</span>
                    </div>
                    {error.occurrenceCount > 1 && (
                      <div>
                        <span className="font-medium text-gray-700">Occurrences:</span>
                        <span className="text-gray-900 ml-2">{error.occurrenceCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Diagnostics Section */}
            {Object.keys(error.diagnostics).length > 0 && (
              <div className="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleSection('diagnostics')}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">Additional Diagnostics</span>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${expandedSections.diagnostics ? 'rotate-180' : ''}`}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.diagnostics && (
                  <div className="px-4 py-3 border-t border-gray-200">
                    <pre className="text-xs text-gray-900 bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(error.diagnostics, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Privacy Confirmation */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  I've reviewed the diagnostic data above and confirm it contains no personal
                  information
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleContinueToGitHub}
            disabled={!confirmed}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Continue to GitHub
          </button>
        </div>
      </div>
    </div>
  )
}
