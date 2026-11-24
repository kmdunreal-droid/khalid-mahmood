import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { FirebaseProvider } from './components/auth/FirebaseProvider.tsx';
import { OfflineSyncProvider } from './context/OfflineSyncContext.tsx';
import './index.css';

// Automatically register and activate service worker for offline asset and cache persistence
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <FirebaseProvider>
      <OfflineSyncProvider>
        <App />
      </OfflineSyncProvider>
    </FirebaseProvider>
  </ErrorBoundary>
);
