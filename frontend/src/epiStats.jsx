import { useMemo } from 'react';

export function computeEpiStats(cases) {
  const stats = {
    total: (cases || []).length,
    caseType: {},
    severity: {},
    status: {},
    vaccine: { Vaccinated: 0, Partially: 0, No: 0, Unknown: 0 },
  };
  (cases || []).forEach(c => {
    const ct = (c.case_type || '').trim();
    if (ct) stats.caseType[ct] = (stats.caseType[ct] || 0) + 1;
    const sv = (c.severity || '').trim();
    if (sv) stats.severity[sv] = (stats.severity[sv] || 0) + 1;
    const st = (c.status || '').trim();
    if (st) stats.status[st] = (stats.status[st] || 0) + 1;
    const vs = (c.vaccination_status || '').trim();
    if (!vs || vs === 'Unknown') stats.vaccine.Unknown++;
    else if (vs === 'Complete') stats.vaccine.Vaccinated++;
    else if (vs === 'Partially Vaccinated') stats.vaccine.Partially++;
    else stats.vaccine.No++;
  });
  return stats;
}

const SEVERITY_ORDER = ['Critical', 'Severe', 'Moderate', 'Mild', 'Asymptomatic'];
const STATUS_ORDER = ['Active', 'Pending', 'Under Treatment', 'Recovered', 'Deceased'];
const CASE_TYPE_ORDER = ['Suspected', 'Probable', 'Confirmed'];

export default function EpiPanel({ cases, t }) {
  const stats = useMemo(() => computeEpiStats(cases), [cases]);

  if (!stats.total) return null;

  const Row = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{value}</span>
    </div>
  );

  const rowsFor = (order, source) => order
    .filter(k => source[k])
    .map(k => <Row key={k} label={t(k)} value={source[k]} />);

  const Section = ({ title, rows }) => (rows.length ? (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{title}</div>
      {rows}
    </div>
  ) : null);

  const vaccineRows = [];
  if (stats.vaccine.Vaccinated) vaccineRows.push(<Row key="vacc" label={t('Vaccinated')} value={stats.vaccine.Vaccinated} />);
  if (stats.vaccine.Partially) vaccineRows.push(<Row key="part" label={t('Partially Vaccinated')} value={stats.vaccine.Partially} />);
  if (stats.vaccine.No) vaccineRows.push(<Row key="no" label={t('Not Vaccinated')} value={stats.vaccine.No} />);
  if (stats.vaccine.Unknown) vaccineRows.push(<Row key="unk" label={t('Unknown')} value={stats.vaccine.Unknown} />);

  return (
    <div style={{ marginTop: '14px', padding: '14px 14px 4px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        {t('Epidemiology')}
      </div>
      <Section title={t('Case Types')} rows={rowsFor(CASE_TYPE_ORDER, stats.caseType)} />
      <Section title={t('Severity')} rows={rowsFor(SEVERITY_ORDER, stats.severity)} />
      <Section title={t('Outcomes')} rows={rowsFor(STATUS_ORDER, stats.status)} />
      <Section title={t('Vaccination')} rows={vaccineRows} />
    </div>
  );
}