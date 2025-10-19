import { useEffect, useState } from 'react'
import { getUnreportedErrors, markErrorDismissed } from '../error-reporter/storage'
import type { ErrorLogEntry } from '../error-reporter/types'

interface ErrorToastProps {
  onReportClick: (errorId: string) => void
}

export function ErrorToast({ onReportClick }: ErrorToastProps) {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Load unreported errors on mount
    loadUnreportedErrors()

    // Listen for new errors from background/offscreen
    const handleMessage = (message: unknown) => {
      if (
        message &&
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'error-logged'
      ) {
        loadUnreportedErrors()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  const loadUnreportedErrors = async () => {
    const unreported = await getUnreportedErrors()
    setErrors(unreported)
    setVisible(unreported.length > 0)
  }

  const handleDismiss = async () => {
    // Mark all current errors as dismissed
    for (const error of errors) {
      await markErrorDismissed(error.id)
    }
    setVisible(false)
    setErrors([])
  }

  const handleReport = () => {
    if (errors.length > 0) {
      onReportClick(errors[0].id)
    }
  }

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(false)
      }, 10000)

      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!visible || errors.length === 0) {
    return null
  }

  const errorCount = errors.reduce((sum, e) => sum + e.occurrenceCount, 0)
  const message =
    errorCount === 1
      ? 'Something went wrong. Help us fix it by reporting this issue.'
      : `${errorCount} errors occurred. Help us fix them by reporting these issues.`

  return (
    <div
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down"
      style={{
        animation: visible ? 'slideDown 0.3s ease-out' : 'fadeOut 0.3s ease-out',
      }}
    >
      <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 max-w-md">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm text-red-800 font-medium">{message}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleReport}
            className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
          >
            Report Issue
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-1.5 bg-white text-red-600 text-sm font-medium rounded border border-red-200 hover:bg-red-50 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
