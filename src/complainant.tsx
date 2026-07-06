import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Network } from 'lucide-react';
import { LanguageSelector, ComplainantPortal, getInitialLanguage, GeminiKeysFooter } from './App';
import './index.css';

function ComplainantApp() {
  const [selectedLang, setSelectedLang] = useState(getInitialLanguage);

  // Initialize Google Translate Widget dynamically
  useEffect(() => {
    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,hi,bn,te,mr,ta,gu,kn,ml,or,pa,as,ur,sa,ne,sd,kok',
        layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'google_translate_element');
    };

    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <>
      {/* Hidden google translate widget anchor node */}
      <div id="google_translate_element" style={{ display: 'none' }}></div>

      {/* Navigation Header */}
      <header className="header">
        <div className="container header-container">
          <div className="logo-wrapper" onClick={() => window.location.href = '/'} style={{ cursor: 'pointer' }}>
            <div className="logo-icon">
              <Network size={20} strokeWidth={2.5} />
            </div>
            <span>Jansetu</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Custom Translation Component */}
            <LanguageSelector selectedLang={selectedLang} setSelectedLang={setSelectedLang} />
            
            <div className="status-badge">
              <span className="pulse-dot"></span>
              <span>AI Core Active</span>
            </div>
          </div>
        </div>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <ComplainantPortal selectedLang={selectedLang} onBack={() => window.location.href = '/'} />
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-content">
          <div className="footer-text">
            <strong>Jansetu</strong> — Bridging Citizens and Leaders through Intelligent Planning
          </div>
          <div className="footer-sub">
            Built for MP Constituency Development Planning • Smart India Hackathon Track 1 • All Rights Reserved
          </div>
          <GeminiKeysFooter />
        </div>
      </footer>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ComplainantApp />
  </React.StrictMode>
);
