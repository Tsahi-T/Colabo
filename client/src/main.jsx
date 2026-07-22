import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home.jsx';
import DocPage from './DocPage.jsx';
import About from './About.jsx';
import { initTheme } from './theme.jsx';
import './styles.css';

initTheme();

// Anonymous usage ping (browser-unique id, no personal data). Sent on every load:
// the server counts it as one visit, and de-duplicates the browser for the
// unique-users-today figure on its side.
try {
  let vid = localStorage.getItem('colabo.vid');
  if (!vid) { vid = crypto.randomUUID(); localStorage.setItem('colabo.vid', vid); }
  fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vid }) }).catch(() => {});
} catch { /* storage unavailable */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/d/:token" element={<DocPage />} />
      <Route path="/about" element={<About />} />
    </Routes>
  </BrowserRouter>
);
