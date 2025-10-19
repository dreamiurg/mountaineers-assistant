export {}

declare global {
  interface Window {
    __mtgExistingActivityUids?: string[]
    __mtgFetchLimit?: number | null
    __mtgScrapeRunning?: boolean
  }
}

// biome-ignore lint/style/noNamespace: Augmenting Chrome types until upstream definitions expose MV3 constants
declare namespace chrome.runtime {
  enum ContextType {
    OFFSCREEN_DOCUMENT = 'OFFSCREEN_DOCUMENT',
  }
}

// biome-ignore lint/style/noNamespace: Augmenting Chrome types until upstream definitions expose MV3 constants
declare namespace chrome.offscreen {
  enum Reason {
    DOM_SCRAPING = 'DOM_SCRAPING',
  }
}
