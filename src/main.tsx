/**
 * [Boot] Application Entry Point
 * 
 * Refactored to mount the App State Machine.
 * Boot logic is now handled in App.tsx.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import GlobalErrorBoundary from './ui/GlobalErrorBoundary.js';
import './index.css';
import './ui/isometric/materials/index.js'; // Register R3F Materials

console.log('[FIN] Main entry point loaded.');

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <GlobalErrorBoundary>
            <App />
        </GlobalErrorBoundary>
    </React.StrictMode>
);
