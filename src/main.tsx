import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || { env: {} };
  (window as any).process.env = (window as any).process.env || {};
  (window as any).process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  (window as any).process.env.DISABLE_HMR = process.env.DISABLE_HMR;
  (window as any).process.env.NODE_ENV = process.env.NODE_ENV;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
