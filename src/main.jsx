import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initVkBridge, installDesktopAutoResize } from './vk.js';
import './styles.css';

void initVkBridge().then(ready => { if (ready) installDesktopAutoResize(); });

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
