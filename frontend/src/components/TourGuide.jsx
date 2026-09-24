import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useI18n } from '../i18n';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const ACCENT = 'var(--accent, #0d9488)';

// ── Role-based staff tour steps ──────────────────────────────────────────────
// Each step: { target  (CSS selector / data-tour marker),
//              title, desc (keys into i18n),
//              onBefore(ctx) → optional, runs before locating the target }
export const TOUR_STEPS = {
  CHO: [
    {
      target: '.cdms-dash-grid-main',
      title: 'Tour: Dashboard',
      desc: 'See live case totals, trends, top diseases, and period comparisons for your CHO unit. Use the filters to change disease and date range.',
      onBefore: (a) => a.setActiveTab('Dashboard'),
    },
    {
      target: '[data-tour="dash-repeat"]',
      title: 'Tour: Repeat Cases',
      desc: 'Flags the same patient reporting the same disease 2+ times in the selected period - a possible relapse or repeated infection needing follow-up.',
      onBefore: (a) => a.setActiveTab('Dashboard'),
    },
    {
      target: '[data-tour="dash-hotspots"]',
      title: 'Tour: Recurring Hotspots',
      desc: 'Shows diseases reported 2+ times in the same barangay, with the last report date - useful for spotting early outbreak clusters.',
      onBefore: (a) => a.setActiveTab('Dashboard'),
    },
    {
      target: '[data-tour="mc-carousel"]',
      title: 'Tour: Disease Programs',
      desc: 'Pick a disease program from the carousel to view, add, or manage its cases. Select a category, then a disease to open its case list.',
      onBefore: (a) => { if (a.setPendingMcLanding) a.setPendingMcLanding(true); a.setActiveTab('Manage Cases'); },
    },
    {
      target: '.cdms-inbox-tabs',
      title: 'Tour: Inbox Tabs',
      desc: 'Referrals, Edit Requests, Add Requests, Registrations, and Messages all live here. Approving a BHW add or edit request writes the case record directly.',
      onBefore: (a) => { if (a.setPendingInboxView) a.setPendingInboxView('inbox'); a.setActiveTab('Manage Cases'); },
    },
    {
      target: '[data-tour="mc-form"]',
      title: 'Tour: Add / Edit a Case',
      desc: 'This form records a case: patient details, disease, dates, symptoms, and location. As CHO you can edit existing cases directly and save new ones here.',
      scrollBlock: 'start',
      onBefore: (a) => { if (a.setPendingOpenAdd) a.setPendingOpenAdd(true); a.setActiveTab('Manage Cases'); },
    },
    {
      target: '[data-tour="br-generate"]',
      title: 'Tour: Audit Reports',
      desc: 'Browse the audit logs and generate program reports here. Filter by report type and period, then click Generate Report.',
      onBefore: (a) => a.setActiveTab('Audit Reports'),
    },
    {
      target: '.cdms-map-sidebar',
      title: 'Tour: Map View',
      desc: 'Your map is scoped to your CHO unit’s assigned barangays. Use the filters to narrow the view by disease or date; the legend explains pin colors by case count.',
      onBefore: (a) => a.setActiveTab('Map View'),
    },
    {
      target: '.cdms-um-toolbar',
      title: 'Tour: User Accounts',
      desc: 'Add CHO/BHW accounts and approve pending BHW registrations here. You can also restore archived accounts from the 🗄️ button. Replay this guide anytime with ❓ Show Guide.',
      onBefore: (a) => a.setActiveTab('User Accounts'),
    },
    {
      target: '.menu-grid',
      title: 'Tour: Settings',
      desc: 'Manage your profile, 2FA, notification channels (email + SMS), theme, language, and system data backup/restore from this menu.',
      onBefore: (a) => a.setActiveTab('Settings'),
    },
  ],
  BHW: [
    {
      target: '.cdms-dash-grid-main',
      title: 'Tour: Dashboard',
      desc: 'See live case totals and trends for your barangay. The period and disease filters let you focus the view.',
      onBefore: (a) => a.setActiveTab('Dashboard'),
    },
    {
      target: '[data-tour="dash-repeat"]',
      title: 'Tour: Case Insights',
      desc: 'Repeat Cases and Recurring Hotspots flag patients or barangays that keep appearing in the period - worth an extra check.',
      onBefore: (a) => a.setActiveTab('Dashboard'),
    },
    {
      target: '[data-tour="mc-carousel"]',
      title: 'Tour: Disease Programs',
      desc: 'Pick a disease program from the carousel to add and view cases in your barangay. New cases you submit are sent to the CHO for approval.',
      onBefore: (a) => { if (a.setPendingMcLanding) a.setPendingMcLanding(true); a.setActiveTab('Manage Cases'); },
    },
    {
      target: '.cdms-inbox-tabs',
      title: 'Tour: Requests & Notifications',
      desc: 'Track the status of your submitted cases here - CHOs approve or reject them, and their response will show as a notification.',
      onBefore: (a) => { if (a.setPendingInboxView) a.setPendingInboxView('inbox'); a.setActiveTab('Manage Cases'); },
    },
    {
      target: '[data-tour="mc-form"]',
      title: 'Tour: Add / Edit a Case',
      desc: 'This form records a case: patient details, disease, dates, symptoms, and location. Your save action reads Submit to CHO - new cases you create are routed to the CHO inbox for approval.',
      scrollBlock: 'start',
      onBefore: (a) => { if (a.setPendingOpenAdd) a.setPendingOpenAdd(true); a.setActiveTab('Manage Cases'); },
    },
    {
      target: '[data-tour="br-generate"]',
      title: 'Tour: Audit Reports',
      desc: 'Browse the audit logs and generate program reports here. Filter by report type and period, then click Generate Report.',
      onBefore: (a) => a.setActiveTab('Audit Reports'),
    },
    {
      target: '.cdms-map-sidebar',
      title: 'Tour: Map View',
      desc: 'Your map is scoped to your assigned barangay. Use the filters to narrow the view; the legend explains pin colors by case count, and zooming to max shows individual case dots.',
      onBefore: (a) => a.setActiveTab('Map View'),
    },
    {
      target: '[data-tour="roles-table"]',
      title: 'Tour: Roles & Permissions',
      desc: 'These are the permissions granted to your BHW account. You add and submit cases, while approvals and user management stay with the CHO. Replay this guide anytime with the Guides button above.',
      onBefore: (a) => a.setActiveTab('Roles & Permissions'),
    },
    {
      target: '.menu-grid',
      title: 'Tour: Settings',
      desc: 'Manage your profile, 2FA, notification channels (email + SMS), theme, language, and system preferences from this menu.',
      onBefore: (a) => a.setActiveTab('Settings'),
    },
  ],
  RESIDENT: [
    {
      target: '.resident-map-area',
      title: 'Tour: Disease Map',
      desc: 'Hover a barangay for a quick summary, click for the full disease breakdown, and zoom in to see purok-level case dots.',
    },
    {
      target: '.resident-nav-desktop',
      title: 'Tour: Navigation',
      desc: 'Browse the About, Contact, Help, and Prevention Tips sections. Prevention Tips lists what to watch out for and how to stay safe.',
    },
    {
      target: '[data-tour="resident-lang"]',
      title: 'Tour: Language & Guide',
      desc: 'Switch between English and Filipino here, and press ❓ anytime to replay this short guide.',
    },
  ],
};

