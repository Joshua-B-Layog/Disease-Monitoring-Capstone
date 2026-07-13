import { useState } from 'react';

const CHO_UNITS = [
  {
    id: 'cho1',
    name: 'CHO Unit I (Sala)',
    motto: 'Healthy Barangays, Stronger Communities',
    mission: 'To deliver accessible, responsive, and quality primary health care services to all residents of CHO Unit I covered barangays through effective disease prevention, health promotion, and community engagement.',
    vision: 'A healthy and resilient community where every individual has equitable access to comprehensive health services, empowering them to achieve their highest level of well-being.',
    staff: [
      { name: 'Dr. Maria Santos', role: 'City Health Officer' },
      { name: 'Nurse Jenna Reyes', role: 'Public Health Nurse' },
      { name: 'Ronald Mercado', role: 'Sanitary Inspector' },
      { name: 'Liezl Dela Cruz', role: 'Midwife Coordinator' },
    ],
    hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
    address: 'Sala Health Center, Brgy. Sala, Cabuyao, Laguna',
    phone: '(049) 502-1234',
    email: 'chounit1@cabuyao.gov.ph',
    residentCount: '~45,000',
    accreditation: 'DOH Licensed Primary Care Facility, Level 1',
    latitude: 14.2690,
    longitude: 121.1350,
    coveredBarangays: ['Barangay Uno (Poblacion)', 'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)', 'Sala', 'Bigaa', 'Butong', 'Marinig', 'Gulod', 'Niugan', 'Baclaran'],
  },
  {
    id: 'cho2',
    name: 'CHO Unit II (Pulo)',
    motto: 'Compassionate Care, Lasting Health',
    mission: 'To provide compassionate, equitable, and excellent health services to the communities of CHO Unit II, with a focus on maternal and child health, disease surveillance, and environmental health.',
    vision: 'A model public health unit where every family enjoys optimal health through proactive prevention, timely intervention, and collaborative community partnerships.',
    staff: [
      { name: 'Dr. John Carlos', role: 'Unit Head' },
      { name: 'Nurse Angela Cruz', role: 'Public Health Nurse' },
      { name: 'Michael Tan', role: 'Medical Technologist' },
      { name: 'Sarah Lim', role: 'Barangay Health Worker Supervisor' },
    ],
    hours: 'Monday - Saturday, 7:00 AM - 6:00 PM',
    address: 'Pulo Health Center, Brgy. Pulo, Cabuyao, Laguna',
    phone: '(049) 502-5678',
    email: 'chounit2@cabuyao.gov.ph',
    residentCount: '~38,000',
    accreditation: 'DOH Accredited Primary Care Facility, Level 2',
    latitude: 14.2480,
    longitude: 121.1390,
    coveredBarangays: ['Pulo', 'Banay-Banay', 'Banlic', 'Mamatid', 'San Isidro', 'Diezmo', 'Pittland', 'Casile'],
  },
];

export default function AboutCho() {
  const [selected, setSelected] = useState(CHO_UNITS[0]);

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: '700' }}>
        About the City Health Office
      </h2>
      <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: '14px' }}>
        Cabuyao City Health Office is divided into two units. Select a unit below to learn more.
      </p>

      {/* Unit selector */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }}>
        {CHO_UNITS.map(u => (
          <button key={u.id} onClick={() => setSelected(u)}
            style={{
              flex: 1, padding: '14px 20px', border: '2px solid',
              borderColor: selected.id === u.id ? '#10B981' : 'var(--border-color)',
              borderRadius: '10px', background: selected.id === u.id ? '#f0fdfa' : 'var(--bg-surface)',
              color: selected.id === u.id ? '#10B981' : 'var(--text-muted)',
              fontWeight: selected.id === u.id ? '700' : '500',
              fontSize: '15px', cursor: 'pointer', textAlign: 'center',
              transition: 'all 0.2s',
            }}>
            {u.name}
          </button>
        ))}
      </div>

      {/* Unit details */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px',
        overflow: 'hidden', marginBottom: '24px',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #00308F 100%)',
          padding: '24px', color: '#fff',
        }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '700' }}>{selected.name}</h3>
          <p style={{ margin: 0, fontStyle: 'italic', color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>
            "{selected.motto}"
          </p>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Mission & Vision */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'var(--input-bg)', borderRadius: '8px', padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Our Mission
              </div>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)' }}>
                {selected.mission}
              </p>
            </div>
            <div style={{ background: 'var(--input-bg)', borderRadius: '8px', padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1d4ed8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Our Vision
              </div>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)' }}>
                {selected.vision}
              </p>
            </div>
          </div>

          {/* Staff */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '700', color: 'var(--text-main)' }}>
              Staff
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxWidth: '600px', margin: '0 auto' }}>
              {selected.staff.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', background: 'var(--bg-main)', borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: '#10B981', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '13px', flexShrink: 0,
                  }}>
                    {s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{s.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key info */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}>
            <InfoCard label="Office Hours" value={selected.hours} />
            <InfoCard label="Location" value={selected.address} />
            <InfoCard label="Phone" value={selected.phone} />
            <InfoCard label="Email" value={selected.email} />
            <InfoCard label="Covered Residents" value={selected.residentCount} />
            <InfoCard label="Accreditation" value={selected.accreditation} />
          </div>

          {/* Covered barangays */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
              Covered Barangays
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selected.coveredBarangays.map((b, i) => (
                <span key={i} style={{
                  padding: '4px 12px', background: 'var(--input-bg)', borderRadius: '20px',
                  fontSize: '13px', color: 'var(--text-muted)',
                }}>
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div style={{
      padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px',
      border: '1px solid #f1f5f9',
    }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-main)' }}>
        {value}
      </div>
    </div>
  );
}
