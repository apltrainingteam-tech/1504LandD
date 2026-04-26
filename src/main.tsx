import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
import { ThemeProvider } from './core/context/ThemeContext';
import { MasterDataProvider } from './core/context/MasterDataContext';

root.render(
  <React.StrictMode>
    <MasterDataProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </MasterDataProvider>
  </React.StrictMode>
);






