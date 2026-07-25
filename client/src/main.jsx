import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home.jsx';
import DocPage from './DocPage.jsx';
import About from './About.jsx';
import { initTheme } from './theme.jsx';
import './styles.css';

initTheme();

// Anonymous cumulative site-visit counter — one bump per page load, no id, no personal data.
fetch('/api/track', { method: 'POST' }).catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/d/:token" element={<DocPage />} />
      <Route path="/about" element={<About />} />
    </Routes>
  </BrowserRouter>
);
