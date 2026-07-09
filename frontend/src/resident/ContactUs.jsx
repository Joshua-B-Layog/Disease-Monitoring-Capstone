import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const DISEASE_OPTIONS = [
  'Dengue','Diarrhea','Covid-19','Leptospirosis','Tuberculosis','Typhoid Fever',
  'Cholera','Measles','Hepatitis A','Hepatitis B','Rabies',
  'Acute Respiratory Infection','Avian Influenza','Chickenpox','Diphtheria','Ebola',
  'Hand Foot and Mouth Disease','Hepatitis C','HIV/AIDS','Influenza','Influenza A',
  'Leprosy','Malaria','Meningococcemia','Pertussis','Poliomyelitis','SARS','Sore Eyes',
];

const CHO_UNITS = [
  { value: 'CHO Unit I (Sala)', label: 'CHO Unit I (Sala)' },
  { value: 'CHO Unit II (Pulo)', label: 'CHO Unit II (Pulo)' },
];

function MapCenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 16); }, [center, map]);
  return null;
}

export default function ContactUs() {
  const [form, setForm] = useState({ name: '', email: '', targetCho: '', disease: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [locationView, setLocationView] = useState('cho1');
  const [diseaseOpen, setDiseaseOpen] = useState(false);
  const [choOpen, setChoOpen] = useState(false);
  const diseaseRef = useRef(null);
  const choRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (diseaseRef.current && !diseaseRef.current.contains(e.target)) setDiseaseOpen(false);
      if (choRef.current && !choRef.current.contains(e.target)) setChoOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.targetCho || !form.disease || !form.message) {
      setError('Please fill in required fields (name, email, CHO unit, disease, and message).');
      return;
    }
    setSending(true);
    setError('');
    try {
      await axios.post(`${API_URL}/api/contact-messages`, form);
      setSent(true);
      setForm({ name: '', email: '', targetCho: '', disease: '', message: '' });
    } catch (err) {
      setError('Failed to send message. Please try again later.');
    }
    setSending(false);
  };

  const locations = {
    cho1: {
      name: 'CHO Unit I (Sala)',
      address: 'Cho-I, F.B. Bailon St, Cabuyao City, 4025 Laguna',
      phone: '(049) 502-1234',
      email: 'chounit1@cabuyao.gov.ph',
      hours: 'Mon - Fri, 8:00 AM - 5:00 PM',
      coords: [14.272025782949482, 121.12429959060918],
    },
    cho2: {
      name: 'CHO Unit II (Pulo)',
      address: 'City Health Office 2, 136 National Hwy, Cabuyao City, 4025 Laguna',
      phone: '(049) 502-5678',
      email: 'chounit2@cabuyao.gov.ph',
      hours: 'Mon - Fri, 8:00 AM - 5:00 PM',
      coords: [14.242612339378494, 121.13168869422749],
    },
  };

  const currentLoc = locations[locationView];

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: '700' }}>
        Contact Us
      </h2>

      {/* 3-column grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: '24px',
        '@media (max-width: 900px)': { gridTemplateColumns: '1fr' },
      }}>

        {/* Box 1: Send a message */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px',
          padding: '24px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>
            Send a Message
          </h3>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Your message has been sent successfully! The health office will respond to you soon.
              </p>
              <button onClick={() => setSent(false)}
                style={{
                  marginTop: '12px', padding: '8px 20px', background: '#10B981',
                  color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                }}>
                Send Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input required placeholder="Your Name *"
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  style={inputStyle} />
                <input required type="email" placeholder="Your Email *"
                  value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  style={inputStyle} />
                <div ref={choRef} style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setChoOpen(!choOpen)}
                    style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                    <span style={{ color: form.targetCho ? 'var(--text-main)' : 'var(--text-muted)', flex: 1 }}>
                      {form.targetCho || '- Select CHO Unit * -'}
                    </span>
                    <span style={{ fontSize: '10px', flexShrink: 0, transition: 'transform 0.2s', transform: choOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </button>
                  {choOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                      borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}>
                      {CHO_UNITS.map(u => (
                        <div key={u.value} onClick={() => { setForm({...form, targetCho: u.value}); setChoOpen(false); }}
                          style={{
                            padding: '10px 12px', cursor: 'pointer', fontSize: '14px',
                            color: 'var(--text-main)',
                            background: form.targetCho === u.value ? 'rgba(16,185,129,0.1)' : 'transparent',
                          }}>
                          {u.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div ref={diseaseRef} style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setDiseaseOpen(!diseaseOpen)}
                    style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                    <span style={{ color: form.disease ? 'var(--text-main)' : 'var(--text-muted)', flex: 1 }}>
                      {form.disease || '- Select Disease -'}
                    </span>
                    <span style={{ fontSize: '10px', flexShrink: 0, transition: 'transform 0.2s', transform: diseaseOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </button>
                  {diseaseOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                      borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}>
                      {DISEASE_OPTIONS.map(d => (
                        <div key={d} onClick={() => { setForm({...form, disease: d}); setDiseaseOpen(false); }}
                          style={{
                            padding: '10px 12px', cursor: 'pointer', fontSize: '13px',
                            color: 'var(--text-main)',
                            background: form.disease === d ? 'rgba(16,185,129,0.1)' : 'transparent',
                          }}>
                          {d}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <textarea required placeholder="Your Message *"
                  value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                  rows={4} style={{...inputStyle, resize: 'vertical'}} />
                {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}
                <button type="submit" disabled={sending}
                  style={{
                    padding: '12px', background: '#10B981', color: '#fff',
                    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                    cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1,
                  }}>
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Box 2: Facebook */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px',
          padding: '24px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>
            Connect with Us
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Follow us on Facebook for the latest health updates and announcements.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a href="https://www.facebook.com/cho1cabuyao/" target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px', background: '#1877f2', color: '#fff',
                borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px',
              }}>
              <span style={{ fontSize: '20px'}}>f</span>
              CHO Unit I (Sala) Facebook
            </a>
            <a href="https://www.facebook.com/CHO2cabuyao/" target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px', background: '#1877f2', color: '#fff',
                borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '14px',
              }}>
              <span style={{ fontSize: '20px'}}>f</span>
              CHO Unit II (Pulo) Facebook
            </a>
          </div>
        </div>

        {/* Box 3: Our Location */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px',
          padding: '24px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>
            Our Location
          </h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button onClick={() => setLocationView('cho1')}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid',
                borderColor: locationView === 'cho1' ? '#10B981' : 'var(--border-color)',
                background: locationView === 'cho1' ? '#f0fdfa' : 'var(--bg-surface)',
                color: locationView === 'cho1' ? '#10B981' : 'var(--text-muted)',
                fontWeight: locationView === 'cho1' ? '600' : '400',
                cursor: 'pointer', fontSize: '13px',
              }}>
              CHO Unit I
            </button>
            <button onClick={() => setLocationView('cho2')}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid',
                borderColor: locationView === 'cho2' ? '#10B981' : 'var(--border-color)',
                background: locationView === 'cho2' ? '#f0fdfa' : 'var(--bg-surface)',
                color: locationView === 'cho2' ? '#10B981' : 'var(--text-muted)',
                fontWeight: locationView === 'cho2' ? '600' : '400',
                cursor: 'pointer', fontSize: '13px',
              }}>
              CHO Unit II
            </button>
          </div>

          {/* Leaflet Map */}
          <div style={{ height: '160px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', border: '1px solid var(--border-color)' }}>
            <MapContainer center={currentLoc.coords} zoom={16}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true} zoomControl={true} dragging={true}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={currentLoc.coords}>
                <Popup>{currentLoc.name}</Popup>
              </Marker>
              <MapCenterUpdater center={currentLoc.coords} />
            </MapContainer>
          </div>
          <div style={{ textAlign: 'right', marginBottom: '12px' }}>
            <a href={`https://www.google.com/maps?q=${currentLoc.coords[0]},${currentLoc.coords[1]}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
              Get directions ↗
            </a>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7' }}>
            <div><strong style={{ color: 'var(--text-main)' }}>Address:</strong> {currentLoc.address}</div>
            <div><strong style={{ color: 'var(--text-main)' }}>Phone:</strong> {currentLoc.phone}</div>
            <div><strong style={{ color: 'var(--text-main)' }}>Email:</strong> {currentLoc.email}</div>
            <div><strong style={{ color: 'var(--text-main)' }}>Hours:</strong> {currentLoc.hours}</div>
          </div>
        </div>
      </div>

      {/* National hotline */}
      <div style={{
        marginTop: '24px', textAlign: 'center',
        padding: '16px', background: '#fef2f2', border: '1px solid #fecaca',
        borderRadius: '10px',
      }}>
        <div style={{ fontSize: '14px', color: '#991b1b', fontWeight: '600' }}>
          National Emergency Hotline: <strong style={{ fontSize: '20px' }}>911</strong>
        </div>
        <div style={{ fontSize: '13px', color: '#b91c1c', marginTop: '4px' }}>
          DOH: 1555 | Red Cross: 143 | PNP: 117
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '6px',
  fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-surface)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
