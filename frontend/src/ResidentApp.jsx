import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import ResidentMap from './resident/ResidentMap';
import AboutCho from './resident/AboutCho';
import ContactUs from './resident/ContactUs';
import Help from './resident/Help';
import PreventionTips from './resident/PreventionTips';

const SECTIONS = [
  { key: 'map', label: 'Map' },
  { key: 'about', label: 'About' },
  { key: 'contact', label: 'Contact' },
  { key: 'help', label: 'Help' },
  { key: 'tips', label: 'Tips' },
];

export default function ResidentApp() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('map');

  const saved = localStorage.getItem('cdms_theme');
  const [theme, setTheme] = useState(saved || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cdms_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  // Scroll to section from URL path on initial load
  useEffect(() => {
    const sectionKey = location.pathname.replace('/Resident/', '') || 'map';
    const el = document.getElementById(`section-${sectionKey}`);
    if (el) {
      el.scrollIntoView({ behavior: 'instant' });
      setActiveSection(sectionKey);
    }
  }, []);

  // Intersection Observer for active section tracking + fade-in animation
  useEffect(() => {
    const els = document.querySelectorAll('.section-fade-in');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          const key = entry.target.id.replace('section-', '');
          setActiveSection(key);
        }
      });
    }, { threshold: 0.2, rootMargin: '-64px 0px 0px 0px' });

    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (key) => {
    const el = document.getElementById(`section-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(key);
    }
    setMenuOpen(false);
  };

  const isActive = (key) => activeSection === key;

  return (
    <div style={{
      height: '100vh',
      overflowY: 'auto',
      background: 'var(--bg-main)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: 'var(--text-main)',
      transition: 'background 0.3s, color 0.3s',
    }}>
      {/* ── STICKY HEADER ── */}
      <header style={{
        background: 'linear-gradient(135deg, #1E3A8A 0%, #00308F 100%)',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            onClick={() => scrollToSection('map')}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px',
            }}>
              🏥
            </div>
            <span style={{ color: '#fff', fontWeight: '700', fontSize: '18px', letterSpacing: '0.02em' }}>
              Cabuyao Health
            </span>
          </div>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => scrollToSection(s.key)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive(s.key) ? 'rgba(255,255,255,0.2)' : 'transparent',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: isActive(s.key) ? '600' : '400',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                {s.label}
              </button>
            ))}
            {/* Theme toggle */}
            <button onClick={toggleTheme}
              style={{
                marginLeft: '8px',
                width: '34px', height: '34px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={() => window.open('http://localhost:3000/CHO', '_blank')}
              style={{
                marginLeft: '8px',
                padding: '7px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer',
              }}>
              Admin Login
            </button>
          </nav>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'none',
              background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer',
            }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div style={{
            padding: '12px 0',
            borderTop: '1px solid rgba(255,255,255,0.15)',
          }}>
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => scrollToSection(s.key)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 16px',
                  background: isActive(s.key) ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer',
                }}>
                {s.label}
              </button>
            ))}
            <button onClick={toggleTheme}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 16px',
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.8)', fontSize: '13px', cursor: 'pointer',
              }}>
              {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
            <button onClick={() => { window.open('http://localhost:3000/CHO', '_blank'); setMenuOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 16px',
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.8)', fontSize: '13px', cursor: 'pointer',
              }}>
              Admin Login →
            </button>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A8A 0%, #2B4593 100%)',
        padding: '48px 24px 56px',
        textAlign: 'center',
      }}>
        <h1 style={{
          margin: '0 0 8px', color: '#fff', fontSize: '36px', fontWeight: '800',
          letterSpacing: '-0.02em',
        }}>
          Cabuyao Disease Monitoring System
        </h1>
        <p style={{
          margin: '0', color: 'rgba(255,255,255,0.8)',
          fontSize: '16px', maxWidth: '600px', margin: '0 auto',
          lineHeight: '1.6',
        }}>
          Stay informed about disease outbreaks in your barangay. Track cases, learn prevention tips,
          and know when to seek medical help.
        </p>
      </div>

      {/* ── SECTIONS ── */}
      <section id="section-map" className="section-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>
        <ResidentMap />
      </section>
      <section id="section-about" className="section-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>
        <AboutCho />
      </section>
      <section id="section-contact" className="section-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>
        <ContactUs />
      </section>
      <section id="section-help" className="section-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>
        <Help />
      </section>
      <section id="section-tips" className="section-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>
        <PreventionTips />
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        background: '#0f172a',
        color: 'rgba(255,255,255,0.7)',
        padding: '32px 24px 24px',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px', padding: '16px 24px', marginBottom: '24px',
          }}>
            <div style={{ color: '#ef4444', fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>
              National Emergency Hotline
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '0.05em' }}>
              911
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px', color: 'rgba(255,255,255,0.6)' }}>
              DOH Emergency: 1555 &nbsp;|&nbsp; Red Cross: 143 &nbsp;|&nbsp; PNP: 117
            </div>
          </div>
          <div style={{ fontSize: '13px' }}>
            © 2026 City Health Office of Cabuyao, Laguna. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
