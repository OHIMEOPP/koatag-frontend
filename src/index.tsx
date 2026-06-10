import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { MasterKeyProvider } from './contexts/MasterKeyContext';
import { installUploadBeforeUnloadGuard } from './services/drive.service';

// R3 #3 §1.6 — global beforeunload guard for chunked uploads in flight.
installUploadBeforeUnloadGuard();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  // <React.StrictMode>
    <MasterKeyProvider>
      <App />
    </MasterKeyProvider>
  // </React.StrictMode>
);

