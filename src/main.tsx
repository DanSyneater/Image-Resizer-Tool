import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {getUpng} from './vendor/upng-shim';
import './index.css';

getUpng().catch((err) => console.error('UPNG preload failed:', err));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
