import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from './config';
import './ManageCases.css';
import { findPurokCoords } from './data/coordinates';
import feverIcon from './assets/fever.svg';
import influenzaAIcon from './assets/influenza-a.svg';
import leptospirosisIcon from './assets/leptospirosis.svg';
import tuberculosisIcon from './assets/tuberculosis.svg';
import typhoidIcon from './assets/typhoid-fever.svg';

const diseaseImgStyle = { width: 28, height: 28, verticalAlign: 'middle' };

const BARANGAY_COORDS = {
  'Baclaran': [14.2450, 121.1630],
  'Banay-Banay': [14.2550, 121.1300],
  'Banlic': [14.2330, 121.1380],
  'Barangay Dos (Poblacion)': [14.2770, 121.1260],
  'Barangay Tres (Poblacion)': [14.2760, 121.1230],
  'Barangay Uno (Poblacion)': [14.2800, 121.1240],
  'Bigaa': [14.2860, 121.1300],
  'Butong': [14.2850, 121.1370],
  'Casile': [14.1830, 121.0350],
  'Diezmo': [14.2340, 121.1000],
  'Gulod': [14.2530, 121.1590],
  'Mamatid': [14.2360, 121.1600],
  'Marinig': [14.2660, 121.1480],
  'Niugan': [14.2690, 121.1340],
  'Pittland': [14.2160, 121.0600],
  'Pulo': [14.2480, 121.1390],
  'Sala': [14.2690, 121.1350],
  'San Isidro': [14.2490, 121.1430],
};

const CHO_UNIT_BARANGAYS = {
  'CHO Unit I (Sala)': [
    'Barangay Uno (Poblacion)',
    'Barangay Dos (Poblacion)',
    'Barangay Tres (Poblacion)',
    'Sala',
    'Bigaa',
    'Butong',
    'Marinig',
    'Gulod',
    'Niugan',
    'Baclaran',
  ],
  'CHO Unit II (Pulo)': [
    'Pulo',
    'Banay-Banay',
    'Banlic',
    'Mamatid',
    'San Isidro',
    'Diezmo',
    'Pittland',
    'Casile',
  ],
};

