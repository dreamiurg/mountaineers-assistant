import { errorReporter } from './ErrorReporter'
import { clearErrorLog, loadErrorLog } from './storage'

/**
 * Check if extension is loaded unpacked (dev mode)
 */
function isDevMode(): boolean {
  try {
    return !('update_url' in (chrome?.runtime?.getManifest?.() ?? {}))
  } catch {
    return false
  }
}

/**
 * Trigger a test error for development/testing
 */
async function triggerTestError(type: 'network' | 'parsing' | 'uiRender' | 'crash' = 'crash') {
  // Determine context based on where we are
  let context: 'background' | 'offscreen' | 'insights' | 'preferences' = 'insights'

  if (typeof window !== 'undefined') {
    if (window.location.pathname.includes('preferences')) {
      context = 'preferences'
    } else if (window.location.pathname.includes('insights')) {
      context = 'insights'
    } else if (window.location.pathname.includes('offscreen')) {
      context = 'offscreen'
    }
  } else {
    // Service worker context
    context = 'background'
  }

  switch (type) {
    case 'network':
      await errorReporter.captureError(new TypeError('Failed to fetch: Network request failed'), {
        context,
        category: 'network',
        diagnostics: {
          testError: true,
          url: 'https://example.com/test',
        },
      })
      console.info('🧪 Test network error triggered')
      break

    case 'parsing':
      await errorReporter.captureError(
        new SyntaxError('Unexpected token < in JSON at position 0'),
        {
          context,
          category: 'parsing',
          diagnostics: {
            testError: true,
            operation: 'JSON.parse',
          },
        }
      )
      console.info('🧪 Test parsing error triggered')
      break

    case 'uiRender':
      await errorReporter.captureError(
        new Error('Cannot read properties of undefined (reading "map")'),
        {
          context,
          category: 'ui-render',
          diagnostics: {
            testError: true,
            component: 'TestComponent',
          },
        }
      )
      console.info('🧪 Test UI render error triggered')
      break

    case 'crash':
    default:
      await errorReporter.captureError(new Error('Test crash error for development'), {
        context,
        diagnostics: {
          testError: true,
        },
      })
      console.info('🧪 Test crash error triggered')
      break
  }
}

/**
 * View error log in console
 */
async function viewErrorLog() {
  const errors = await loadErrorLog()

  if (errors.length === 0) {
    console.info('📋 Error log is empty')
    return
  }

  console.info(`📋 Error log (${errors.length} entries):`)
  console.table(
    errors.map((e) => ({
      id: e.id.substring(0, 12) + '...',
      timestamp: new Date(e.timestamp).toLocaleString(),
      context: e.context,
      category: e.category,
      message: e.message.substring(0, 60) + (e.message.length > 60 ? '...' : ''),
      reported: e.reported,
      dismissed: e.dismissed,
      count: e.occurrenceCount,
    }))
  )
}

/**
 * Clear error log
 */
async function clearErrorLogDev() {
  await clearErrorLog()
  console.info('🗑️  Error log cleared')
}

/**
 * Initialize developer tools in dev mode
 */
export function initDevTools() {
  if (!isDevMode()) {
    return
  }

  // Expose dev tools to window
  if (typeof window !== 'undefined') {
    ;(
      window as typeof window & {
        __triggerTestError?: typeof triggerTestError
        __viewErrorLog?: typeof viewErrorLog
        __clearErrorLog?: typeof clearErrorLogDev
      }
    ).__triggerTestError = triggerTestError
    ;(
      window as typeof window & {
        __viewErrorLog?: typeof viewErrorLog
      }
    ).__viewErrorLog = viewErrorLog
    ;(
      window as typeof window & {
        __clearErrorLog?: typeof clearErrorLogDev
      }
    ).__clearErrorLog = clearErrorLogDev

    console.info(
      '🔧 Error Reporter Dev Tools Available:\n' +
        '  __triggerTestError(type?) - Trigger test error (network|parsing|uiRender|crash)\n' +
        '  __viewErrorLog() - View error log in console\n' +
        '  __clearErrorLog() - Clear error log'
    )
  }
}
