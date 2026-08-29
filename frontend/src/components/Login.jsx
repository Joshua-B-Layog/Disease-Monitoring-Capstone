import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import ChoLogoIcon from '../assets/ChoLogo';
import { getCachedUsers, upsertCachedUser } from '../offlineSync';
import BackButton from './BackButton';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import cabuyaoBoundaries from '../data/cabuyao_barangays.geojson.json';

function getFeatureBounds(f) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  const rings = f.geometry.type === 'MultiPolygon'
    ? f.geometry.coordinates.flat(2)
    : f.geometry.coordinates[0];
  for (const [lng, lat] of rings) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [[minLat, minLng], [maxLat, maxLng]];
}

const FEATURE_BOUNDS = {};
for (const f of cabuyaoBoundaries.features) {
  FEATURE_BOUNDS[f.properties.ADM4_EN] = getFeatureBounds(f);
}

const OVERALL_BOUNDS = (() => {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const b of Object.values(FEATURE_BOUNDS)) {
    if (b[0][0] < minLat) minLat = b[0][0];
    if (b[1][0] > maxLat) maxLat = b[1][0];
    if (b[0][1] < minLng) minLng = b[0][1];
    if (b[1][1] > maxLng) maxLng = b[1][1];
  }
  return [[minLat, minLng], [maxLat, maxLng]];
})();

// Build SVG path data for the faint Cabuyao map outline behind the auth card
const SVG_W = 800;
const SVG_H = 520;
const MAP_PADDING = 30;
const mapScale = Math.min(
  (SVG_W - MAP_PADDING * 2) / (OVERALL_BOUNDS[1][1] - OVERALL_BOUNDS[0][1]),
  (SVG_H - MAP_PADDING * 2) / (OVERALL_BOUNDS[1][0] - OVERALL_BOUNDS[0][0])
);
const toSvgX = (lng) => (lng - OVERALL_BOUNDS[0][1]) * mapScale + (SVG_W - (OVERALL_BOUNDS[1][1] - OVERALL_BOUNDS[0][1]) * mapScale) / 2;
const toSvgY = (lat) => (OVERALL_BOUNDS[1][0] - lat) * mapScale + (SVG_H - (OVERALL_BOUNDS[1][0] - OVERALL_BOUNDS[0][0]) * mapScale) / 2;
const CABUYAO_MAP_PATHS = cabuyaoBoundaries.features.map((f) => {
  const rings = f.geometry.type === 'MultiPolygon'
    ? f.geometry.coordinates.map((p) => p[0])
    : [f.geometry.coordinates[0]];
  return rings.map((ring) =>
    'M ' + ring.map(([lng, lat]) => `${toSvgX(lng).toFixed(1)},${toSvgY(lat).toFixed(1)}`).join(' L ') + ' Z'
  ).join(' ');
}).join(' ');

const CABUYAO_CENTER = [
  (OVERALL_BOUNDS[0][0] + OVERALL_BOUNDS[1][0]) / 2,
  (OVERALL_BOUNDS[0][1] + OVERALL_BOUNDS[1][1]) / 2,
];

const ANIM_SCENES = [
  { bounds: OVERALL_BOUNDS, highlight: null,    label: 'Cabuyao City Overview' },
  { bounds: FEATURE_BOUNDS['Barangay Dos (Pob.)'], highlight: 'Barangay Dos (Pob.)', label: 'Barangay Dos (Poblacion)' },
  { bounds: FEATURE_BOUNDS['Baclaran'],             highlight: 'Baclaran',             label: 'Baclaran' },
  { bounds: FEATURE_BOUNDS['Pulo'],                 highlight: 'Pulo',                 label: 'Pulo' },
  { bounds: FEATURE_BOUNDS['Casile'],               highlight: 'Casile',               label: 'Casile' },
  { bounds: FEATURE_BOUNDS['Niugan'],               highlight: 'Niugan',               label: 'Niugan' },
  { bounds: FEATURE_BOUNDS['Bigaa'],                highlight: 'Bigaa',                label: 'Bigaa' },
  { bounds: FEATURE_BOUNDS['Sala'],                 highlight: 'Sala',                 label: 'Sala' },
];

const BRANDING_FEATURES = [
  { icon: '🛰️', title: 'Continuous Surveillance', subtitle: 'Real-time monitoring & early detection', color: '#3b82f6' },
  { icon: '🗺️', title: 'Barangay & Purok Mapping', subtitle: 'Localized clusters across 18 barangays', color: '#dc2626' },
  { icon: '🔔', title: 'Automated Alerts', subtitle: 'Timely updates and outbreak warnings', color: '#3b82f6' },
  { icon: '📊', title: 'Decision Support', subtitle: 'Accurate reports for CHO health response', color: '#dc2626' },
];

// Footer contact / legal content (SVG icons matching the app's stroke style)
const POLICY_TITLES = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
  disclaimer: 'Data Disclaimer',
};
const POLICY_SECTIONS = {
  privacy: [
    'The City Health Office of Cabuyao is committed to protecting the personal data of residents, health workers, and system users in line with the Data Privacy Act of 2012 (RA 10173).',
    'Disease surveillance records, contact details, and account information are collected solely for public health monitoring, response, and reporting purposes under the authority of the City Health Office.',
    'Access to case and personal data is restricted to authorized health personnel. Data is only shared with entities or agencies as required or permitted by law.',
    'You may request access, correction, or deletion of your personal data by contacting the City Health Office through the channels provided on this portal.',
  ],
  terms: [
    'By accessing and using the Cabuyao Disease Monitoring and Mapping System (CDMS), you agree to use the system only for legitimate public health and administrative purposes.',
    'User accounts are issued to accredited City Health Office staff and Barangay Health Workers. Account credentials are confidential and must not be shared.',
    'You are responsible for the accuracy of data you enter. Deliberate falsification or misuse of case records may result in account suspension or revocation.',
    'The system may be updated or taken offline for maintenance from time to time. Continued use of the system constitutes acceptance of these terms.',
  ],
  disclaimer: [
    'The information presented on this portal is for official City Health Office surveillance use and general public health awareness only.',
    'While every effort is made to keep data accurate and up to date, the City Health Office makes no guarantees regarding the completeness, accuracy, or timeliness of the information.',
    'This system does not provide medical advice. For personal medical concerns, please consult a licensed healthcare professional or visit your nearest health center.',
    'Reference to specific barangay, purok, or case data does not constitute medical, legal, or professional advice.',
  ],
};