// ── All disease cards split into 2 pages of 6 ──
const DISEASE_PAGES = [
  [
    { id: 1, name: 'Dengue Fever', dbName: 'Dengue', icon: <img src={feverIcon} alt="" style={diseaseImgStyle} />, color: '#ef4444', desc: 'A viral infection transmitted by Aedes mosquitoes, causing high fever and severe body aches.' },
    { id: 2, name: 'Influenza A', dbName: 'Influenza A', icon: <img src={influenzaAIcon} alt="" style={diseaseImgStyle} />, color: '#f59e0b', desc: 'A highly contagious respiratory illness caused by influenza viruses, leading to seasonal outbreaks.' },
    { id: 3, name: 'Covid-19', dbName: 'Covid-19', icon: '🛡️', color: '#3b82f6', desc: 'An infectious respiratory disease caused by the SARS-CoV-2 virus, requiring close contact tracing.' },
    { id: 4, name: 'Leptospirosis', dbName: 'Leptospirosis', icon: <img src={leptospirosisIcon} alt="" style={diseaseImgStyle} />, color: '#10b981', desc: 'A bacterial disease spread through contaminated water, posing a high risk during flood seasons.' },
    { id: 5, name: 'Tuberculosis', dbName: 'Tuberculosis', icon: <img src={tuberculosisIcon} alt="" style={diseaseImgStyle} />, color: '#f97316', desc: 'An infectious bacterial disease that primarily affects the lungs, requiring long-term treatment.' },
    { id: 6, name: 'Typhoid Fever', dbName: 'Typhoid Fever', icon: <img src={typhoidIcon} alt="" style={diseaseImgStyle} />, color: '#8b5cf6', desc: 'A systemic infection caused by Salmonella Typhi, spread through contaminated food and water.' },
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

const OTHER_CARD = DISEASE_PAGES[1][5]; // the "Other" card object

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

const PUROK_OPTIONS = [
  'Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6',
  'Blk 1', 'Blk 2', 'Blk 3', 'Blk 4', 'Blk 5',
  'Phase 1', 'Phase 2', 'Phase 3',
  'Lot 1', 'Lot 2', 'Lot 3', 'Lot 4', 'Lot 5'
];

function extractLocationUnit(address) {
  if (!address) return null;
  const a = address.toUpperCase();
  const found = { blk: null, lot: null, phase: null, purok: null };

  const blkMatch = a.match(/\bBLOCK\s*(\d+)\b/)
    || a.match(/\bBLK\.?\s*(\d+)\b/)
    || a.match(/\bB\.?\s*(\d+)(?=\s|,|$|[A-Z])/);
  if (blkMatch) found.blk = blkMatch[1];

  const lotMatch = a.match(/\bLOT\.?\s*(\d+)\b/)
    || a.match(/\bL\.?\s*(\d+)(?=\s|,|$|[A-Z])/);
  if (lotMatch) found.lot = lotMatch[1];

  const phaseMatch = a.match(/\bPHASE\s*(\d+)\b/)
    || a.match(/\bPH\.?\s*(\d+)\b/);
  if (phaseMatch) found.phase = phaseMatch[1];

  const purokMatch = a.match(/\bPUROK\s*(\d+)\b/)
    || a.match(/\bPRK\.?\s*(\d+)\b/);
  if (purokMatch) found.purok = purokMatch[1];

  const hasExplicitWord = /\b(BLK|BLOCK|LOT|PHASE|PH\.|PUROK|PRK)\b/.test(a);
  if (!hasExplicitWord && !found.phase && !found.purok) {
    const bareCount = (found.blk ? 1 : 0) + (found.lot ? 1 : 0);
    if (bareCount < 2) return null;
  }

  const parts = [];
  if (found.phase) parts.push(`Phase ${found.phase}`);
  if (found.blk) parts.push(`Blk ${found.blk}`);
  if (found.lot) parts.push(`Lot ${found.lot}`);
  if (found.purok) parts.push(`Purok ${found.purok}`);

  return parts.length > 0 ? parts.join(' ') : null;
}

const CASES_PER_PAGE = 10;

const EMPTY_FORM = {
  patientName: '', diseaseType: '', age: '', severity: 'Mild',
  gender: 'Male', status: 'Active', contact: '', onsetDate: '',
  address: '', purok: '', barangayId: '', symptoms: '', physician: '',
  lat: '', lng: '', specificDisease: ''
};

// Helper: find which card a disease_name belongs to
const findCardForDisease = (diseaseName) => {
  if (!diseaseName) return null;
  const dn = diseaseName.toLowerCase();
  // Check all named cards first
  for (const page of DISEASE_PAGES) {
    for (const card of page) {
      if (card.dbName === 'Other') continue;
      if (dn === card.dbName.toLowerCase()) return card;
    }
  }
  // If not found in named cards → it belongs to "Other"
  if (!KNOWN_DB_NAMES.includes(dn)) return OTHER_CARD;
  return null;
};

const formatDateStr = (dateStr, fmt) => {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const shortY = String(y).slice(-2);
  if (fmt === 'DD/MM/YY') return `${day}/${m}/${shortY}`;
  if (fmt === 'YYYY-MM-DD') return `${y}-${m}-${day}`;
  return `${m}/${day}/${shortY}`;
};

export default function ManageCases({ caseFilter, setCaseFilter, dateFormat, autoSave, confirmDelete, keyboardShortcuts, fontScale, compactMode, loggedUserId, loginRole, loginBarangay, sessionContext }) {
  const [view, setView] = useState('categories'); // 'categories' | 'list' | 'add' | 'edit'
  const [cardPage, setCardPage] = useState(0);
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [editingCase, setEditingCase] = useState(null);

  const [allCases, setAllCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [barangayList, setBarangayList] = useState([]);
  const [allDiseases, setAllDiseases] = useState([]);
  const choUnitBarangays = sessionContext ? CHO_UNIT_BARANGAYS[sessionContext] || [] : [];
  const scopedBarangayOptions = (loginRole === 'CHO' && sessionContext && CHO_UNIT_BARANGAYS[sessionContext])
    ? CHO_UNIT_BARANGAYS[sessionContext]
    : CABUYAO_BARANGAYS;

  const baseCases = (loginRole === 'BHW' && loginBarangay)
    ? allCases.filter(c => c.barangay_name === loginBarangay)
    : (loginRole === 'CHO' && choUnitBarangays.length > 0)
      ? allCases.filter(c => choUnitBarangays.includes(c.barangay_name))
      : allCases;

  // Table filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarangay, setFilterBarangay] = useState('All Barangays');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [filterPurok, setFilterPurok] = useState('All Puroks');
  // ── NEW: sub-disease filter for the "Other" card ──
  const [filterSubDisease, setFilterSubDisease] = useState('All Remaining Diseases');
  const [tablePage, setTablePage] = useState(1);

  // Auto-save toast state
  const [autoSaveToast, setAutoSaveToast] = useState('');

  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());
  const fs = fontScale || '1';

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef(null);

  // Keyboard shortcuts guide
  const [showShortcutsGuide, setShowShortcutsGuide] = useState(false);
  const shortcutsRef = useRef(null);

  // Barangay filter dropdown
  const [barangayOpen, setBarangayOpen] = useState(false);
  const barangayRef = useRef(null);
  const subDiseaseRef = useRef(null);

  // Purok/Blk/Phase filter dropdown
  const [purokOpen, setPurokOpen] = useState(false);
  const purokRef = useRef(null);

  // Form dropdowns
  const [barangayFormOpen, setBarangayFormOpen] = useState(false);
  const [diseaseOpen, setDiseaseOpen] = useState(false);
  const barangayFormRef = useRef(null);
  const diseaseFormRef = useRef(null);

  // Sub-disease filter dropdown
  const [subDiseaseOpen, setSubDiseaseOpen] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Patient auto-fill lookup
  const [patientLookupResults, setPatientLookupResults] = useState([]);
  const [showLookupDropdown, setShowLookupDropdown] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupTimerRef = useRef(null);
  const lookupDropdownRef = useRef(null);
  const [formErrors, setFormErrors] = useState({});

  // Add/Edit form
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // ── Handle incoming caseFilter from MapView "Go To →" ──
  useEffect(() => {
    if (!caseFilter || (!caseFilter.disease && !caseFilter.barangay)) return;

    const targetDisease = caseFilter.disease || '';
    const targetBarangay = caseFilter.barangay || 'All Barangays';

    const card = findCardForDisease(targetDisease);

    if (card) {
      setSelectedDisease(card);
      setFilterBarangay(targetBarangay || 'All Barangays');
      setSearchQuery('');
      setFilterStatus('All Status');
      setTablePage(1);

      // If the disease lands in "Other", pre-set the sub-disease filter
      if (card.dbName === 'Other') {
        setFilterSubDisease(targetDisease || 'All Remaining Diseases');
      } else {
        setFilterSubDisease('All Remaining Diseases');
      }

      setView('list');
    }

    // Clear the filter so navigating back works normally
    if (setCaseFilter) setCaseFilter({ disease: '', barangay: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseFilter]);

  // Fetch all cases
  const fetchCases = () => {
    setLoadingCases(true);
    axios.get(API_URL + '/api/disease_cases')
      .then(res => { setAllCases(res.data); setLoadingCases(false); setLastUpdated(Date.now()); })
      .catch(() => setLoadingCases(false));
  };

  useEffect(() => {
    fetchCases();
    const interval = setInterval(() => {
      if (view !== 'add' && view !== 'edit') fetchCases();
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    axios.get(API_URL + '/api/barangays')
      .then(res => setBarangayList(res.data))
      .catch(() => {});
    axios.get(API_URL + '/api/diseases')
      .then(res => setAllDiseases(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
      if (barangayRef.current && !barangayRef.current.contains(e.target)) {
        setBarangayOpen(false);
      }
      if (shortcutsRef.current && !shortcutsRef.current.contains(e.target)) {
        setShowShortcutsGuide(false);
      }
      if (purokRef.current && !purokRef.current.contains(e.target)) {
        setPurokOpen(false);
      }
      if (barangayFormRef.current && !barangayFormRef.current.contains(e.target)) setBarangayFormOpen(false);
      if (diseaseFormRef.current && !diseaseFormRef.current.contains(e.target)) setDiseaseOpen(false);
      if (subDiseaseRef.current && !subDiseaseRef.current.contains(e.target)) {
        setSubDiseaseOpen(false);
      }
      if (lookupDropdownRef.current && !lookupDropdownRef.current.contains(e.target)) {
        setShowLookupDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Auto-save draft every 4 minutes ──
  useEffect(() => {
    if (!autoSave || (view !== 'add' && view !== 'edit')) return;
    if (!formData.patientName) return;

    const interval = setInterval(() => {
      const payload = { ...formData, status: 'Draft' };
      const request = editingCase
        ? axios.put(`${API_URL}/api/disease_cases/${editingCase.id}`, payload)
        : axios.post(API_URL + '/api/disease_cases', payload);

      request
        .then(() => {
          setAutoSaveToast('Draft auto-saved at ' + new Date().toLocaleTimeString());
          fetchCases();
        })
        .catch(() => {});
    }, 240000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, view, formData.patientName, editingCase]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!keyboardShortcuts) return;

    const handler = (e) => {
      const tag = document.activeElement?.tagName || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        if (deleteTarget) { setDeleteTarget(null); return; }
        if (view === 'add' || view === 'edit') { setView('list'); }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        const form = document.querySelector('#case-form');
        if (form) form.requestSubmit();
      }

      if (view === 'list' && (e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
        setView('add');
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardShortcuts, view, deleteTarget]);

  const applyPatientAutoFill = (patient) => {
    const brgy = barangayList.find(b => b.name === patient.barangay_name);
    setFormData(prev => ({
      ...prev,
      patientName: patient.patient_name || '',
      age: patient.age || '',
      gender: patient.gender || 'Male',
      contact: patient.contact || '',
      address: patient.address || '',
      barangayId: brgy ? brgy.id : (patient.barangay_id || ''),
      symptoms: patient.symptoms || '',
      physician: patient.physician || '',
      lat: patient.latitude || '',
      lng: patient.longitude || '',
    }));
    setShowLookupDropdown(false);
  };

  // ── Patient auto-fill: debounced lookup ──
  useEffect(() => {
    if (lookupTimerRef.current) {
      clearTimeout(lookupTimerRef.current);
    }

    const name = (formData.patientName || '').trim();
    if (name.length < 2) {
      return;
    }

    lookupTimerRef.current = setTimeout(() => {
      setLookupLoading(true);
      axios.get(`${API_URL}/api/patients/lookup`, { params: { name } })
        .then(res => {
          const results = res.data || [];
          setPatientLookupResults(results);
          if (results.length === 1) {
            applyPatientAutoFill(results[0]);
            setShowLookupDropdown(false);
          } else if (results.length > 1) {
            setShowLookupDropdown(true);
          } else {
            setShowLookupDropdown(false);
          }
          setLookupLoading(false);
        })
        .catch(() => {
          setPatientLookupResults([]);
          setShowLookupDropdown(false);
          setLookupLoading(false);
        });
    }, 300);

    return () => {
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.patientName]);

  // ── Match cases to disease card ──
  const matchesCard = (caseItem, card) => {
    if (!caseItem.disease_name) return false;
    const dn = caseItem.disease_name.toLowerCase();
    if (card.dbName === 'Other') {
      return !KNOWN_DB_NAMES.includes(dn);
    }
    return dn === card.dbName.toLowerCase();
  };

  const getCaseCount = (card) => baseCases.filter(c => matchesCard(c, card)).length;

  // ── Get unique "Other" disease names from allCases for the sub-filter dropdown ──
  const getOtherDiseaseNames = () => {
    const names = new Set();
    allDiseases.forEach(d => {
      if (!KNOWN_DB_NAMES.includes(d.name.toLowerCase())) {
        names.add(d.name);
      }
    });
    allCases.forEach(c => {
      if (!c.disease_name) return;
      if (!KNOWN_DB_NAMES.includes(c.disease_name.toLowerCase())) {
        names.add(c.disease_name);
      }
    });
    return Array.from(names).sort();
  };

  // ── Filter cases for list ──
  const getFilteredCases = () => {
    let result = selectedDisease
      ? baseCases.filter(c => matchesCard(c, selectedDisease))
      : baseCases;

    // ── Sub-disease filter (only active for "Other" card) ──
    if (
      selectedDisease?.dbName === 'Other' &&
      filterSubDisease !== 'All Remaining Diseases'
    ) {
      result = result.filter(
        c => (c.disease_name || '').toLowerCase() === filterSubDisease.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        (c.patient_name || '').toLowerCase().includes(q) ||
        String(c.case_id).includes(q) ||
        (c.address || '').toLowerCase().includes(q)
      );
    }
    if (filterBarangay !== 'All Barangays') {
      result = result.filter(c => c.barangay_name === filterBarangay);
    }
    if (filterStatus !== 'All Status') {
      result = result.filter(c => c.status === filterStatus);
    }
    if (filterPurok !== 'All Puroks') {
      const q = filterPurok.toLowerCase();
      result = result.filter(c => (c.address || '').toLowerCase().includes(q));
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
  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API_URL}/api/cases/${deleteTarget.case_id}`);
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
    const brgy = barangayList.find(b => b.name === caseItem.barangay_name);
    let parsedAddress = caseItem.address || '';
    let parsedPurok = '';
    if (parsedAddress.includes('|')) {
      const [addrPart, purokPart] = parsedAddress.split('|');
      parsedAddress = addrPart.trim();
      parsedPurok = (purokPart || '').trim();
    }
    const filledForm = {
      patientName: caseItem.patient_name || '',
      diseaseType: caseItem.disease_name || '',
      age: caseItem.age || '',
      severity: caseItem.severity || 'Mild',
      gender: caseItem.gender || 'Male',
      status: caseItem.status || 'Active',
      contact: caseItem.contact || '',
      onsetDate: caseItem.onset_date ? caseItem.onset_date.split('T')[0] : '',
      address: parsedAddress,
      purok: parsedPurok,
      barangayId: brgy ? brgy.id : '',
      symptoms: caseItem.symptoms || '',
      physician: caseItem.physician || '',
      lat: caseItem.latitude || '',
      lng: caseItem.longitude || '',
      specificDisease: '',
    };
    setFormData(filledForm);
    setEditingCase(caseItem);

    const errors = {};
    if (!filledForm.patientName.trim()) errors.patientName = true;
    if (!filledForm.diseaseType) errors.diseaseType = true;
    if (!filledForm.age) errors.age = true;
    if (!filledForm.contact.trim()) errors.contact = true;
    if (!filledForm.address.trim()) errors.address = true;
    if (!filledForm.onsetDate) errors.onsetDate = true;
    if (!filledForm.barangayId) errors.barangayId = true;
    if (!filledForm.physician.trim()) errors.physician = true;
    if (!filledForm.symptoms.trim()) errors.symptoms = true;
    if (!filledForm.lat || !filledForm.lng) errors.location = true;
    setFormErrors(errors);

    setView('edit');
  };

  const geocodeAddress = async (address) => {
    if (!address || address.trim().length < 5) return;
    try {
      const query = encodeURIComponent(`${address}, Cabuyao, Laguna, Philippines`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'CabuyaoCDMS/1.0' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setFormData(prev => ({
          ...prev,
          lat: parseFloat(data[0].lat).toFixed(6),
          lng: parseFloat(data[0].lon).toFixed(6),
        }));
        setFormErrors(prev => ({ ...prev, location: false }));
      }
    } catch (err) {
      console.warn('Geocoding failed:', err);
    }
  };

  // ── OPEN ADD ──
  const openAdd = () => {
    setFormData({
      ...EMPTY_FORM,
      diseaseType: selectedDisease?.dbName === 'Other' ? '' : (selectedDisease?.dbName || ''),
    });
    setEditingCase(null);
    setFormErrors({});
    setView('add');
  };

  // ── SAVE CASE (Add or Edit) ──
  const handleSave = async (e, isDraft = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (submitLoading) return;
    setSubmitLoading(true);
    setSubmitMsg('');

    if (!formData.barangayId) {
      setFormErrors({ barangayId: true });
      setSubmitMsg('Please select an assigned barangay.');
      setSubmitLoading(false);
      return;
    }

    if (!isDraft) {
      const errors = {};
      if (!formData.patientName.trim()) errors.patientName = true;
      if (!formData.diseaseType) errors.diseaseType = true;
      if (!formData.age) errors.age = true;
      if (!formData.contact.trim()) errors.contact = true;
      if (!formData.address.trim()) errors.address = true;
      if (!formData.onsetDate) errors.onsetDate = true;
      if (!formData.physician.trim()) errors.physician = true;
      if (!formData.symptoms.trim()) errors.symptoms = true;
      if (!formData.lat || !formData.lng) errors.location = true;
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setSubmitMsg('Please fill in all required fields highlighted in red.');
        setSubmitLoading(false);
        return;
      }
    }
    setFormErrors({});

    let diseaseNameToSave = formData.diseaseType === 'Other Communicable Diseases'
      ? (formData.specificDisease || 'Other')
      : formData.diseaseType;
    if (isDraft && !diseaseNameToSave) {
      diseaseNameToSave = '';
    }

    const combinedAddress = formData.purok
      ? `${formData.address}${formData.address ? ' | ' : ''}${formData.purok}`
      : formData.address;

    const payload = {
      patient_name: formData.patientName,
      disease_name: diseaseNameToSave,
      age: formData.age || null,
      severity: formData.severity,
      gender: formData.gender,
      status: isDraft ? 'Draft' : formData.status,
      contact: formData.contact,
      onset_date: formData.onsetDate || null,
      address: combinedAddress,
      barangay_id: formData.barangayId || null,
      symptoms: formData.symptoms,
      physician: formData.physician,
      latitude: formData.lat || null,
      longitude: formData.lng || null,
      user_id: loggedUserId || null,
    };

    try {
      if (editingCase) {
        await axios.put(`${API_URL}/api/cases/${editingCase.case_id}`, payload);
        setSubmitMsg('Case updated successfully!');
      } else {
        await axios.post(API_URL + '/api/cases', payload);
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
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#1f2937',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  // ═══════════════════════════════════
  // VIEW: DISEASE CARDS
  // ═══════════════════════════════════
  if (view === 'categories') {
    const pageCards = DISEASE_PAGES[cardPage];
    return (
      <div style={{ padding: compactMode ? '14px' : '28px', color: 'var(--text-main)', fontSize: `calc(14px * ${fs})` }}>
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
            {keyboardShortcuts && (
              <div style={{ position: 'relative' }} ref={shortcutsRef}>
                <button onClick={() => setShowShortcutsGuide(!showShortcutsGuide)}
                  style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ?
                </button>
                {showShortcutsGuide && (
                  <div style={{ position: 'absolute', top: '110%', right: 0, width: '240px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: '14px', fontSize: '13px' }}>
                    <div style={{ fontWeight: '700', marginBottom: '10px', color: 'var(--text-main)' }}>Keyboard Shortcuts</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>New Case</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>N</kbd></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>Save Form</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>Ctrl+S</kbd></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>Close / Back</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>Esc</kbd></div>
                    </div>
                  </div>
                )}
              </div>
            )}
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

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div onClick={() => { setSelectedDisease(null); setFilterStatus('Pending'); setTablePage(1); setView('list'); }}
            style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>📥 Inbox</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Pending Approval</div>
            </div>
            <div style={{ background: '#f59e0b', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700' }}>
              {baseCases.filter(c => c.status === 'Pending').length}
            </div>
          </div>
          <div onClick={() => { setSelectedDisease(null); setFilterStatus('Draft'); setTablePage(1); setView('list'); }}
            style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>📤 Outbox</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Cases You Submitted</div>
            </div>
            <div style={{ background: '#3b82f6', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700' }}>
              {baseCases.filter(c => c.status === 'Draft').length}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compactMode ? '12px' : '20px', marginTop: '16px' }}>
          {pageCards.map(disease => {
            const count = getCaseCount(disease);
            return (
              <div key={disease.id}
                onClick={() => {
                  setSelectedDisease(disease);
                  setTablePage(1);
                  setSearchQuery('');
                  setFilterBarangay('All Barangays');
                  setFilterStatus('All Status');
                  setFilterSubDisease('All Remaining Diseases');
                  setView('list');
                }}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: compactMode ? '14px' : '24px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
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
    const isOtherCard = selectedDisease?.dbName === 'Other';
    const otherDiseaseNames = isOtherCard ? getOtherDiseaseNames() : [];

    return (
      <div style={{ padding: compactMode ? '14px' : '28px', color: 'var(--text-main)', fontSize: `calc(14px * ${fs})` }}>
        {/* DELETE MODAL */}
        {deleteTarget && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '40px 32px', width: '420px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '700', color: '#111827' }}>Are you sure?</h3>
              <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
                This action cannot be undone.<br />This will permanently delete the case record of:
              </p>
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
                <button onClick={executeDelete} disabled={deleteLoading}
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
            {keyboardShortcuts && (
              <div style={{ position: 'relative' }} ref={shortcutsRef}>
                <button onClick={() => setShowShortcutsGuide(!showShortcutsGuide)}
                  style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ?
                </button>
                {showShortcutsGuide && (
                  <div style={{ position: 'absolute', top: '110%', right: 0, width: '240px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: '14px', fontSize: '13px' }}>
                    <div style={{ fontWeight: '700', marginBottom: '10px', color: 'var(--text-main)' }}>Keyboard Shortcuts</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>New Case</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>N</kbd></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>Save Form</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>Ctrl+S</kbd></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>Close / Back</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>Esc</kbd></div>
                    </div>
                  </div>
                )}
              </div>
            )}
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

            <button onClick={() => { setView('categories'); setSearchQuery(''); setFilterSubDisease('All Remaining Diseases'); }}
              style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>
              ← Back
            </button>
            <button onClick={openAdd}
              style={{ padding: '8px 18px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              + Add Case
            </button>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', marginBottom: '6px' }}>
          {lastUpdated ? `Updated ${Math.round((now - lastUpdated) / 1000)}s ago` : 'Refreshing...'}
        </div>

        {/* Table card */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <input type="text" placeholder="Search Cases..."
              value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setTablePage(1); }}
              style={{ padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px', width: '180px' }} />

            {/* Barangay filter — hidden for BHW */}
            {loginRole !== 'BHW' && (
              <div style={{ position: 'relative' }} ref={barangayRef}>
                <button className="mc-custom-dropdown-btn" onClick={() => setBarangayOpen(!barangayOpen)}>
                  <span>{filterBarangay}</span>
                  <span style={{ marginLeft: '6px', opacity: 0.6 }}>▾</span>
                </button>
                {barangayOpen && (
                  <div className="mc-custom-dropdown-panel">
                    <div
                      className={`mc-custom-dropdown-item ${filterBarangay === 'All Barangays' ? 'mc-custom-dropdown-item--active' : ''}`}
                      onClick={() => { setFilterBarangay('All Barangays'); setTablePage(1); setBarangayOpen(false); }}
                    >
                      All Barangays
                    </div>
                    {scopedBarangayOptions.map(b => (
                      <div
                        key={b}
                        className={`mc-custom-dropdown-item ${filterBarangay === b ? 'mc-custom-dropdown-item--active' : ''}`}
                        onClick={() => { setFilterBarangay(b); setTablePage(1); setBarangayOpen(false); }}
                      >
                        {b}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Purok/Blk/Phase filter — only for BHW */}
            {loginRole === 'BHW' && (
              <div style={{ position: 'relative' }} ref={purokRef}>
                <button className="mc-custom-dropdown-btn" onClick={() => setPurokOpen(!purokOpen)}>
                  <span>{filterPurok}</span>
                  <span style={{ marginLeft: '6px', opacity: 0.6 }}>▾</span>
                </button>
                {purokOpen && (
                  <div className="mc-custom-dropdown-panel">
                    {['All Puroks', 'Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6', 'Blk 1', 'Blk 2', 'Blk 3', 'Blk 4', 'Blk 5', 'Phase 1', 'Phase 2', 'Phase 3', 'Lot 1', 'Lot 2', 'Lot 3', 'Lot 4', 'Lot 5'].map(p => (
                      <div
                        key={p}
                        className={`mc-custom-dropdown-item ${filterPurok === p ? 'mc-custom-dropdown-item--active' : ''}`}
                        onClick={() => { setFilterPurok(p); setTablePage(1); setPurokOpen(false); }}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Status filter */}
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

            {/* ── NEW: Remaining Diseases sub-filter (only for "Other" card) ── */}
            {isOtherCard && (
              <div style={{ position: 'relative' }} ref={subDiseaseRef}>
                <button
                  onClick={() => setSubDiseaseOpen(!subDiseaseOpen)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: filterSubDisease === 'All Remaining Diseases' ? 'var(--text-muted)' : 'var(--text-main)',
                    fontSize: '13px',
                    minWidth: '180px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <span>{filterSubDisease === 'All Remaining Diseases' ? 'Remaining Diseases' : filterSubDisease}</span>
                  <span style={{ opacity: 0.6 }}>▾</span>
                </button>
                {subDiseaseOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 100,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    marginTop: '4px',
                    minWidth: '100%',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}>
                    <div
                      className={`mc-custom-dropdown-item ${filterSubDisease === 'All Remaining Diseases' ? 'mc-custom-dropdown-item--active' : ''}`}
                      onClick={() => { setFilterSubDisease('All Remaining Diseases'); setTablePage(1); setSubDiseaseOpen(false); }}
                    >
                      Remaining Diseases
                    </div>
                    {otherDiseaseNames.map(name => (
                      <div
                        key={name}
                        className={`mc-custom-dropdown-item ${filterSubDisease === name ? 'mc-custom-dropdown-item--active' : ''}`}
                        onClick={() => { setFilterSubDisease(name); setTablePage(1); setSubDiseaseOpen(false); }}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                    <th key={h} style={{ textAlign: 'center', padding: compactMode ? '6px 8px' : '10px 12px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
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
                      {(searchQuery || filterBarangay !== 'All Barangays' || filterStatus !== 'All Status' || (isOtherCard && filterSubDisease !== 'All Remaining Diseases'))
                        ? ' with current filters.' : '.'}
                    </td>
                  </tr>
                ) : (
                  paginatedCases.map(c => (
                    <tr key={c.case_id} style={{ borderBottom: '1px solid var(--border-color)', opacity: c.status === 'Draft' ? 0.6 : 1 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        #{String(c.case_id).padStart(3, '0')}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '14px', fontWeight: '500', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.patient_name || 'Unknown'}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '13px', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.age || '--'}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '13px', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.barangay_name || '--'}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '13px', color: 'var(--text-main)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {formatDateStr(c.date_reported, dateFormat)}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '13px', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.severity || 'N/A'}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', textAlign: 'center' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500', ...getStatusStyle(c.status) }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => openEdit(c)} title="Edit case"
                            style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px' }}>
                            ✏️
                          </button>
                          <button onClick={() => {
                              if (confirmDelete) {
                                setDeleteTarget(c);
                              } else {
                                axios.delete(`${API_URL}/api/cases/${c.case_id}`)
                                  .then(() => fetchCases())
                                  .catch(err => alert('Delete failed: ' + (err.response?.data?.error || err.message)));
                              }
                            }} title="Delete case"
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
      <div style={{ padding: compactMode ? '14px' : '28px', fontSize: `calc(14px * ${fs})` }}>
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

          {autoSaveToast && (
            <div style={{ background: '#fef3c7', color: '#92400e', padding: '8px 16px', borderRadius: '8px', marginBottom: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '500' }}>
              💾 {autoSaveToast}
            </div>
          )}

          <form onSubmit={(e) => handleSave(e, false)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '24px' }}>

              {/* LEFT: Patient Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, color: '#334155', fontSize: '14px', fontWeight: '700', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                  Patient Information
                </h4>
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>
                    Patient Full Name *
                    <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '11px', marginLeft: '6px' }}>
                      (type surname to auto-fill past records)
                    </span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" required placeholder="e.g. Juan Dela Cruz" style={{ ...inputStyle, border: formErrors.patientName ? '2px solid #ef4444' : '1px solid #d1d5db', background: formErrors.patientName ? '#fff5f5' : '#f9fafb' }}
                      value={formData.patientName} onChange={e => { setFormData({ ...formData, patientName: e.target.value }); setFormErrors(prev => ({ ...prev, patientName: false })); }}
                      onFocus={() => { if (patientLookupResults.length > 0) setShowLookupDropdown(true); }} />
                    {lookupLoading && (
                      <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '12px' }}>⌛</span>
                    )}
                  </div>
                  {showLookupDropdown && patientLookupResults.length > 0 && (
                    <div ref={lookupDropdownRef} style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
                      maxHeight: '220px', overflowY: 'auto', marginTop: '2px',
                      background: '#ffffff', border: '1px solid #d1d5db',
                      borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      padding: '4px',
                    }}>
                      <div style={{ padding: '6px 12px', fontSize: '11px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', marginBottom: '2px' }}>
                        Multiple matching records — click to select
                      </div>
                      {patientLookupResults.map((p, i) => (
                        <div key={i}
                          onClick={() => applyPatientAutoFill(p)}
                          style={{
                            padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                            borderRadius: '6px', color: '#1f2937',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span><strong>{p.patient_name}</strong> <span style={{ color: '#64748b' }}>— {p.barangay_name || 'N/A'}</span></span>
                          <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                            {p.age || '?'}y
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Age</label>
                    <input type="number" min="0" max="120" placeholder="25" style={{ ...inputStyle, border: formErrors.age ? '2px solid #ef4444' : '1px solid #d1d5db', background: formErrors.age ? '#fff5f5' : '#f9fafb' }}
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
                  <input type="text" placeholder="0918-234-2331" style={{ ...inputStyle, border: formErrors.contact ? '2px solid #ef4444' : '1px solid #d1d5db', background: formErrors.contact ? '#fff5f5' : '#f9fafb' }}
                    value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Address</label>
                  <input type="text" placeholder="123 Rizal St, San Isidro Cabuyao" style={inputStyle}
                    value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                    onBlur={async (e) => {
                      const addr = e.target.value.trim();
                      if (!addr) return;

                      const addrLower = addr.toLowerCase().replace(/[\-\s]/g, '');
                      const matchedBarangay = barangayList.find(b => {
                        const bNorm = b.name.replace(/\(.*?\)/g, '').toLowerCase().replace(/[\-\s().]/g, '').trim();
                        return addrLower.includes(bNorm);
                      });

                      if (matchedBarangay) {
                        setFormData(prev => ({ ...prev, barangayId: String(matchedBarangay.id) }));
                      }

                      // ── detect Purok/Blk/Phase/Lot from the typed address ──
                      const unit = extractLocationUnit(addr);
                      if (unit) {
                        setFormData(prev => ({ ...prev, purok: unit }));
                      }

                      const barangayName = matchedBarangay?.name || barangayList.find(b => String(b.id) === String(formData.barangayId))?.name || '';
                      const fullQuery = [addr, barangayName, 'Cabuyao', 'Laguna', 'Philippines'].filter(Boolean).join(', ');

                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullQuery)}&format=json&limit=1`);
                        const data = await res.json();
                        if (data && data.length > 0) {
                          setFormData(prev => ({
                            ...prev,
                            barangayId: matchedBarangay ? String(matchedBarangay.id) : prev.barangayId,
                            lat: parseFloat(data[0].lat).toFixed(6),
                            lng: parseFloat(data[0].lon).toFixed(6),
                          }));
                        } else {
                          const targetB = matchedBarangay || (formData.barangayId
                            ? barangayList.find(b => String(b.id) === String(formData.barangayId))
                            : null);
                          if (targetB) {
                            const purokCoords = unit
                              ? findPurokCoords(targetB.name, unit, BARANGAY_COORDS)
                              : null;
                            const fallbackCoords = purokCoords || BARANGAY_COORDS[targetB.name];
                            if (fallbackCoords) {
                              setFormData(prev => ({
                                ...prev,
                                barangayId: String(targetB.id),
                                lat: String(fallbackCoords[0]),
                                lng: String(fallbackCoords[1]),
                              }));
                            }
                          }
                        }
                      } catch (_) {
                        const targetB = matchedBarangay || (formData.barangayId
                          ? barangayList.find(b => String(b.id) === String(formData.barangayId))
                          : null);
                        if (targetB) {
                          const purokCoords = unit
                            ? findPurokCoords(targetB.name, unit, BARANGAY_COORDS)
                            : null;
                          const fallbackCoords = purokCoords || BARANGAY_COORDS[targetB.name];
                          if (fallbackCoords) {
                            setFormData(prev => ({
                              ...prev,
                              barangayId: String(targetB.id),
                              lat: String(fallbackCoords[0]),
                              lng: String(fallbackCoords[1]),
                            }));
                          }
                        }
                      }
                    }}
                      onKeyDown={async (e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const addr = e.target.value.trim();
                      if (!addr) return;

                      const addrLower = addr.toLowerCase().replace(/[\-\s]/g, '');
                      const matchedBarangay = barangayList.find(b => {
                        const bNorm = b.name.replace(/\(.*?\)/g, '').toLowerCase().replace(/[\-\s().]/g, '').trim();
                        return addrLower.includes(bNorm);
                      });

                      if (matchedBarangay) {
                        setFormData(prev => ({ ...prev, barangayId: String(matchedBarangay.id) }));
                      }

                      // ── detect Purok/Blk/Phase/Lot from the typed address ──
                      const unit = extractLocationUnit(addr);
                      if (unit) {
                        setFormData(prev => ({ ...prev, purok: unit }));
                      }

                      const barangayName = matchedBarangay?.name || barangayList.find(b => String(b.id) === String(formData.barangayId))?.name || '';
                      const fullQuery = [addr, barangayName, 'Cabuyao', 'Laguna', 'Philippines'].filter(Boolean).join(', ');

                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullQuery)}&format=json&limit=1`);
                        const data = await res.json();
                        if (data && data.length > 0) {
                          setFormData(prev => ({
                            ...prev,
                            barangayId: matchedBarangay ? String(matchedBarangay.id) : prev.barangayId,
                            lat: parseFloat(data[0].lat).toFixed(6),
                            lng: parseFloat(data[0].lon).toFixed(6),
                          }));
                        } else {
                          const targetB = matchedBarangay || (formData.barangayId
                            ? barangayList.find(b => String(b.id) === String(formData.barangayId))
                            : null);
                          if (targetB) {
                            const purokCoords = unit
                              ? findPurokCoords(targetB.name, unit, BARANGAY_COORDS)
                              : null;
                            const fallbackCoords = purokCoords || BARANGAY_COORDS[targetB.name];
                            if (fallbackCoords) {
                              setFormData(prev => ({
                                ...prev,
                                barangayId: String(targetB.id),
                                lat: String(fallbackCoords[0]),
                                lng: String(fallbackCoords[1]),
                              }));
                            }
                          }
                        }
                      } catch (_) {
                        const targetB = matchedBarangay || (formData.barangayId
                          ? barangayList.find(b => String(b.id) === String(formData.barangayId))
                          : null);
                        if (targetB) {
                          const purokCoords = unit
                            ? findPurokCoords(targetB.name, unit, BARANGAY_COORDS)
                            : null;
                          const fallbackCoords = purokCoords || BARANGAY_COORDS[targetB.name];
                          if (fallbackCoords) {
                            setFormData(prev => ({
                              ...prev,
                              barangayId: String(targetB.id),
                              lat: String(fallbackCoords[0]),
                              lng: String(fallbackCoords[1]),
                            }));
                          }
                        }
                      }
                    }} />
                </div>
                {loginRole === 'BHW' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Assigned Purok / Blk / Phase / Lot</label>
                    <div style={{ position: 'relative' }} ref={purokRef}>
                      <button
                        type="button"
                        onClick={() => setPurokOpen(!purokOpen)}
                        style={{
                          ...inputStyle,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', textAlign: 'left',
                          border: `1px solid ${purokOpen ? '#3b82f6' : '#d1d5db'}`,
                        }}
                      >
                          <span>{formData.purok || '— Select Location —'}</span>
                        <span style={{
                          fontSize: '10px', opacity: 0.6, marginLeft: '8px',
                          transition: 'transform 0.2s', display: 'inline-block',
                          transform: purokOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}>▾</span>
                      </button>
                      {purokOpen && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                          maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                          background: '#ffffff', border: '1px solid #d1d5db',
                          borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          padding: '4px',
                        }}>
                          <div
                            onClick={() => { setFormData({ ...formData, purok: '' }); setPurokOpen(false); }}
                            style={{
                              padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                              borderRadius: '6px', color: '#64748b',
                              background: !formData.purok ? '#eff6ff' : 'transparent',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => { e.currentTarget.style.background = !formData.purok ? '#eff6ff' : 'transparent'; }}
                          >
                            — Select Location —
                          </div>
                          {PUROK_OPTIONS.map(p => (
                            <div
                              key={p}
                              onClick={() => { setFormData({ ...formData, purok: p }); setPurokOpen(false); }}
                              style={{
                                padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                                borderRadius: '6px',
                                background: formData.purok === p ? '#eff6ff' : 'transparent',
                                color: formData.purok === p ? '#2563eb' : '#1f2937',
                                fontWeight: formData.purok === p ? '600' : '400',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => { e.currentTarget.style.background = formData.purok === p ? '#eff6ff' : 'transparent'; }}
                            >
                              {p}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Assigned Barangay</label>
                    <div style={{ position: 'relative' }} ref={barangayFormRef}>
                      <button
                        type="button"
                        onClick={() => setBarangayFormOpen(!barangayFormOpen)}
                        style={{
                          ...inputStyle,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', textAlign: 'left',
                          border: formErrors.barangayId ? '2px solid #ef4444' : `1px solid ${barangayFormOpen ? '#3b82f6' : '#d1d5db'}`,
                          background: formErrors.barangayId ? '#fff5f5' : '#f9fafb',
                        }}
                      >
                        <span>{barangayList.find(b => String(b.id) === String(formData.barangayId))?.name || '— Select Barangay —'}</span>
                        <span style={{
                          fontSize: '10px', opacity: 0.6, marginLeft: '8px',
                          transition: 'transform 0.2s', display: 'inline-block',
                          transform: barangayFormOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}>▾</span>
                      </button>
                      {barangayFormOpen && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                          maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                          background: '#ffffff', border: '1px solid #d1d5db',
                          borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          padding: '4px',
                        }}>
                          <div
                            onClick={() => { setFormData({ ...formData, barangayId: '' }); setBarangayFormOpen(false); setFormErrors(prev => ({ ...prev, barangayId: false })); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderRadius: '6px', color: '#64748b' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            — Select Barangay —
                          </div>
                          {barangayList.map(b => (
                            <div
                              key={b.id}
                              onClick={() => {
                                const coords = BARANGAY_COORDS[b.name];
                                setFormData(prev => ({
                                  ...prev,
                                  barangayId: b.id,
                                  lat: coords ? String(coords[0]) : prev.lat,
                                  lng: coords ? String(coords[1]) : prev.lng,
                                })); setBarangayFormOpen(false); setFormErrors(prev => ({ ...prev, barangayId: false }));
                              }}
                              style={{
                                padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderRadius: '6px',
                                background: String(formData.barangayId) === String(b.id) ? '#eff6ff' : 'transparent',
                                color: String(formData.barangayId) === String(b.id) ? '#2563eb' : '#1f2937',
                                fontWeight: String(formData.barangayId) === String(b.id) ? '600' : '400',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => { e.currentTarget.style.background = String(formData.barangayId) === String(b.id) ? '#eff6ff' : 'transparent'; }}
                            >
                              {b.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Clinical Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, color: '#334155', fontSize: '14px', fontWeight: '700', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                  Clinical Information
                </h4>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Disease Type</label>
                  <div style={{ position: 'relative', outline: formErrors.diseaseType ? '2px solid #ef4444' : 'none', borderRadius: '6px' }} ref={diseaseFormRef}>
                    <button
                      type="button"
                      onClick={() => setDiseaseOpen(!diseaseOpen)}
                      style={{
                        ...inputStyle,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer', textAlign: 'left',
                        border: `1px solid ${diseaseOpen ? '#3b82f6' : '#d1d5db'}`,
                      }}
                    >
                      <span>{formData.diseaseType || '— Select Disease —'}</span>
                      <span style={{
                        fontSize: '10px', opacity: 0.6, marginLeft: '8px',
                        transition: 'transform 0.2s', display: 'inline-block',
                        transform: diseaseOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}>▾</span>
                    </button>
                    {diseaseOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                        maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                        background: '#ffffff', border: '1px solid #d1d5db',
                        borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        padding: '4px',
                      }}>
                        <div
                          onClick={() => { setFormData({ ...formData, diseaseType: '' }); setDiseaseOpen(false); setFormErrors(prev => ({ ...prev, diseaseType: false })); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderRadius: '6px', color: '#64748b' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          — Select Disease —
                        </div>
                        {ALL_DISEASE_OPTIONS.concat(['Other Communicable Diseases']).map(d => (
                          <div
                            key={d}
                            onClick={() => { setFormData({ ...formData, diseaseType: d }); setDiseaseOpen(false); setFormErrors(prev => ({ ...prev, diseaseType: false })); }}
                            style={{
                              padding: '8px 12px', cursor: 'pointer', fontSize: '13px', borderRadius: '6px',
                              background: formData.diseaseType === d ? '#eff6ff' : 'transparent',
                              color: formData.diseaseType === d ? '#2563eb' : '#1f2937',
                              fontWeight: formData.diseaseType === d ? '600' : '400',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => { e.currentTarget.style.background = formData.diseaseType === d ? '#eff6ff' : 'transparent'; }}
                          >
                            {d}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                    <option>Mild</option><option>Moderate</option><option>Severe</option><option>Asymptomatic</option>
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
                  <div style={{ position: 'relative', cursor: 'pointer' }}
                    onClick={() => {
                      const el = document.getElementById('onset-date-input');
                      if (el) {
                        if (typeof el.showPicker === 'function') {
                          el.showPicker();
                        } else {
                          el.focus();
                        }
                      }
                    }}>
                    <input id="onset-date-input" type="date" style={{ ...inputStyle, paddingRight: '36px', cursor: 'pointer', border: formErrors.onsetDate ? '2px solid #ef4444' : '1px solid #d1d5db', background: formErrors.onsetDate ? '#fff5f5' : '#f9fafb' }} value={formData.onsetDate}
                      onChange={e => { setFormData({ ...formData, onsetDate: e.target.value }); setFormErrors(prev => ({ ...prev, onsetDate: false })); }} />
                    <span style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      pointerEvents: 'none', color: '#64748b', display: 'flex', alignItems: 'center',
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </span>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Attending Physician</label>
                  <input type="text" placeholder="Dr. Jose Reyes, MD" style={{ ...inputStyle, border: formErrors.physician ? '2px solid #ef4444' : '1px solid #d1d5db', background: formErrors.physician ? '#fff5f5' : '#f9fafb' }}
                    value={formData.physician} onChange={e => setFormData({ ...formData, physician: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Symptoms full width */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Symptoms & Observations</label>
              <textarea placeholder="e.g. Fever (39.5°C), Severe Headache, Muscle and Joint Pain..." rows="3"
                style={{ ...inputStyle, resize: 'vertical', border: formErrors.symptoms ? '2px solid #ef4444' : '1px solid #d1d5db', background: formErrors.symptoms ? '#fff5f5' : '#f9fafb' }}
                value={formData.symptoms} onChange={e => setFormData({ ...formData, symptoms: e.target.value })} />
            </div>

            {/* Location & Coordinates + map preview */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '10px', fontWeight: '600' }}>
                Location & Coordinates
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: hasCoords ? '1fr 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>
                <div>
                  {hasCoords && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                      {parseFloat(latVal).toFixed(4)}° N, {parseFloat(lngVal).toFixed(4)}° E
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Latitude (N)</label>
                      <input type="text" placeholder="e.g. 14.2253" style={{ ...inputStyle, border: formErrors.location ? '2px solid #ef4444' : '1px solid #d1d5db', background: formErrors.location ? '#fff5f5' : '#f9fafb' }}
                        value={formData.lat} onChange={e => setFormData({ ...formData, lat: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Longitude (E)</label>
                      <input type="text" placeholder="e.g. 121.3025" style={{ ...inputStyle, border: formErrors.location ? '2px solid #ef4444' : '1px solid #d1d5db', background: formErrors.location ? '#fff5f5' : '#f9fafb' }}
                        value={formData.lng} onChange={e => setFormData({ ...formData, lng: e.target.value })} />
                    </div>
                  </div>
                  {!hasCoords && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
                      Enter coordinates above to see a map preview.
                    </p>
                  )}
                </div>

                {hasCoords && (
                  <div style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <iframe title="location-preview" src={mapSrc} width="100%" height="100%"
                      style={{ border: 'none', display: 'block' }} loading="lazy" />
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