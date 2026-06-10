import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { migrate, requestPersistence } from './storage';
import App from './App';

migrate();
void requestPersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
