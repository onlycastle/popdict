/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import Router from './Router';
// Bundled, self-hosted fonts (the CSP forbids remote font loading). Fraunces is
// the dictionary "headword" serif; JetBrains Mono carries IPA, labels, and keys.
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './index.css';

// Initialize React application
function initializeApp() {
  const rootElement = document.getElementById('root');

  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <Router />
      </React.StrictMode>
    );
  }
}

// Initialize immediately if DOM is already loaded, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}



