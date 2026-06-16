import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ManageCases.css';

// ── All disease cards split into 2 pages of 6 ──
const DISEASE_PAGES = [
  [
    { id: 1, name: 'Dengue Fever', dbName: 'Dengue', icon: '🌡️', color: '#ef4444', desc: 'A viral infection transmitted by Aedes mosquitoes, causing high fever and severe body aches.' },
    { id: 2, name: 'Influenza A', dbName: 'Influenza A', icon: '🦠', color: '#f59e0b', desc: 'A highly contagious respiratory illness caused by influenza viruses, leading to seasonal outbreaks.' },
    { id: 3, name: 'Covid-19', dbName: 'Covid-19', icon: '🛡️', color: '#3b82f6', desc: 'An infectious respiratory disease caused by the SARS-CoV-2 virus, requiring close contact tracing.' },
    { id: 4, name: 'Leptospirosis', dbName: 'Leptospirosis', icon: '💧', color: '#10b981', desc: 'A bacterial disease spread through contaminated water, posing a high risk during flood seasons.' },
    { id: 5, name: 'Tuberculosis', dbName: 'Tuberculosis', icon: '🫁', color: '#f97316', desc: 'An infectious bacterial disease that primarily affects the lungs, requiring long-term treatment.' },
    { id: 6, name: 'Typhoid Fever', dbName: 'Typhoid Fever', icon: '🧫', color: '#8b5cf6', desc: 'A systemic infection caused by Salmonella Typhi, spread through contaminated food and water.' },
  ],
  [
    { id: 7, name: 'Cholera', dbName: 'Cholera', icon: '🌊', color: '#0ea5e9', desc: 'An acute diarrheal infection caused by ingestion of food or water contaminated with Vibrio cholerae.' },
    { id: 8, name: 'Measles', dbName: 'Measles', icon: '🔴', color: '#dc2626', desc: 'A highly contagious viral disease causing fever and rash, preventable through vaccination.' },
    { id: 9, name: 'Hepatitis A', dbName: 'Hepatitis A', icon: '🫀', color: '#ca8a04', desc: 'A viral liver infection spread through contaminated food and water or close contact.' },
    { id: 10, name: 'Hepatitis B', dbName: 'Hepatitis B', icon: '🩸', color: '#b45309', desc: 'A serious liver infection caused by the hepatitis B virus, transmitted through blood and bodily fluids.' },
    { id: 11, name: 'Rabies', dbName: 'Rabies', icon: '🐾', color: '#7c3aed', desc: 'A fatal viral disease transmitted through the bite of an infected animal, requiring immediate treatment.' },
    { id: 12, name: 'Other Communicable Diseases', dbName: 'Other', icon: '➕', color: '#64748b', desc: 'General tracking for various infectious diseases and emerging local health threats within the community.' },
  ],
];

// All known disease dbNames for "Other" matching
const KNOWN_DB_NAMES = DISEASE_PAGES.flat()
  .filter(d => d.dbName !== 'Other')
  .map(d => d.dbName.toLowerCase());

const ALL_DISEASE_OPTIONS = [
  'Dengue','Influenza A','Covid-19','Leptospirosis','Tuberculosis','Typhoid Fever',
  'Cholera','Measles','Hepatitis A','Hepatitis B','Rabies',
  'Acute Respiratory Infection','Avian Influenza','Chickenpox','Diphtheria','Ebola',
  'Hand Foot and Mouth Disease','Hepatitis C','HIV/AIDS','Influenza','Influenza A (H1N1)',
  'Leprosy','Malaria','Meningococcemia','Pertussis','Poliomyelitis','SARS','Sore Eyes',
];

const CABUYAO_BARANGAYS = [
  'Baclaran','Banay-Banay','Banlic','Barangay Dos (Poblacion)','Barangay Tres (Poblacion)',
  'Barangay Uno (Poblacion)','Bigaa','Butong','Casile','Diezmo','Gulod','Mamatid',
  'Marinig','Niugan','Pitland','Pulo','Sala','San Isidro'
];

