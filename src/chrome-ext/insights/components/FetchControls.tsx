import React from 'react';
import type { RefreshSummary } from '../../shared/types';

interface FetchControlsProps {
  onFetch: () => void;
  isLoading: boolean;
  statusMessage: string;
  summary: RefreshSummary;
  fetchLimit: number | null;
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
    : 'Fetch New Activities';

  return (
    <div className="mb-6 rounded-lg bg-white p-4 shadow">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Activity Data</h2>
          {summary.lastUpdated && (
            <p className="text-sm text-gray-600">
              Last updated: {new Date(summary.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
        <button
          data-testid="fetch-button"
          onClick={onFetch}
          disabled={isLoading}
          className={`rounded-md px-4 py-2 font-medium text-white ${
            isLoading ? 'cursor-not-allowed bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {buttonText}
        </button>
      </div>
      {statusMessage && (
        <div className="mt-3">
          <p
            className={`text-sm ${
              statusMessage.toLowerCase().includes('error') ||
              statusMessage.toLowerCase().includes('log in')
                ? 'text-red-600'
                : 'text-gray-700'
            }`}
          >
            {statusMessage}
          </p>
          {statusMessage.toLowerCase().includes('log in') && (
            <a
              href="https://www.mountaineers.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
            >
              Open Mountaineers.org →
            </a>
          )}
        </div>
      )}
    </div>
  );
};