// ── Spotlight / tooltip tour ─────────────────────────────────────────────────
export default function TourGuide({ steps = [], stepCtx = {}, onDone, startIndex = 0 }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(startIndex);
  const [box, setBox] = useState(null);
  const [tip, setTip] = useState({ top: 0, left: 0, place: 'center', ready: false });
  const tipRef = useRef(null);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const stepsRef = useRef(steps);
  const currentRef = useRef(current);
  stepsRef.current = steps;
  currentRef.current = current;

  const getZoom = (el) => {
    try {
      const scroller = el.closest('.content-scroller');
      if (scroller && scroller.style && scroller.style.zoom) {
        const z = parseFloat(scroller.style.zoom);
        if (z && z > 0) return z;
      }
    } catch (e) {}
    return 1;
  };

  const applyMeasure = (idx) => {
    const s = stepsRef.current[idx];
    if (!s) return;
    let el = null;
    try { el = s.target ? document.querySelector(s.target) : null; } catch (e) {}
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const zoom = getZoom(el);
    setBox({
      top: rect.top / zoom,
      left: rect.left / zoom,
      width: Math.max(rect.width / zoom, 8),
      height: Math.max(rect.height / zoom, 8),
    });
  };

  const locate = (idx, tries = 0) => {
    const s = stepsRef.current[idx];
    if (!s) { onDone && onDone(); return; }
    let el = null;
    try { el = s.target ? document.querySelector(s.target) : null; } catch (e) { el = null; }
    if (el) {
      try { el.scrollIntoView({ block: s.scrollBlock || 'center', behavior: 'smooth' }); } catch (e) {}
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => applyMeasure(idx), 340);
    } else if (tries < 40) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => locate(idx, tries + 1), 120);
    } else {
      setBox(null);
    }
  };

  const activate = async (idx) => {
    const s = stepsRef.current[idx];
    if (!s || idx < 0 || idx >= stepsRef.current.length) return;
    setCurrent(idx);
    setBox(null);
    setTip({ top: 0, left: 0, place: 'center', ready: false });
    if (s.onBefore) { try { await s.onBefore(stepCtx); } catch (e) {} }
    locate(idx);
  };

  // First activation once the component mounts.
  useEffect(() => {
    activate(startIndex);
    return () => { clearTimeout(timerRef.current); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the highlight pinned while the user scrolls / resizes.
  useEffect(() => {
    let pending = false;
    const onMove = () => {
      if (pending) return;
      pending = true;
      rafRef.current = requestAnimationFrame(() => {
        pending = false;
        if (stepsRef.current[currentRef.current]) applyMeasure(currentRef.current);
      });
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Position the tooltip card around the spotlight box.
  useLayoutEffect(() => {
    if (!box) {
      setTip({ top: clamp(window.innerHeight / 2 - 110, 14, window.innerHeight - 240), left: clamp(window.innerWidth / 2 - 180, 12, window.innerWidth - 372), place: 'center', ready: true });
      return;
    }
    if (!tipRef.current) { setTip({ ...tip, ready: true }); return; }
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = tipRef.current.offsetWidth;
    const h = tipRef.current.offsetHeight;
    const gap = 14, pad = 12;
    let place = 'center', top = 0, left = 0;
    if (box && box.bottom + gap + h <= vh - pad) {
      place = 'below';
      top = box.bottom + gap;
      left = clamp(box.left + box.width / 2 - w / 2, pad, vw - w - pad);
    } else if (box && box.top - gap - h >= pad) {
      place = 'above';
      top = box.top - gap - h;
      left = clamp(box.left + box.width / 2 - w / 2, pad, vw - w - pad);
    } else if (box && box.left - gap - w >= pad) {
      place = 'left';
      left = box.left - gap - w;
      top = clamp(box.top + box.height / 2 - h / 2, pad, vh - h - pad);
    } else if (box && box.right + gap + w <= vw - pad) {
      place = 'right';
      left = box.right + gap;
      top = clamp(box.top + box.height / 2 - h / 2, pad, vh - h - pad);
    } else {
      place = 'center';
      top = clamp(vh / 2 - h / 2, pad, vh - h - pad);
      left = clamp(vw / 2 - w / 2, pad, vw - w - pad);
    }
    setTip({ top, left, place, ready: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, current]);

  if (!steps.length) return null;

  const step = steps[current] || {};
  const isLast = current === steps.length - 1;

  const arrow = (place) => {
    if (!box) return null;
    const size = 10;
    const common = { position: 'absolute', width: 0, height: 0, border: `${size}px solid transparent` };
    if (place === 'below') return <div style={{ ...common, borderTopColor: 'var(--bg-surface)', top: -size * 2, left: clamp(box.left + box.width / 2 - (tip.left + 48), 24, 190) }} />;
    if (place === 'above') return <div style={{ ...common, borderBottomColor: 'var(--bg-surface)', bottom: -size * 2, left: clamp(box.left + box.width / 2 - (tip.left + 48), 24, 190) }} />;
    if (place === 'left') return <div style={{ ...common, borderRightColor: 'var(--bg-surface)', right: -size * 2, top: clamp(box.top + box.height / 2 - (tip.top + 24), 20, 160) }} />;
    if (place === 'right') return <div style={{ ...common, borderLeftColor: 'var(--bg-surface)', left: -size * 2, top: clamp(box.top + box.height / 2 - (tip.top + 24), 20, 160) }} />;
    return null;
  };

  const btn = (label, onClick, opts = {}) => (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
        background: opts.primary ? '#0d9488' : 'var(--input-bg)',
        color: opts.primary ? '#fff' : 'var(--text-main)',
        cursor: 'pointer', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap',
        opacity: opts.disabled ? 0.45 : 1,
        ...(opts.plain ? { background: 'transparent', border: 'none', color: 'var(--text-muted)' } : {}),
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 94000, pointerEvents: 'none' }}>
      {/* dim backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.55)', pointerEvents: 'auto' }} />
      {/* spotlight highlight */}
      {box && (
        <div
          style={{
            position: 'fixed', pointerEvents: 'none',
            top: box.top, left: box.left, width: box.width, height: box.height,
            borderRadius: '10px',
            border: `2px solid ${ACCENT}`,
            boxShadow: '0 0 0 4px rgba(13,148,136,0.35), 0 10px 40px rgba(0,0,0,0.45)',
            background: 'transparent',
            zIndex: 1,
          }}
        />
      )}
      {/* tooltip */}
      <div
        ref={tipRef}
        style={{
          position: 'fixed', pointerEvents: 'auto', zIndex: 2,
          top: tip.top, left: tip.left,
          width: 'min(360px, calc(100vw - 24px))',
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: '14px', boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
          padding: '20px 20px 16px 20px', color: 'var(--text-main)',
          opacity: tip.ready ? 1 : 0,
          transition: 'opacity 0.18s ease',
        }}
      >
        {arrow(tip.place)}
        <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: ACCENT, marginBottom: '6px' }}>
          {`${t('Step')} ${current + 1} ${t('of')} ${steps.length}`}
        </div>
        <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-h)', margin: '0 0 8px 0' }}>{t(step.title)}</div>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: 1.5, color: 'var(--text-muted)' }}>{t(step.desc)}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {btn(t('Skip'), () => onDone && onDone(), { plain: true, disabled: false })}
          <div style={{ display: 'flex', gap: '8px' }}>
            {btn(t('Back'), () => activate(current - 1), { disabled: current === 0 })}
            {isLast
              ? btn(t('Done'), () => onDone && onDone(), { primary: true })
              : btn(t('Next'), () => activate(current + 1), { primary: true })}
          </div>
        </div>
      </div>
    </div>
  );
}