const FooterIcon = ({ type }) => {
  const paths = {
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="m22 6-10 7L2 6" /></>,
    pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  };
  return (
    <svg className="cdms-global-footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  );
};

function CityHealthBranding() {
  return (
    <div className="login-branding">
      <div className="login-branding-dots" />
      <div className="login-branding-watermark">
        <ChoLogoIcon size={280} />
      </div>

      <div className="login-branding-content">
        <div className="login-branding-badge">
          <div className="login-branding-badge-logo"><ChoLogoIcon size={22} /></div>
          <span>CITY HEALTH OFFICE</span>
        </div>

        <h1 className="login-branding-title">Building a Healthier Cabuyao, Together.</h1>
        <p className="login-branding-subtitle">City of Cabuyao · City Health Office - Laguna</p>
        <p className="login-branding-desc">
          Real-time communicable disease surveillance across all 18 barangays, mapping every case down to
          barangay and purok level to guide prompt community health response across the city.
        </p>

        <div className="login-branding-features">
          {BRANDING_FEATURES.map((f, i) => (
            <div key={i} className="login-branding-feature">
              <span className="login-branding-feature-tile" style={{ borderColor: f.color, backgroundColor: f.color }}>{f.icon}</span>
              <span className="login-branding-feature-text">
                <span className="login-branding-feature-title">{f.title}</span>
                <span className="login-branding-feature-sub">{f.subtitle}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnimatedMapView({ setFade, active, onSequenceComplete }) {
    const map = useMap();
    const [sceneIdx, setSceneIdx] = useState(0);
    const idxRef = useRef(0);
    const mountedRef = useRef(true);
    const onCompleteRef = useRef(onSequenceComplete);
    useEffect(() => { onCompleteRef.current = onSequenceComplete; }, [onSequenceComplete]);

    useEffect(() => {
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
      if (!active) {
        idxRef.current = 0;
        setSceneIdx(0);
        return;
      }

      idxRef.current = 0;
      setSceneIdx(0);
      map.fitBounds(L.latLngBounds(ANIM_SCENES[0].bounds), { padding: [40, 40], maxZoom: 12 });

      const advance = () => {
        if (!mountedRef.current) return;
        setTimeout(() => {
          if (!mountedRef.current) return;
          if (idxRef.current + 1 >= ANIM_SCENES.length) {
            setFade(0);
            setTimeout(() => {
              if (onCompleteRef.current) onCompleteRef.current();
            }, 450);
            return;
          }
          idxRef.current += 1;
          const scene = ANIM_SCENES[idxRef.current];
          setSceneIdx(idxRef.current);
          setFade(0.35);
          map.flyToBounds(L.latLngBounds(scene.bounds), { padding: [20, 20], maxZoom: 15, duration: 1.6 });
          setTimeout(() => {
            if (mountedRef.current) setFade(1);
          }, 1000);
        }, 400);
      };

      const first = setTimeout(advance, 3000);
      const id = setInterval(advance, 7000);
      return () => { clearTimeout(first); clearInterval(id); };
    }, [active, map]);

    const currentScene = ANIM_SCENES[sceneIdx];

    return (
      <>
        <GeoJSON
          key={sceneIdx}
          data={cabuyaoBoundaries}
          style={(feature) => {
            const name = feature.properties.ADM4_EN;
            const isHighlighted = currentScene.highlight && name === currentScene.highlight;
            const isOverview = currentScene.highlight === null;
            if (isHighlighted) {
              return { fillColor: '#121358', fillOpacity: 0.3, color: '#ffffff', weight: 2.5 };
            }
            return {
              fillColor: isOverview ? '#94a3b8' : '#ffffff',
              fillOpacity: isOverview ? 0.4 : 0.02,
              color: isOverview ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
              weight: isOverview ? 1.5 : 0.5,
            };
          }}
          onEachFeature={(feature, layer) => {
            if (currentScene.highlight === null) {
              layer.bindTooltip(feature.properties.ADM4_EN, {
                permanent: true,
                direction: 'center',
                className: 'map-label-tooltip',
              });
            }
          }}
        />
        {currentScene.label && (
          <div style={{
            position: 'absolute', top: 16, left: 16, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            padding: '6px 14px', borderRadius: 6,
            fontSize: 13, fontWeight: 600, pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            {currentScene.label}
          </div>
        )}
      </>
    );
  }

  export default function Login({ onLoginSuccess, onForgotPassword, theme, toggleTheme }) {
    const [step, setStep] = useState('role'); // 'role', 'cho_select', 'bhw_select', 'auth', 'forgot_password', 'signup', 'cho_contact', 'signup_role'
    const [pendingUser, setPendingUser] = useState(null); // holds session data while waiting for OTP
    const [loginOtp, setLoginOtp] = useState('');
    const [otpError, setOtpError] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState('CHO'); 
    const [selectedContext, setSelectedContext] = useState(''); 
    const [mapFade, setMapFade] = useState(1);
    const [leftPanel, setLeftPanel] = useState(0); // 0 = City Health branding, 1 = animated map
    const [policyModal, setPolicyModal] = useState(null); // null | 'privacy' | 'terms' | 'disclaimer'
    
    // Login Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // Forgot Password States
    const [recoveryIdentity, setRecoveryIdentity] = useState('');
    const [recoverySuccess, setRecoverySuccess] = useState('');

    // Sign-Up Form States
    const [signupName, setSignupName] = useState('');
    const [signupUsername, setSignupUsername] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
    const [signupRole, setSignupRole] = useState('BHW');
    const [signupContext, setSignupContext] = useState('');
    const [signupError, setSignupError] = useState('');
    const [signupSuccess, setSignupSuccess] = useState('');
    const [signupMobile, setSignupMobile] = useState('');
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [signupBarangayOpen, setSignupBarangayOpen] = useState(false);
    const signupBarangayRef = useRef(null);
    const [showSignupConfirm, setShowSignupConfirm] = useState(false);
    const [barangayList, setBarangayList] = useState([]);

    const cabuyaoBarangays = [
      { name: 'Barangay Uno (Poblacion)', district: 'CHO I' },
      { name: 'Barangay Dos (Poblacion)', district: 'CHO I' },
      { name: 'Barangay Tres (Poblacion)', district: 'CHO I' },
      { name: 'Sala', district: 'CHO I' },
      { name: 'Bigaa', district: 'CHO I' },
      { name: 'Butong', district: 'CHO I' },
      { name: 'Marinig', district: 'CHO I' },
      { name: 'Gulod', district: 'CHO I' },
      { name: 'Niugan', district: 'CHO I' },
      { name: 'Baclaran', district: 'CHO I' },
      { name: 'Pulo', district: 'CHO II' },
      { name: 'Banay-Banay', district: 'CHO II' },
      { name: 'Banlic', district: 'CHO II' },
      { name: 'Mamatid', district: 'CHO II' },
      { name: 'San Isidro', district: 'CHO II' },
      { name: 'Diezmo', district: 'CHO II' },
      { name: 'Pittland', district: 'CHO II' },
      { name: 'Casile', district: 'CHO II' },
    ];

    // --- REMEMBER ME LOCAL STORAGE INITIALIZATION ---
    useEffect(() => {
      const savedEmail = localStorage.getItem('remembered_user_email');
      const rememberChecked = localStorage.getItem('remember_me_status') === 'true';
      if (rememberChecked && savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }, []
  );

    useEffect(() => {
      fetch(API_URL + '/api/barangays')
        .then(res => res.json())
        .then(data => setBarangayList(data))
        .catch(err => console.error('Could not load barangays:', err));
    }, []
  );

    useEffect(() => {
      const handler = (e) => {
        if (signupBarangayRef.current && !signupBarangayRef.current.contains(e.target)) {
          setSignupBarangayOpen(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── LEFT SIDE LOOP: City Health branding ↔ full map sequence ──
    useEffect(() => {
      if (leftPanel !== 0) return;
      const id = setTimeout(() => setLeftPanel(1), 7000);
      return () => clearTimeout(id);
    }, [leftPanel]);

    useEffect(() => {
      if (leftPanel === 1) setMapFade(1);
    }, [leftPanel]);



    const handleRoleSelection = (role) => {
      setSelectedRole(role);
      if (role === 'CHO') {
        setStep('cho_select');
      } else {
        setStep('bhw_select');
      }
    };

    const handleChoSelection = (choUnit) => {
      setSelectedContext(choUnit);
      setStep('auth');
    };

    const handleBhwProceed = () => {
      if (!selectedContext) {
        setLoginError('Please select your assigned barangay to proceed.');
        return;
      }
      setLoginError('');
      setStep('auth');
    };

    const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    // ── Capture device info from user agent ──
    const getDeviceInfo = () => {
        const ua = navigator.userAgent;
        let browser = 'Browser';
        let os = 'Device';

        if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
        else if (ua.includes('Edg')) browser = 'Edge';

        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone')) os = 'iPhone';
        else if (ua.includes('iPad')) os = 'iPad';
        else if (ua.includes('Mac')) os = 'Mac';
        else if (ua.includes('Linux')) os = 'Linux';

        return `${browser} on ${os}`;
    };

    // ── Capture location from IP ──
    const getLocation = async () => {
        try {
            const res = await fetch('https://ipapi.co/json/');
            if (!res.ok) throw new Error('geo failed');
            const data = await res.json();
            return `${data.city || 'Unknown'}, ${data.region || ''}, ${data.country_name || ''}`.trim();
        } catch {
            return 'Cabuyao, Calabarzon, Philippines';
        }
    };

    try {
        const device = getDeviceInfo();
        const location = 'Cabuyao, Calabarzon, Philippines';

        const response = await fetch(API_URL + '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email, 
                password: password, 
                role: selectedRole,
                context: selectedContext,
                device: device,
                location: location
            }),
        });

        const data = await response.json();

       if (response.ok) {
            if (rememberMe) {
                localStorage.setItem('remembered_user_email', email);
                localStorage.setItem('remember_me_status', 'true');
            } else {
                localStorage.removeItem('remembered_user_email');
                localStorage.removeItem('remember_me_status');
            }

            const sessionPayload = {
                id: data.user.id,
                role: selectedRole,
                context: selectedContext,
                username: email,
                name: data.user.name,
                barangay: data.user.barangay
            };

            // Cache user credentials for offline login
            upsertCachedUser({ id: data.user.id, email, username: email, password, name: data.user.name, role: data.user.role, barangay: data.user.barangay }).catch(() => {});

            if (data.requires2FA) {
                // Hold off on logging in - send OTP and move to verification step
                setPendingUser(sessionPayload);
                try {
                    await fetch(API_URL + '/api/send-login-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: data.user.id })
                    });
                } catch (e) { /* fallback OTP will print server-side */ }
                setStep('otp_login');
            } else {
                onLoginSuccess(sessionPayload);
            }
        } else {
            setLoginError(data.error || 'Invalid credentials or account not found.');
        }
    } catch (error) {
        console.error("Transmission Error:", error);
        // Attempt offline login from cached user data
        try {
            const cached = await getCachedUsers();
            const match = cached.find(u =>
                (u.email === email || u.username === email) &&
                u.password === password &&
                u.role === selectedRole
            );
            if (match) {
                // Validate BHW barangay assignment offline
                if (selectedRole === 'BHW' && match.barangay) {
                    const selectedBrgy = selectedContext.replace(/^Brgy\.\s*/i, '').trim().toLowerCase();
                    const assignedBrgy = (match.barangay || '').trim().toLowerCase();
                    if (assignedBrgy && selectedBrgy !== assignedBrgy) {
                        setLoginError(`Access denied. You are assigned to Brgy. ${match.barangay}, not Brgy. ${selectedContext.replace(/^Brgy\.\s*/i, '').trim()}.`);
                        return;
                    }
                }
                onLoginSuccess({
                    id: match.id || match.user_id,
                    role: selectedRole,
                    context: selectedContext,
                    username: email,
                    name: match.name,
                    barangay: match.barangay || null
                });
                return;
            }
        } catch (_) { /* offline cache unavailable */ }
        setLoginError('Cannot connect to surveillance gateway. Confirm backend runtime.');
    }
};

const handleLoginOtpSubmit = async (e) => {
    e.preventDefault();
    setOtpError('');
    if (loginOtp.length !== 6) {
        setOtpError('Please enter the 6-digit code sent to your email.');
        return;
    }
    setOtpLoading(true);
    try {
        const response = await fetch(API_URL + '/api/verify-login-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: pendingUser.id, otp: loginOtp })
        });
        const data = await response.json();
        if (response.ok) {
            onLoginSuccess(pendingUser);
        } else {
            setOtpError(data.error || 'Invalid or expired code.');
        }
    } catch (error) {
        setOtpError('Could not reach the verification service.');
    } finally {
        setOtpLoading(false);
    }
};

    const getPasswordStrength = (pw) => {
      if (!pw || pw.length < 7) return 'low';
      const hasUpper = /[A-Z]/.test(pw);
      const hasNumber = /[0-9]/.test(pw);
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;'`~]/.test(pw);
      if (hasUpper && hasNumber && hasSpecial) return 'strong';
      if (!hasUpper && !hasSpecial) return 'low';
      return 'medium';
    };

    // --- REGISTER ACCOUNT SUBMISSION ---
    const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setSignupError('');
    setSignupSuccess('');

    if (signupPassword !== signupConfirmPassword) {
        setSignupError('Passwords do not match.');
        return;
    }
    if (getPasswordStrength(signupPassword) === 'low') {
        setSignupError('Password is too weak. Use at least 7 characters with uppercase, number, and special character.');
        return;
    }
    if (signupMobile && signupMobile.length < 10) {
        setSignupError('Please enter a valid mobile number (at least 10 digits).');
        return;
    }

    try {
        const response = await fetch(API_URL + '/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: signupName,
                username: signupUsername,
                email: signupEmail,
                mobile: signupMobile,
                password: signupPassword,
                role: signupRole,
                context: signupContext
            })
        });

        if (response.ok) {
            setSignupError('');
            setSignupSuccess('Registration submitted! Your account is pending CHO approval. You will receive an email once reviewed.');

            // Keep form fields visible as-submitted during the redirect delay,
            // then clear everything once we navigate back to role selection.
            setTimeout(() => {
                setSignupName('');
                setSignupUsername('');
                setSignupEmail('');
                setSignupMobile('');
                setSignupPassword('');
                setSignupConfirmPassword('');
                setSignupRole('CHO');
                setSignupContext('');
                setSignupSuccess('');
                setSelectedContext('');
                setSelectedRole('CHO');
                setStep('role'); // ← back to the very beginning
            }, 3000);

        } else {
            const errData = await response.json();
            setSignupError(errData.message || 'Registration failed.');
        }
    } catch (error) {
        console.error("Registration Transmission Error:", error);
        setSignupError('Unable to reach server.');
    }
  };

    const handleRecoverySubmit = async (e) => {
      e.preventDefault();
      setRecoverySuccess('');
      setLoginError('');
      
      if (!recoveryIdentity.trim()) {
        setLoginError('Please enter your email or username.');
        return;
      }

      try {
        const response = await fetch(API_URL + '/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: recoveryIdentity })
        });

        if (response.ok) {
          setRecoverySuccess('A password reset link has been sent to your registered email.');
        } else {
          const data = await response.json();
          setLoginError(data.error || 'Account lookup failed.');
        }
      } catch (error) {
        setLoginError('Connection error. Check your backend server.');
      }
    };

    const handleBackNavigation = () => {
      setRecoveryIdentity('');
      setLoginError('');
      setSignupError('');
      setRecoverySuccess('');


      if (step === 'auth') {
        if (!rememberMe) {
          setEmail('');
          setPassword('');
        }
      }
      
      if (step === 'signup_role') {
        setStep('role');
      } else if (step === 'signup') {
        if (selectedContext) {
          setStep('auth');
        } else {
          setStep('signup_role');
        }
        setSignupContext('');
      } else if (step === 'cho_contact') {
        setStep('role');
        setSignupContext('');
      } else if (step === 'cho_select' || step === 'bhw_select') {
        setStep('role');
        setSelectedContext('');
      } else if (step === 'auth') {
        setStep(selectedRole === 'CHO' ? 'cho_select' : 'bhw_select');
        setSelectedContext('');
      } else if (step === 'forgot_password') {
        setStep('auth');
      }
    };

    return (
      <div className="login-screen">
        <button onClick={toggleTheme} className="theme-toggle-btn" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
          {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>

        <div className="login-left">
          <div style={{ position: 'absolute', inset: 0, opacity: leftPanel === 0 ? 1 : 0, transition: 'opacity 0.7s ease-in-out', pointerEvents: 'none' }}>
            <CityHealthBranding />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: leftPanel === 1 ? 1 : 0, transition: 'opacity 0.7s ease-in-out' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: mapFade, transition: 'opacity 0.7s ease-in-out' }}>
              <MapContainer
                center={CABUYAO_CENTER}
                zoom={12}
                zoomControl={false}
                scrollWheelZoom={false}
                dragging={false}
                touchZoom={false}
                doubleClickZoom={false}
                attributionControl={false}
                style={{ width: '100%', height: '100%', background: 'transparent' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <AnimatedMapView setFade={setMapFade} active={leftPanel === 1} onSequenceComplete={() => setLeftPanel(0)} />
              </MapContainer>
            </div>
          </div>
        </div>

        <div className="login-right">
          <div className="auth-bg-decorations" aria-hidden="true">
            <svg
              className="auth-bg-map"
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d={CABUYAO_MAP_PATHS} stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.12" />
            </svg>

            <svg className="auth-bg-nodes" viewBox={`0 0 ${SVG_W} ${SVG_H}`} fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M120 90 L210 150 L330 110 L470 200 M210 150 L270 320 L470 200 M470 200 L600 260 L690 170 L600 120 M600 260 L520 400" stroke="#38BDF8" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 4" />
              <path d="M330 110 L420 90 M120 90 L60 180 L120 90" stroke="#34D399" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 4" />
              <circle cx="120" cy="90"  r="3" fill="#38BDF8" fillOpacity="0.4" />
              <circle cx="210" cy="150" r="3" fill="#34D399" fillOpacity="0.4" />
              <circle cx="330" cy="110" r="2.5" fill="#38BDF8" fillOpacity="0.3" />
              <circle cx="470" cy="200" r="3" fill="#34D399" fillOpacity="0.4" />
              <circle cx="600" cy="260" r="3" fill="#38BDF8" fillOpacity="0.4" />
              <circle cx="690" cy="170" r="2.5" fill="#34D399" fillOpacity="0.3" />
              <circle cx="600" cy="120" r="2.5" fill="#38BDF8" fillOpacity="0.3" />
              <circle cx="270" cy="320" r="3" fill="#34D399" fillOpacity="0.4" />
              <circle cx="520" cy="400" r="2.5" fill="#38BDF8" fillOpacity="0.3" />
              <circle cx="420" cy="90"  r="2.5" fill="#34D399" fillOpacity="0.3" />
              <circle cx="60"  cy="180" r="2.5" fill="#38BDF8" fillOpacity="0.3" />
            </svg>

            <svg className="auth-bg-icon users-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M16.5 15.5c2.6.3 4.2 2 4.2 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>

            <svg className="auth-bg-icon pin-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" fill="#10B981" fillOpacity="0.2" />
              <path d="M20 10c0 4.4-6 10-8 10s-8-5.6-8-10a8 8 0 0 1 16 0z" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="10" r="3" fill="currentColor" />
            </svg>

            <svg className="auth-bg-icon chart-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="12" width="4" height="8" stroke="currentColor" strokeWidth="1.7" />
              <rect x="10" y="7" width="4" height="13" stroke="currentColor" strokeWidth="1.7" />
              <rect x="16" y="3" width="4" height="17" stroke="currentColor" strokeWidth="1.7" />
            </svg>

            <svg className="auth-bg-icon cross-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 4 H13 V11 H20 V13 H13 V20 H11 V13 H4 V11 H11 Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.25" />
            </svg>
            <svg className="auth-bg-icon cross-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 4 H13 V11 H20 V13 H13 V20 H11 V13 H4 V11 H11 Z" stroke="currentColor" strokeWidth="1.4" fill="currentColor" fillOpacity="0.25" />
            </svg>
          </div>
          <div className="login-column">
          <div key={step} className={step === 'role' ? 'login-form-container' : 'login-form-container cdms-login-step'}>
            
            <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
              <div className="circle-logo" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#121358', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><ChoLogoIcon size={32} /></div>
              <div className="brand-text" style={{ fontSize: '26px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                Cabuyao Health
              </div>
            </div>

            {/* STEP 1: PORTAL ROUTING */}
            {step === 'role' && (
              <>
                <div className="login-header" style={{ marginBottom: '28px', textAlign: 'left' }}>
                  <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Welcome back!</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Select your system surveillance portal access group.</p>
                  <div className="accent-bar" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <button type="button" className="portal-card portal-card-cho" onClick={() => handleRoleSelection('CHO')} aria-label="Select City Health Office portal">
                    <div className="portal-card-body">
                      <span className="portal-card-title" style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '16px' }}>City Health Office (CHO)</span>
                      <span className="portal-card-sub" style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '2px' }}>Central Systems &amp; Analytics</span>
                    </div>
                    <span className="portal-card-arrow">→</span>
                  </button>

                  <button type="button" className="portal-card portal-card-bhw" onClick={() => handleRoleSelection('BHW')} aria-label="Select Barangay Health Worker portal">
                    <div className="portal-card-body">
                      <span className="portal-card-title" style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '16px' }}>Barangay Health Worker</span>
                      <span className="portal-card-sub" style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '2px' }}>Community Surveillance Data Entry</span>
                    </div>
                    <span className="portal-card-arrow">→</span>
                  </button>
                </div>
              </>
            )}

            {/* STEP 2A: CHO HUB LOCATIONS */}
            {step === 'cho_select' && (
              <>
                <div className="login-header" style={{ marginBottom: '25px', textAlign: 'left' }}>
                  <BackButton onClick={handleBackNavigation} color="#129968" style={{ marginBottom: '10px' }}>Back</BackButton>
                  <h2 style={{ fontSize: '26px', color: 'var(--text-main)', marginBottom: '6px' }}>Select Health Unit</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Identify your current administrative station hub.</p>
                  <div className="accent-bar" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <button type="button" className="portal-card portal-card-cho" onClick={() => handleChoSelection('CHO Unit I (Sala)')} aria-label="Select CHO Unit I">
                    <div className="portal-card-body">
                      <span className="portal-card-title" style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '16px' }}>CHO Unit I (Main)</span>
                      <span className="portal-card-sub" style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '2px' }}>City Hall Complex, Brgy. Sala Cabuyao, Laguna</span>
                    </div>
                    <span className="portal-card-arrow">→</span>
                  </button>

                  <button type="button" className="portal-card portal-card-cho" onClick={() => handleChoSelection('CHO Unit II (Pulo)')} aria-label="Select CHO Unit II">
                    <div className="portal-card-body">
                      <span className="portal-card-title" style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '16px' }}>CHO Unit II (Extension)</span>
                      <span className="portal-card-sub" style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '2px' }}>Pulo Health Center, Brgy. Pulo Cabuyao, Laguna</span>
                    </div>
                    <span className="portal-card-arrow">→</span>
                  </button>
                </div>
              </>
            )}

            {/* STEP 2B: BHW REGISTRY BLOCK */}
            {step === 'bhw_select' && (
              <>
                <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <BackButton onClick={handleBackNavigation} color="#129968" style={{ marginBottom: '10px' }}>Back</BackButton>
                  <h2 style={{ fontSize: '26px', color: 'var(--text-main)', marginBottom: '6px' }}>Assigned Locality</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Select your designated community operations sector.</p>
                </div>

                {loginError && (
                  <div className="cdms-msg-shake" style={{ backgroundColor: 'var(--input-bg)', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '15px', border: '1px solid rgba(239,68,68,0.35)' }}>
                    {loginError}
                  </div>
                )}

                <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '24px', textAlign: 'left' }}>
                  {cabuyaoBarangays.map((b) => (
                    <div key={b.name} onClick={() => { setSelectedContext(`Brgy. ${b.name}`); setLoginError(''); }} className={`brgy-option-card ${selectedContext === `Brgy. ${b.name}` ? 'brgy-option-active' : ''}`}>
                      <span className="brgy-option-name">Brgy. {b.name}</span>
                      <span className="brgy-option-badge">{b.district}</span>
                    </div>
                  ))}
                </div>

                <button type="button" className="submit-btn" onClick={handleBhwProceed} style={{ backgroundColor: '#129968', color: '#FFFFFF', width: '100%' }}>
                  Confirm Barangay Block
                </button>
              </>
            )}

            {/* STEP 3: API SECURED SIGN IN PANEL */}
            {step === 'auth' && (
              <>
                <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <BackButton onClick={handleBackNavigation} color="#129968" style={{ marginBottom: '10px' }}>Scope: {selectedContext}</BackButton>
                  <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Sign-In</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Please insert your account.</p>
                </div>

                <form onSubmit={handleFormSubmit}>
                  {loginError && (
                    <div className="cdms-msg-shake" style={{ backgroundColor: 'var(--input-bg)', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '15px', border: '1px solid rgba(239,68,68,0.35)' }}>
                      {loginError}
                    </div>
                  )}

                  <div className="form-group" style={{ textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>Username or Email address</label>
                    <input 
                      type="text"
                      className="form-input" 
                      placeholder="Enter your Username or Email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginTop: '20px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>Password</label>
                    
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        className="form-input" 
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ paddingRight: '45px' }} 
                        required 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute', right: '14px', background: 'none', border: 'none',
                          cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', padding: 0
                        }}
                      >
                        {showPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="form-options" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer', fontSize: '15px' }}>
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ accentColor: '#129968', width: '16px', height: '16px' }} 
                      /> 
                      Remember me
                    </label>
                    <span onClick={() => setStep('forgot_password')} style={{ color: '#129968', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
                      Forgot password?
                    </span>
                  </div>

                  <button type="submit" className="submit-btn" style={{ backgroundColor: '#129968', color: '#FFFFFF', marginTop: '10px' }}>
                    Sign In as {selectedRole}
                  </button>
                </form>
              </>
            )}

            {/* STEP 3.5: LOGIN OTP VERIFICATION */}
            {step === 'otp_login' && (
  <>
    <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
      <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Verify It's You</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        We sent a 6-digit code to your registered email. Enter it below to complete sign-in.
      </p>
    </div>
    <form onSubmit={handleLoginOtpSubmit}>
      {otpError && (
        <div className="cdms-msg-shake" style={{ backgroundColor: 'var(--input-bg)', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '15px', border: '1px solid rgba(239,68,68,0.35)' }}>
          {otpError}
        </div>
      )}
      <div className="form-group" style={{ textAlign: 'left' }}>
        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>
          Verification Code
        </label>
        <input
          type="text"
          className="form-input"
          placeholder="Enter 6-digit code"
          maxLength="6"
          value={loginOtp}
          onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, ''))}
          style={{ letterSpacing: '6px', textAlign: 'center', fontSize: '22px', fontWeight: 'bold' }}
          required
          autoFocus
        />
      </div>
      <button
        type="submit"
        disabled={otpLoading}
        className="submit-btn"
        style={{ backgroundColor: '#129968', color: '#FFFFFF', marginTop: '20px' }}
      >
        {otpLoading ? 'Verifying...' : 'Verify & Continue'}
      </button>
    </form>
    <div style={{ marginTop: '16px', textAlign: 'center' }}>
      <span
        onClick={async () => {
          if (!pendingUser) return;
          try {
            await fetch(`${API_URL}/api/send-login-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: pendingUser.id })
            });
            setOtpError('A new code has been sent to your email.');
          } catch {
            setOtpError('Failed to resend code. Please try again.');
          }
        }}
        style={{ color: '#129968', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}
      >
        Resend Code
      </span>
    </div>
  </>
)}

            {/* STEP: CHO CONTACT INFO (no self-registration for CHO) */}
            {step === 'cho_contact' && (
              <>
                <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <h2 style={{ fontSize: '26px', color: 'var(--text-main)', marginBottom: '8px' }}>CHO Account Access</h2>
                  <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    For security purposes, City Health Office accounts cannot be created through self-registration. Please contact your CHO unit directly to request an account.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ padding: '18px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'left' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '10px' }}>
                      CHO Unit I (Main - Sala)
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px' }}>
                      📞 Contact Number: <span style={{ color: '#129968', fontWeight: '600' }}>09478891074</span>
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                      ✉️ Email: <span style={{ color: '#129968', fontWeight: '600' }}>idkwutishappen@gmail.com</span>
                    </div>
                  </div>

                  <div style={{ padding: '18px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'left' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '10px' }}>
                      CHO Unit II (Extension - Pulo)
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px' }}>
                      📞 Contact Number: <span style={{ color: '#129968', fontWeight: '600' }}>09558411426</span>
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                      ✉️ Email: <span style={{ color: '#129968', fontWeight: '600' }}>jhon@gmail.com</span>
                    </div>
                  </div>
                </div>

                <BackButton onClick={() => setStep('role')} className="back-btn-boxed" style={{ marginTop: '24px', width: '100%', justifyContent: 'center' }}>Back to Portal</BackButton>
              </>
            )}


            {/* SIGNUP ROLE SELECTION */}
            {step === 'signup_role' && (
              <>
                <div className="login-header" style={{ marginBottom: '30px', textAlign: 'left' }}>
                  <BackButton onClick={handleBackNavigation} color="#129968" style={{ marginBottom: '10px' }}>Back</BackButton>
                  <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Create Surveillance Account</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Register as an authorized health encoder or BHW for Cabuyao City.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <button type="button" className="portal-card" onClick={() => { setSignupRole('BHW'); setStep('signup'); }}>
                    <div className="portal-card-body">
                      <span className="portal-card-title" style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '16px' }}>Barangay Health Worker</span>
                      <span className="portal-card-sub" style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '2px' }}>Community Surveillance Data Entry</span>
                    </div>
                    <span className="portal-card-arrow"></span>
                  </button>

                  <button type="button" className="portal-card" onClick={() => setStep('cho_contact')}>
                    <div className="portal-card-body">
                      <span className="portal-card-title" style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '16px' }}>City Health Office (CHO)</span>
                      <span className="portal-card-sub" style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '2px' }}>Central Systems &amp; Analytics</span>
                    </div>
                    <span className="portal-card-arrow"></span>
                  </button>
                </div>
              </>
            )}


            {/* FORGOT PASSWORD SECTION - Email Only */}
            {step === 'forgot_password' && (
              <>
                <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <BackButton onClick={handleBackNavigation} color="#129968" style={{ marginBottom: '10px' }}>Back to Login</BackButton>
                  <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Account Recovery</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Enter your registered email address to receive password reset instructions.</p>
                </div>

                <form onSubmit={handleRecoverySubmit}>
                  {loginError && (
                    <div className="cdms-msg-shake" style={{ backgroundColor: 'var(--input-bg)', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '15px', border: '1px solid rgba(239,68,68,0.35)', textAlign: 'left' }}>
                      {loginError}
                    </div>
                  )}
                  {recoverySuccess && (
                    <div className="cdms-msg-in" style={{ backgroundColor: 'var(--input-bg)', color: '#0369a1', padding: '12px', borderRadius: '6px', marginBottom: '15px', fontSize: '15px', border: '1px solid rgba(14,165,233,0.35)', textAlign: 'left' }}>
                      {recoverySuccess}
                    </div>
                  )}

                  <div className="form-group" style={{ textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>
                      Registered Email Address
                    </label>
                    <input 
                      type="text"
                      className="form-input" 
                      placeholder="e.g. cho_niugan or user@email.com" 
                      value={recoveryIdentity}
                      onChange={(e) => setRecoveryIdentity(e.target.value)}
                      required 
                    />
                  </div>

                  <button type="submit" className="submit-btn" style={{ backgroundColor: '#129968', color: '#FFFFFF', marginTop: '25px', width: '100%' }}>
                    Send Recovery Link
                  </button>
                </form>
              </>
            )}

            {/* SIGN UP SECTION */}
            {step === 'signup' && (
                <>
                    <div className="login-header" style={{ marginBottom: '14px', textAlign: 'left' }}>
                        <BackButton onClick={handleBackNavigation} color="#129968" style={{ marginBottom: '10px' }}>Back to Sign In</BackButton>
                        <h2 style={{ fontSize: '26px', color: 'var(--text-main)', marginBottom: '6px', fontWeight: 'bold' }}>Create an Account</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Request authorization to access the Cabuyao surveillance portal.</p>
                    </div>

                    <div className="cdms-auth-notice cdms-auth-notice-signup">
                        <span className="cdms-auth-notice-icon">ℹ</span>
                        <span>Registrations require approval from the City Health Office administrator before account activation.</span>
                    </div>

                    <form onSubmit={handleSignupSubmit}>
                        {signupError && (
                            <div className="cdms-msg-shake" style={{ backgroundColor: 'var(--input-bg)', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '15px', border: '1px solid rgba(239,68,68,0.35)', textAlign: 'left' }}>
                                {signupError}
                            </div>
                        )}
                        {signupSuccess && (
                            <div className="cdms-msg-in" style={{ backgroundColor: 'var(--input-bg)', color: '#0a5e42', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '15px', border: '1px solid rgba(18,153,104,0.35)', textAlign: 'left' }}>
                                {signupSuccess}
                            </div>
                        )}

                        {/* Full Name */}
                        <div className="form-group" style={{ textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>Full Name</label>
                            <input
                                type="text"
                                className="form-input cdms-field-icon cdms-field-user"
                                placeholder="Juan Dela Cruz"
                                value={signupName}
                                onChange={(e) => setSignupName(e.target.value)}
                                required
                            />
                        </div>

                        {/* Username */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>Username</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. juandelacruz"
                                value={signupUsername}
                                onChange={(e) => setSignupUsername(e.target.value)}
                                required
                            />
                        </div>

                        {/* Email */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>Email Address</label>
                            <input
                                type="email"
                                className="form-input cdms-field-icon cdms-field-mail"
                                placeholder="juan@example.com"
                                value={signupEmail}
                                onChange={(e) => setSignupEmail(e.target.value)}
                                required
                            />
                        </div>

                        {/* Mobile Number */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>Mobile Number</label>
                            <input
                                type="text"
                                className="form-input cdms-field-icon cdms-field-phone"
                                placeholder="09123456789"
                                value={signupMobile}
                                onChange={(e) => setSignupMobile(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                maxLength={11}
                            />
                        </div>

                        {/* Assigned Station */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>
                                Assigned Barangay
                            </label>
                            <div style={{ position: 'relative' }} ref={signupBarangayRef}>
                                <button
                                    type="button"
                                    onClick={() => setSignupBarangayOpen(!signupBarangayOpen)}
                                    style={{
                                        width: '100%', height: '42px', background: 'var(--input-bg)', color: 'var(--text-main)',
                                        border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 10px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        cursor: 'pointer', textAlign: 'left', fontSize: '15px'
                                    }}
                                >
                                    <span>{barangayList.find(b => String(b.id) === String(signupContext))?.name || '- Select your barangay -'}</span>
                                    <span style={{
                                        fontSize: '26px', opacity: 0.6, marginLeft: '8px',
                                        transition: 'transform 0.2s', display: 'inline-block',
                                        transform: signupBarangayOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                                    }}>▼</span>
                                </button>
                                {signupBarangayOpen && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                                        maxHeight: '220px', overflowY: 'auto', marginTop: '4px',
                                        background: 'var(--input-bg)', border: '1px solid var(--border-color)',
                                        borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                                        padding: '4px'
                                    }}>
                                        {barangayList.map(b => (
                                            <div
                                                key={b.id}
                                                onClick={() => { setSignupContext(String(b.id)); setSignupBarangayOpen(false); }}
                                                style={{
                                                    padding: '9px 12px', cursor: 'pointer', fontSize: '15px', borderRadius: '6px',
                                                    background: String(signupContext) === String(b.id) ? 'rgba(18,153,104,0.15)' : 'transparent',
                                                    color: String(signupContext) === String(b.id) ? '#129968' : 'var(--text-main)',
                                                    fontWeight: String(signupContext) === String(b.id) ? '600' : '400'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                                onMouseLeave={e => { e.currentTarget.style.background = String(signupContext) === String(b.id) ? 'rgba(18,153,104,0.15)' : 'transparent'; }}
                                            >
                                                {b.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Password */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>Password</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showSignupPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={signupPassword}
                                    onChange={(e) => setSignupPassword(e.target.value)}
                                    style={{ paddingRight: '45px' }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                                    style={{ position: 'absolute', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
                                >
                                    {showSignupPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '500' }}>Confirm Password</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showSignupConfirm ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={signupConfirmPassword}
                                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                    style={{ paddingRight: '45px' }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSignupConfirm(!showSignupConfirm)}
                                    style={{ position: 'absolute', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
                                >
                                    {showSignupConfirm ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {signupConfirmPassword && (
                                <p style={{ fontSize: '15px', marginTop: '5px', color: signupPassword === signupConfirmPassword ? '#129968' : '#ef4444' }}>
                                    {signupPassword === signupConfirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                                </p>
                            )}
                            {signupPassword && (() => {
                                const strength = getPasswordStrength(signupPassword);
                                const styles = {
                                    low: { color: '#ef4444', text: '✗ Weak - needs uppercase + number + special' },
                                    medium: { color: '#eab308', text: '~ Medium - add uppercase, number & special for strongest' },
                                    strong: { color: '#129968', text: '✓ Strong password' },
                                };
                                const s = styles[strength];
                                return <p style={{ fontSize: '15px', marginTop: '5px', color: s.color }}>{s.text}</p>;
                            })()}
                        </div>

                        <button type="submit" className="submit-btn" style={{ backgroundColor: '#129968', color: '#FFFFFF', marginTop: '20px', width: '100%' }}>
                            Submit Account Registration
                        </button>
                    </form>
                </>
            )}

            {/* SHARED FOOTER ROUTING */}
            {step !== 'signup' && step !== 'forgot_password' && step !== 'cho_contact' && step !== 'signup_role' ? (
              <div style={{ marginTop: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px' }}>
                Don't have an account? <span onClick={() => {
                  if (step === 'role') {
                    setStep('signup_role');
                    return;
                  }
                  if (selectedRole === 'CHO') {
                    setStep('cho_contact');
                    return;
                  }
                  if (selectedRole === 'BHW' && selectedContext) {
                    const barangayName = selectedContext.replace(/^Brgy\.\s*/i, '').trim();
                    const matched = barangayList.find(b => b.name === barangayName);
                    if (matched) {
                      setSignupContext(String(matched.id));
                    }
                  }
                  setStep('signup');
                }} style={{ color: '#129968', cursor: 'pointer', fontWeight: '500' }}>Sign Up</span>
              </div>
            ) : (
              step !== 'role' && step !== 'cho_contact' && (
                <div style={{ marginTop: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px' }}>
                  Already have an account? <span onClick={() => setStep('role')} style={{ color: '#129968', cursor: 'pointer', fontWeight: '500' }}>Sign In</span>
                </div>
              )
            )}  

            </div>
          </div>
        </div>

        <div className="cdms-global-footer">
          <div className="cdms-global-footer-left">
            <span className="cdms-global-footer-badge"><ChoLogoIcon size={16} /></span>
            <span>© 2026 City Health Office of Cabuyao. All rights reserved.</span>
          </div>
          <div className="cdms-global-footer-center">
            <span className="cdms-global-footer-contact"><FooterIcon type="phone" />(049) 502-1234</span>
            <span className="cdms-global-footer-sep">|</span>
            <span className="cdms-global-footer-contact"><FooterIcon type="mail" />chounit1@cabuyao.gov.ph</span>
            <span className="cdms-global-footer-sep">|</span>
            <span className="cdms-global-footer-contact"><FooterIcon type="pin" />Sala Health Center, Brgy. Sala, Cabuyao, Laguna</span>
          </div>
          <div className="cdms-global-footer-right">
            <a href="#" onClick={(e) => { e.preventDefault(); setPolicyModal('privacy'); }}>Privacy Policy</a>
            <span className="cdms-global-footer-sep">|</span>
            <a href="#" onClick={(e) => { e.preventDefault(); setPolicyModal('terms'); }}>Terms of Use</a>
            <span className="cdms-global-footer-sep">|</span>
            <a href="#" onClick={(e) => { e.preventDefault(); setPolicyModal('disclaimer'); }}>Data Disclaimer</a>
          </div>
        </div>

        {policyModal && (
          <div className="cdms-modal-backdrop" onClick={() => setPolicyModal(null)}>
            <div className="cdms-modal-card cdms-policy-modal" onClick={(e) => e.stopPropagation()}>
              <div className="cdms-policy-header">
                <h3 className="cdms-policy-title">{POLICY_TITLES[policyModal]}</h3>
                <button type="button" className="cdms-policy-close" onClick={() => setPolicyModal(null)} aria-label="Close">✕</button>
              </div>
              <div className="cdms-policy-body">
                {POLICY_SECTIONS[policyModal].map((p, idx) => (
                  <p key={idx} className="cdms-policy-text">{p}</p>
                ))}
              </div>
              <div className="cdms-policy-footer">
                <button type="button" className="cdms-policy-agree" onClick={() => setPolicyModal(null)}>Agree</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }