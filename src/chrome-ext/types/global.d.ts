export {};

declare global {
  interface Window {
    __mtgExistingActivityUids?: string[];
    __mtgFetchLimit?: number | null;
    __mtgScrapeRunning?: boolean;
  }
}

declare namespace chrome.runtime {
  enum ContextType {
    OFFSCREEN_DOCUMENT = 'OFFSCREEN_DOCUMENT',
  }
}

declare namespace chrome.offscreen {
  enum Reason {
    DOM_SCRAPING = 'DOM_SCRAPING',
  }
}