const CASES_PER_PAGE = 10;

const EMPTY_FORM = {
  patientName: '', diseaseType: '', age: '', severity: 'Mild',
  gender: 'Male', status: 'Active', contact: '', onsetDate: '',
  address: '', barangayId: '', symptoms: '', physician: '',
  lat: '', lng: '', specificDisease: ''
};

export default function ManageCases() {
  const [view, setView] = useState('categories'); // 'categories' | 'list' | 'add' | 'edit'
  const [cardPage, setCardPage] = useState(0);
  const [selectedDisease, setSelectedDisease] = useState(null); // card object
  const [editingCase, setEditingCase] = useState(null); // case object for edit

  const [allCases, setAllCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [barangayList, setBarangayList] = useState([]);

  // Table filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarangay, setFilterBarangay] = useState('All Barangays');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [tablePage, setTablePage] = useState(1);

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null); // case object
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add/Edit form
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Fetch all cases
  const fetchCases = () => {
    setLoadingCases(true);
    axios.get('http://localhost:5000/api/disease_cases')
      .then(res => { setAllCases(res.data); setLoadingCases(false); })
      .catch(() => setLoadingCases(false));
  };

  useEffect(() => { fetchCases(); }, []);

  useEffect(() => {
    axios.get('http://localhost:5000/api/barangays')
      .then(res => setBarangayList(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Match cases to disease card ──
  const matchesCard = (caseItem, card) => {
    if (!caseItem.disease_name) return false;
    const dn = caseItem.disease_name.toLowerCase();
    if (card.dbName === 'Other') {
      return !KNOWN_DB_NAMES.includes(dn);
    }
    return dn === card.dbName.toLowerCase();
  };

  const getCaseCount = (card) => allCases.filter(c => matchesCard(c, card)).length;

  // ── Filter cases for list ──
  const getFilteredCases = () => {
    let result = selectedDisease
      ? allCases.filter(c => matchesCard(c, selectedDisease))
      : allCases;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        (c.patient_name || '').toLowerCase().includes(q) ||
        String(c.case_id).includes(q)
      );
    }
    if (filterBarangay !== 'All Barangays') {
      result = result.filter(c => c.barangay_name === filterBarangay);
    }
    if (filterStatus !== 'All Status') {
      result = result.filter(c => c.status === filterStatus);
    }
    return result;
  };

  const filteredCases = getFilteredCases();
  const totalTablePages = Math.ceil(filteredCases.length / CASES_PER_PAGE);
  const paginatedCases = filteredCases.slice(
    (tablePage - 1) * CASES_PER_PAGE,
    tablePage * CASES_PER_PAGE
  );

  const getStatusStyle = (status) => {
    if (status === 'Active') return { background: '#fef3c7', color: '#d97706' };
    if (status === 'Pending') return { background: '#dbeafe', color: '#2563eb' };
    if (status === 'Under Treatment') return { background: '#ede9fe', color: '#7c3aed' };
    if (status === 'Recovered') return { background: '#d1fae5', color: '#059669' };
    if (status === 'Deceased') return { background: '#fee2e2', color: '#dc2626' };
    if (status === 'Draft') return { background: '#e2e8f0', color: '#64748b' };
    return { background: '#e2e8f0', color: '#64748b' };
  };

  // ── EXPORT helpers ──
  const buildExportRows = () => filteredCases.map(c =>
    `"${c.case_id}","${c.patient_name || ''}","${c.age || ''}","${c.barangay_name || ''}","${c.disease_name || ''}","${c.severity || ''}","${c.status || ''}","${c.date_reported || ''}"`
  ).join('\n');

  const handleExportCSV = () => {
    const headers = 'Case ID,Patient Name,Age,Barangay,Disease,Severity,Status,Date Reported\n';
    const blob = new Blob([headers + buildExportRows()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `CDMS_${selectedDisease?.name || 'Cases'}_Export.csv`; a.click();
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    const headers = 'Case ID\tPatient Name\tAge\tBarangay\tDisease\tSeverity\tStatus\tDate Reported\n';
    const rows = filteredCases.map(c =>
      `${c.case_id}\t${c.patient_name || ''}\t${c.age || ''}\t${c.barangay_name || ''}\t${c.disease_name || ''}\t${c.severity || ''}\t${c.status || ''}\t${c.date_reported || ''}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `CDMS_${selectedDisease?.name || 'Cases'}_Export.xls`; a.click();
    setShowExportMenu(false);
  };

  const handleExportWord = () => {
    const rows = filteredCases.map(c =>
      `<tr><td>${c.case_id}</td><td>${c.patient_name || ''}</td><td>${c.age || ''}</td><td>${c.barangay_name || ''}</td><td>${c.disease_name || ''}</td><td>${c.severity || ''}</td><td>${c.status || ''}</td></tr>`
    ).join('');
    const html = `<html><head><meta charset="utf-8"></head><body>
      <h2>CDMS — ${selectedDisease?.name || 'Cases'} Export</h2>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead><tr style="background:#1e3a8a;color:white;"><th>ID</th><th>Patient</th><th>Age</th><th>Barangay</th><th>Disease</th><th>Severity</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></body></html>`;
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `CDMS_${selectedDisease?.name || 'Cases'}_Export.doc`; a.click();
    setShowExportMenu(false);
  };

  // ── DELETE ──
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`http://localhost:5000/api/cases/${deleteTarget.case_id}`);
      fetchCases();
      setDeleteTarget(null);
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── OPEN EDIT ──
  const openEdit = (caseItem) => {
    // Find barangay id from list
    const brgy = barangayList.find(b => b.name === caseItem.barangay_name);
    setFormData({
      patientName: caseItem.patient_name || '',
      diseaseType: caseItem.disease_name || '',
      age: caseItem.age || '',
      severity: caseItem.severity || 'Mild',
      gender: caseItem.gender || 'Male',
      status: caseItem.status || 'Active',
      contact: caseItem.contact || '',
      onsetDate: caseItem.onset_date ? caseItem.onset_date.split('T')[0] : '',
      address: caseItem.address || '',
      barangayId: brgy ? brgy.id : '',
      symptoms: caseItem.symptoms || '',
      physician: caseItem.physician || '',
      lat: caseItem.latitude || '',
      lng: caseItem.longitude || '',
      specificDisease: '',
    });
    setEditingCase(caseItem);
    setView('edit');
  };

  // ── OPEN ADD ──
  const openAdd = () => {
    setFormData({
      ...EMPTY_FORM,
      diseaseType: selectedDisease?.dbName === 'Other' ? '' : (selectedDisease?.dbName || ''),
    });
    setEditingCase(null);
    setView('add');
  };

  // ── SAVE CASE (Add or Edit) ──
  const handleSave = async (e, isDraft = false) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitMsg('');

    // Find disease_id from diseases list — we'll pass the name and let server handle it
    const diseaseNameToSave = formData.diseaseType === 'Other Communicable Diseases'
      ? (formData.specificDisease || 'Other')
      : formData.diseaseType;

    const payload = {
      patient_name: formData.patientName,
      disease_name: diseaseNameToSave,
      age: formData.age || null,
      severity: formData.severity,
      gender: formData.gender,
      status: isDraft ? 'Draft' : formData.status,
      contact: formData.contact,
      onset_date: formData.onsetDate || null,
      address: formData.address,
      barangay_id: formData.barangayId || null,
      symptoms: formData.symptoms,
      physician: formData.physician,
      latitude: formData.lat || null,
      longitude: formData.lng || null,
    };

    try {
      if (editingCase) {
        await axios.put(`http://localhost:5000/api/cases/${editingCase.case_id}`, payload);
        setSubmitMsg('Case updated successfully!');
      } else {
        await axios.post('http://localhost:5000/api/cases', payload);
        setSubmitMsg(isDraft ? 'Case saved as draft!' : 'Case added successfully!');
      }
      await fetchCases();
      setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1200);
    } catch (err) {
      setSubmitMsg('Error: ' + (err.response?.data?.error || err.message));
      setSubmitLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #d1d5db', background: '#f9fafb', color: '#1f2937',
    fontSize: '14px', boxSizing: 'border-box', outline: 'none'
  };

  // ═══════════════════════════════════
  // VIEW: DISEASE CARDS
  // ═══════════════════════════════════
  if (view === 'categories') {
    const pageCards = DISEASE_PAGES[cardPage];
    return (
      <div style={{ padding: '28px', color: 'var(--text-main)' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
          Dashboard / Manage Cases
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '22px' }}>Select a Disease to Manage</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
              Choose which disease program you want to view, add, or manage cases for
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Page {cardPage + 1} / {DISEASE_PAGES.length}</span>
            <button onClick={() => setCardPage(0)} disabled={cardPage === 0}
              style={{ padding: '7px 16px', background: cardPage === 0 ? 'var(--input-bg)' : '#1E3A8A', color: cardPage === 0 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: cardPage === 0 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
              ← Prev
            </button>
            <button onClick={() => setCardPage(1)} disabled={cardPage === 1}
              style={{ padding: '7px 16px', background: cardPage === 1 ? 'var(--input-bg)' : '#1E3A8A', color: cardPage === 1 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: cardPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
              Next →
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {pageCards.map(disease => {
            const count = getCaseCount(disease);
            return (
              <div key={disease.id}
                onClick={() => { setSelectedDisease(disease); setTablePage(1); setSearchQuery(''); setFilterBarangay('All Barangays'); setFilterStatus('All Status'); setView('list'); }}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '28px', lineHeight: 1 }}>{disease.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-main)' }}>{disease.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{count} Active case{count !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ background: disease.color, color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 }}>
                    {count}
                  </div>
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.55' }}>{disease.desc}</p>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#3b82f6', fontSize: '13px', fontWeight: '600' }}>
                  View Cases <span style={{ fontSize: '16px' }}>›</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          {DISEASE_PAGES.map((_, i) => (
            <div key={i} onClick={() => setCardPage(i)}
              style={{ width: '10px', height: '10px', borderRadius: '50%', cursor: 'pointer', background: cardPage === i ? '#3b82f6' : 'var(--border-color)', transition: 'background 0.2s' }} />
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // VIEW: CASE LIST
  // ═══════════════════════════════════
  if (view === 'list') {
    return (
      <div style={{ padding: '28px', color: 'var(--text-main)' }}>
        {/* DELETE MODAL */}
        {deleteTarget && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '40px 32px', width: '420px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              {/* Warning icon */}
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '700', color: '#111827' }}>Are you sure?</h3>
              <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
                This action cannot be undone.<br />This will permanently delete the account of:
              </p>
              {/* Case info block */}
              <div style={{ background: '#f9fafb', border: 'none', borderLeft: '4px solid #ef4444', borderRadius: '6px', padding: '14px 18px', marginBottom: '20px', textAlign: 'left' }}>
                <div style={{ fontWeight: '700', color: '#111827', fontSize: '15px', marginBottom: '4px' }}>
                  Case ID: D-{String(deleteTarget.case_id).padStart(4, '0')}
                </div>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>
                  {deleteTarget.patient_name || 'Unknown'} – {deleteTarget.barangay_name || 'Unknown Barangay'}.
                </div>
              </div>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 28px 0' }}>
                All associated case records will remain but show as "System" for audit purposes.
              </p>
              <div style={{ display: 'flex', borderTop: '1px solid #e5e7eb', paddingTop: '20px', gap: '0' }}>
                <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
                  style={{ flex: 1, padding: '14px', background: 'transparent', border: 'none', borderRight: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '16px', fontWeight: '500', color: '#374151', borderRadius: '0 0 0 16px' }}>
                  Cancel
                </button>
                <button onClick={confirmDelete} disabled={deleteLoading}
                  style={{ flex: 1, padding: '14px', background: '#ef4444', border: 'none', cursor: deleteLoading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: '600', color: '#fff', borderRadius: '0 0 16px 0' }}>
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Dashboard / Manage Cases / {selectedDisease?.name}
            </div>
            <h2 style={{ margin: 0, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>{selectedDisease?.icon}</span> {selectedDisease?.name} Cases
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* EXPORT DROPDOWN */}
            <div style={{ position: 'relative' }} ref={exportRef}>
              <button onClick={() => setShowExportMenu(!showExportMenu)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export ▾
              </button>
              {showExportMenu && (
                <div style={{ position: 'absolute', top: '110%', right: 0, width: '180px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  {[
                    { label: '📄 Word (.doc)', action: handleExportWord },
                    { label: '📊 Excel (.xls)', action: handleExportExcel },
                    { label: '📋 CSV (.csv)', action: handleExportCSV },
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}
                      onMouseEnter={e => e.target.style.background = 'var(--input-bg)'}
                      onMouseLeave={e => e.target.style.background = 'transparent'}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => { setView('categories'); setSearchQuery(''); }}
              style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>
              ← Back
            </button>
            <button onClick={openAdd}
              style={{ padding: '8px 18px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              + Add Case
            </button>
          </div>
        </div>

        {/* Table card */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="Search Cases..."
              value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setTablePage(1); }}
              style={{ padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px', width: '200px' }} />
            <select value={filterBarangay} onChange={e => { setFilterBarangay(e.target.value); setTablePage(1); }}
              style={{ padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px' }}>
              <option>All Barangays</option>
              {CABUYAO_BARANGAYS.map(b => <option key={b}>{b}</option>)}
            </select>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setTablePage(1); }}
              style={{ padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px' }}>
              <option>All Status</option>
              <option>Active</option>
              <option>Pending</option>
              <option>Under Treatment</option>
              <option>Recovered</option>
              <option>Deceased</option>
              <option>Draft</option>
            </select>
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '13px' }}>
              {filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''} found
            </span>
          </div>

          {loadingCases ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading cases from database...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Case ID', 'Patient Name', 'Age', 'Barangay', 'Date Reported', 'Severity', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedCases.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '14px' }}>
                      No cases found for <strong>{selectedDisease?.name}</strong>
                      {(searchQuery || filterBarangay !== 'All Barangays' || filterStatus !== 'All Status') ? ' with current filters.' : '.'}
                    </td>
                  </tr>
                ) : (
                  paginatedCases.map(c => (
                    <tr key={c.case_id} style={{ borderBottom: '1px solid var(--border-color)', opacity: c.status === 'Draft' ? 0.6 : 1 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        #{String(c.case_id).padStart(3, '0')}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', fontWeight: '500', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.patient_name || 'Unknown'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.age || '--'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.barangay_name || '--'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-main)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {c.date_reported
                          ? new Date(c.date_reported).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                          : '--'}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.severity || 'N/A'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500', ...getStatusStyle(c.status) }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          {/* EDIT — always available */}
                          <button onClick={() => openEdit(c)}
                            title="Edit case"
                            style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px' }}>
                            ✏️
                          </button>
                          {/* DELETE */}
                          <button onClick={() => setDeleteTarget(c)}
                            title="Delete case"
                            style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalTablePages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Showing {(tablePage - 1) * CASES_PER_PAGE + 1}–{Math.min(tablePage * CASES_PER_PAGE, filteredCases.length)} of {filteredCases.length}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={tablePage === 1}
                  style={{ padding: '5px 12px', background: tablePage === 1 ? 'var(--input-bg)' : '#1E3A8A', color: tablePage === 1 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: tablePage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                  ← Prev
                </button>
                {Array.from({ length: totalTablePages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setTablePage(p)}
                    style={{ padding: '5px 10px', background: p === tablePage ? '#1E3A8A' : 'transparent', color: p === tablePage ? 'white' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', minWidth: '32px' }}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))} disabled={tablePage === totalTablePages}
                  style={{ padding: '5px 12px', background: tablePage === totalTablePages ? 'var(--input-bg)' : '#1E3A8A', color: tablePage === totalTablePages ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: tablePage === totalTablePages ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // VIEW: ADD / EDIT FORM
  // ═══════════════════════════════════
  if (view === 'add' || view === 'edit') {
    const isEdit = view === 'edit';
    const currentDisease = formData.diseaseType;
    const isOther = currentDisease === 'Other Communicable Diseases' || currentDisease === 'Other';
    const latVal = String(formData.lat || '').trim();
    const lngVal = String(formData.lng || '').trim();
    const hasCoords = latVal !== '' && lngVal !== '' && !isNaN(parseFloat(latVal)) && !isNaN(parseFloat(lngVal));
    const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lngVal)-0.01},${parseFloat(latVal)-0.01},${parseFloat(lngVal)+0.01},${parseFloat(latVal)+0.01}&layer=mapnik&marker=${latVal},${lngVal}`
    : null;

    return (
      <div style={{ padding: '28px' }}>
        <button onClick={() => setView('list')}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ← Back to {selectedDisease?.name} Cases
        </button>

        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', color: '#1e293b', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '24px', color: '#0f172a' }}>
              {isEdit ? 'Edit Case Report' : 'New Case Report'}
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              {isEdit
                ? `Editing: Case #${String(editingCase?.case_id).padStart(3,'0')} — ${editingCase?.patient_name}`
                : `Encoding new case under: ${selectedDisease?.name}`}
            </p>
          </div>

          {submitMsg && (
            <div style={{ background: submitMsg.startsWith('Error') ? '#fee2e2' : '#d1fae5', color: submitMsg.startsWith('Error') ? '#991b1b' : '#065f46', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '14px', fontWeight: '500' }}>
              {submitMsg.startsWith('Error') ? '❌' : '✅'} {submitMsg}
            </div>
          )}

          <form onSubmit={(e) => handleSave(e, false)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '24px' }}>

              {/* LEFT: Patient Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, color: '#334155', fontSize: '14px', fontWeight: '700', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                  Patient Information
                </h4>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Patient Full Name *</label>
                  <input type="text" required placeholder="e.g. Juan Dela Cruz" style={inputStyle}
                    value={formData.patientName} onChange={e => setFormData({ ...formData, patientName: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Age</label>
                    <input type="number" min="0" max="120" placeholder="25" style={inputStyle}
                      value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Gender</label>
                    <select style={inputStyle} value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                      <option>Male</option><option>Female</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Contact No.</label>
                  <input type="text" placeholder="0918-234-2331" style={inputStyle}
                    value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Address</label>
                  <input type="text" placeholder="123 Rizal St, San Isidro Cabuyao" style={inputStyle}
                    value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Assigned Barangay</label>
                  <select style={inputStyle} value={formData.barangayId}
                    onChange={e => setFormData({ ...formData, barangayId: e.target.value })}>
                    <option value="">— Select Barangay —</option>
                    {barangayList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {/* RIGHT: Clinical Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, color: '#334155', fontSize: '14px', fontWeight: '700', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                  Clinical Information
                </h4>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Disease Type</label>
                  <select style={inputStyle} value={currentDisease}
                    onChange={e => setFormData({ ...formData, diseaseType: e.target.value })}>
                    <option value="">— Select Disease —</option>
                    {ALL_DISEASE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    <option value="Other Communicable Diseases">Other Communicable Diseases</option>
                  </select>
                </div>
                {isOther && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Specify Disease *</label>
                    <input type="text" required placeholder="Enter disease name..." style={inputStyle}
                      value={formData.specificDisease} onChange={e => setFormData({ ...formData, specificDisease: e.target.value })} />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Severity Level</label>
                  <select style={inputStyle} value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })}>
                    <option>Mild</option><option>Moderate</option><option>Severe</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Patient Status</label>
                  <select style={inputStyle} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option>Active</option>
                    <option>Pending</option>
                    <option>Under Treatment</option>
                    <option>Recovered</option>
                    <option>Deceased</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Date of Onset</label>
                  <input type="date" style={inputStyle} value={formData.onsetDate}
                    onChange={e => setFormData({ ...formData, onsetDate: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Attending Physician</label>
                  <input type="text" placeholder="Dr. Jose Reyes, MD" style={inputStyle}
                    value={formData.physician} onChange={e => setFormData({ ...formData, physician: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Symptoms full width */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Symptoms & Observations</label>
              <textarea placeholder="e.g. Fever (39.5°C), Severe Headache, Muscle and Joint Pain, Rash on arms and legs..." rows="3"
                style={{ ...inputStyle, resize: 'vertical' }}
                value={formData.symptoms} onChange={e => setFormData({ ...formData, symptoms: e.target.value })} />
            </div>

            {/* Location & Coordinates + map preview */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '10px', fontWeight: '600' }}>
                Location & Coordinates{' '}
                <span style={{ color: '#9ca3af', fontWeight: '400', fontSize: '12px' }}>(optional)</span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: hasCoords ? '1fr 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>
                
                {/* Left: coordinate inputs + display */}
                <div>
                  {/* Show formatted coords if both filled */}
                  {hasCoords && (
                    <div style={{
                      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                      padding: '10px 14px', marginBottom: '12px', fontSize: '14px',
                      color: '#334155', fontWeight: '500'
                    }}>
                      {parseFloat(latVal).toFixed(4)}° N, {parseFloat(lngVal).toFixed(4)}° E
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Latitude (N)</label>
                      <input
                        type="text"
                        placeholder="e.g. 14.2253"
                        style={inputStyle}
                        value={formData.lat}
                        onChange={e => setFormData({ ...formData, lat: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Longitude (E)</label>
                      <input
                        type="text"
                        placeholder="e.g. 121.3025"
                        style={inputStyle}
                        value={formData.lng}
                        onChange={e => setFormData({ ...formData, lng: e.target.value })}
                      />
                    </div>
                  </div>

                  {!hasCoords && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
                      Enter coordinates above to see a map preview.
                    </p>
                  )}
                </div>

                {/* Right: map preview — only when coords are valid */}
                {hasCoords && (
                  <div style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <iframe
                      title="location-preview"
                      src={mapSrc}
                      width="100%"
                      height="100%"
                      style={{ border: 'none', display: 'block' }}
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
              <button type="button" onClick={() => setView('list')}
                style={{ padding: '10px 32px', borderRadius: '6px', border: 'none', background: '#e2e8f0', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>
                Cancel
              </button>
              {!isEdit && (
                <button type="button" onClick={(e) => handleSave(e, true)} disabled={submitLoading}
                  style={{ padding: '10px 28px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#f3f4f6', color: '#374151', cursor: submitLoading ? 'not-allowed' : 'pointer', fontWeight: '500' }}>
                  Save As Draft
                </button>
              )}
              <button type="submit" disabled={submitLoading}
                style={{ padding: '10px 40px', borderRadius: '6px', border: 'none', background: submitLoading ? '#6ee7b7' : '#10b981', color: 'white', cursor: submitLoading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '15px' }}>
                {submitLoading ? 'Saving...' : (isEdit ? 'Update Case' : 'Save Case')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return null;
}