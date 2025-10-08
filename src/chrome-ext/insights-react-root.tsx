import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import InsightsApp from './insights/InsightsApp';

const MOUNT_NODE_ID = 'insights-react-root';

function mountReactRoot(): void {
  const container = document.getElementById(MOUNT_NODE_ID);
  if (!container) {
    console.warn(`Mountaineers Assistant: React mount node "${MOUNT_NODE_ID}" not found.`);
    return;
  }

  const typedContainer = container as typeof container & { __reactRoot?: Root };
  if (typedContainer.__reactRoot) {
    return;
  }

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <InsightsApp />
    </StrictMode>
  );

  typedContainer.__reactRoot = root;

  if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
      root.unmount();
      delete typedContainer.__reactRoot;
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountReactRoot, { once: true });
} else {
  mountReactRoot();
}
