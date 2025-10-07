import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const MOUNT_NODE_ID = 'options-react-root';

const Placeholder = () => null;

function mountReactRoot(): void {
  const container = document.getElementById(MOUNT_NODE_ID);
  if (!container) {
    console.warn(`Mountaineers Assistant: React mount node "${MOUNT_NODE_ID}" not found.`);
    return;
  }

  if ((container as unknown as { __reactRoot?: Root }).__reactRoot) {
    return;
  }

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <Placeholder />
    </StrictMode>
  );

  (container as unknown as { __reactRoot?: Root }).__reactRoot = root;

  if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
      root.unmount();
      delete (container as unknown as { __reactRoot?: Root }).__reactRoot;
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountReactRoot, { once: true });
} else {
  mountReactRoot();
}
