export {};

declare global {
  interface Window {
    __mtgExistingActivityUids?: string[];
    __mtgFetchLimit?: number | null;
    __mtgScrapeRunning?: boolean;
  }
}
