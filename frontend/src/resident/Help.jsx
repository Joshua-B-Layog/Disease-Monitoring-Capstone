import { useState } from 'react';

export default function Help() {
  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: '700' }}>
        Help & Resources
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Section 1: User Guides & Tutorials */}
        <Section title="User Guides & Video Tutorials" icon="📚">
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Learn how to use the Cabuyao Disease Monitoring System and understand disease prevention.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <ResourceCard
              title="How to Use the Disease Map"
              desc="Learn to navigate the disease tracking map and understand case data."
              type="Guide"
            />
            <ResourceCard
              title="Understanding Disease Statistics"
              desc="A guide to reading charts, trends, and outbreak indicators."
              type="Guide"
            />
            <ResourceCard
              title="Symptom Checker Tutorial"
              desc="How to use the symptom checker to assess your health."
              type="Video"
            />
            <ResourceCard
              title="Prevention Tips Overview"
              desc="Quick overview of preventing common diseases in Cabuyao."
              type="Video"
            />
          </div>
          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <span style={{
              padding: '8px 20px', background: 'var(--input-bg)', borderRadius: '6px',
              fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-block',
            }}>
              Contact Support: chosupport@cabuyao.gov.ph
            </span>
          </div>
        </Section>

        {/* Section 2: General Disease Symptoms */}
        <Section title="Common Disease Symptoms" icon="🩺">
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
            If you or a family member experience any of these symptoms, consult a health professional.
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
          }}>
            {SYMPTOMS.map((s, i) => (
              <div key={i} style={{
                padding: '12px 14px', background: 'var(--bg-main)', borderRadius: '8px',
                border: '1px solid #f1f5f9',
              }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Section 3: Severe Diseases Warning */}
        <Section title="Warning Signs of Severe Diseases" icon="⚠️" danger>
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
            padding: '16px 20px', marginBottom: '12px',
          }}>
            <p style={{
              margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: '#fca5a5',
            }}>
              Seek immediate medical care if you experience:
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#f87171', fontSize: '14px', lineHeight: '2' }}>
              {SEVERE_WARNINGS.map((w, i) => (
                <li key={i}><strong>{w}</strong></li>
              ))}
            </ul>
          </div>
          <div style={{
            textAlign: 'center', padding: '12px', background: 'rgba(16,185,129,0.12)',
            borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)',
          }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#34d399' }}>
              🚑 If you have any of these symptoms, GO TO THE HOSPITAL IMMEDIATELY.
            </div>
            <div style={{ fontSize: '13px', color: '#15803d', marginTop: '4px' }}>
              Call 911 or your local emergency hotline.
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({ title, icon, children, danger }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: danger ? '2px solid #fecaca' : '1px solid var(--border-color)',
      borderRadius: '12px', padding: '24px',
    }}>
      <h3 style={{
        margin: '0 0 16px', fontSize: '18px', fontWeight: '700',
        color: danger ? '#dc2626' : 'var(--text-main)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ResourceCard({ title, desc, type }) {
  return (
    <div style={{
      padding: '14px', background: 'var(--bg-main)', borderRadius: '8px',
      border: '1px solid #f1f5f9', cursor: 'pointer',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px',
      }}>
        <span style={{
          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
          background: type === 'Video' ? '#fef3c7' : '#dbeafe',
          color: type === 'Video' ? '#92400e' : '#1e40af',
        }}>
          {type}
        </span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>
    </div>
  );
}

const SYMPTOMS = [
  { icon: '🌡️', name: 'High Fever', desc: 'Body temperature above 38°C (100.4°F)' },
  { icon: '🤕', name: 'Severe Headache', desc: 'Persistent, intense head pain' },
  { icon: '🦴', name: 'Muscle & Joint Pain', desc: 'Body aches and stiffness' },
  { icon: '🤢', name: 'Nausea & Vomiting', desc: 'Feeling sick and throwing up' },
  { icon: '💧', name: 'Diarrhea', desc: 'Frequent, watery bowel movements' },
  { icon: '😮‍💨', name: 'Difficulty Breathing', desc: 'Shortness of breath or wheezing' },
  { icon: '🥱', name: 'Fatigue', desc: 'Extreme tiredness or weakness' },
  { icon: '🥶', name: 'Chills & Sweats', desc: 'Alternating feeling hot and cold' },
  { icon: '🩻', name: 'Persistent Cough', desc: 'Cough lasting more than 2 weeks' },
  { icon: '🫀', name: 'Chest Pain', desc: 'Pain or pressure in the chest area' },
];

const SEVERE_WARNINGS = [
  'Severe abdominal pain',
  'Unexplained high fever',
  'Bleeding gums or nose',
  'Loss of consciousness',
  'Difficulty breathing',
  'Unexplained weight loss',
];
