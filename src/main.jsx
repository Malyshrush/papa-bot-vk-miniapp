import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initVkBridge } from './vk.js';
import './styles.css';

void initVkBridge();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
