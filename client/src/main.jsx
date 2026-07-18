import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home.jsx';
import DocPage from './DocPage.jsx';
import About from './About.jsx';
import { initTheme } from './theme.jsx';
import './styles.css';

initTheme();

// Anonymous daily usage ping (browser-unique id, no personal data).
try {
  let vid = localStorage.getItem('colabo.vid');
  if (!vid) { vid = crypto.randomUUID(); localStorage.setItem('colabo.vid', vid); }
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('colabo.tracked') !== today) {
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vid }) })
      .then((r) => r.ok && localStorage.setItem('colabo.tracked', today)).catch(() => {});
  }
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
