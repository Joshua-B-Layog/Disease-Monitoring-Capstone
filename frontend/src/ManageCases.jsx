import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from './config';
import './ManageCases.css';
import { findPurokCoords } from './data/coordinates';
const FeverIcon = ({ color = '#ef4444', size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M23.909,10.583c-.104,.345-.297,.668-.587,.924l-.512,.451-1.277-1.451-1.5,1.322,1.277,1.45-1.646,1.45-1.263-1.434-1.5,1.322,1.262,1.433-1.793,1.718-.025-.036-.013,.014c-.02-.018-2.005-1.748-4.336-1.748s-4.316,1.73-4.336,1.748l-1.33-1.493c.103-.092,2.559-2.254,5.666-2.254,.741,0,1.44,.128,2.084,.316l6.598-5.81c.83-.73,2.093-.65,2.823,.179,.015,.017,.024,.036,.038,.054C22.117,3.698,17.495,0,12,0,5.373,0,0,5.373,0,12s5.373,12,12,12,12-5.373,12-12c0-.48-.036-.951-.091-1.417Zm-8.413-2.583c.828,0,1.5,.672,1.5,1.5s-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5,.672-1.5,1.5-1.5Zm-7,0c.828,0,1.5,.672,1.5,1.5s-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5,.672-1.5,1.5-1.5Z"/>
  </svg>
);

const InfluenzaAIcon = ({ color = '#f59e0b', size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="m20.354,15.348l2.396.619c.083.022.168.032.25.032.445,0,.851-.299.968-.75.138-.534-.183-1.08-.718-1.218l-2.363-.611c.074-.463.113-.938.113-1.422s-.039-.958-.113-1.422l2.363-.611c.535-.138.856-.684.718-1.218-.139-.534-.683-.86-1.218-.718l-2.396.619c-.331-.822-.779-1.584-1.325-2.266l1.559-1.559c.283.111.591.173.913.173,1.379,0,2.5-1.121,2.5-2.5s-1.121-2.5-2.5-2.5-2.5,1.121-2.5,2.5c0,.322.062.63.173.913l-1.559,1.559c-.682-.546-1.444-.994-2.266-1.325l.619-2.397c.138-.534-.183-1.08-.718-1.218-.539-.144-1.08.183-1.219.718l-.611,2.363c-.463-.074-.938-.113-1.421-.113s-.958.039-1.421.113l-.611-2.363c-.138-.535-.682-.861-1.219-.718-.535.138-.856.684-.718,1.218l.619,2.397c-.822.331-1.584.779-2.266,1.325l-1.559-1.559c.111-.283.173-.591.173-.913,0-1.379-1.121-2.5-2.5-2.5S0,1.121,0,2.5s1.121,2.5,2.5,2.5c.322,0,.63-.062.913-.173l1.559,1.559c-.546.682-.994,1.444-1.325,2.266l-2.396-.619c-.534-.143-1.08.184-1.218.718s.183,1.08.718,1.218l2.363.611c-.074.463-.113.938-.113,1.422,0,.489.04,.97.115,1.438l-2.359.592c-.536.134-.861.678-.726,1.213.114.454.521.757.969.757.081,0,.163-.01.245-.03l2.41-.605c.33.816.776,1.572,1.318,2.25l-1.559,1.559c-.283-.111-.591-.173-.913-.173-1.379,0-2.5,1.121-2.5,2.5s1.121,2.5,2.5,2.5,2.5-1.121,2.5-2.5c0-.322-.062-.63-.173-.913l1.559-1.559c.682.546,1.444.994,2.266,1.325l-.619,2.397c-.138.534.183,1.08.718,1.218.084.022.168.032.251.032.445,0,.851-.299.968-.75l.611-2.363c.463.074.938.113,1.421.113s.958-.039,1.421-.113l.611,2.363c.117.451.522.75.968.75.083,0,.167-.01.251-.032.535-.138.856-.684.718-1.218l-.619-2.397c.822-.331,1.584-.779,2.266-1.325l1.559,1.559c-.111.283-.173.591-.173.913,0,1.379,1.121,2.5,2.5,2.5s2.5-1.121,2.5-2.5-1.121-2.5-2.5-2.5c-.322,0-.63.062-.913.173l-1.559-1.559c.546-.682.994-1.444,1.325-2.266ZM12,6.964c.828,0,1.5.672,1.5,1.5s-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5.672-1.5,1.5-1.5Zm-5.036,5.036c0-.828.672-1.5,1.5-1.5.828,0,1.5.672,1.5,1.5,0,.828-.672,1.5-1.5,1.5-.828,0-1.5-.672-1.5-1.5Zm3.536,3.536c0-.828.672-1.5,1.5-1.5.828,0,1.5.672,1.5,1.5,0,.828-.672,1.5-1.5,1.5-.828,0-1.5-.672-1.5-1.5Zm3.536-3.536c0-.828.672-1.5,1.5-1.5s1.5.672,1.5,1.5c0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5Z"/>
  </svg>
);

const LeptospirosisIcon = ({ color = '#10b981', size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="m5.47,12.377L.244,21.337c-.689,1.181.163,2.663,1.53,2.663h10.453c1.367,0,2.218-1.483,1.53-2.663l-5.226-8.96c-.683-1.171-2.376-1.171-3.059,0Zm1.53,10.623h0c-.552,0-1-.448-1-1h0c0-.552.448-1,1-1h0c.552,0,1,.448,1,1h0c0,.552-.448,1-1,1Zm-1-4v-3c0-.552.448-1,1-1h0c.552,0,1,.448,1,1v3c0,.552-.448,1-1,1h0c-.552,0-1-.448-1-1Zm18-2.5c0,3.038-2.462,5.5-5.5,5.5-1,0-2.311-.497-2.61-.658-.085-.348-.218-.69-.406-1.013l-5.227-8.96c-.118-.201-.256-.383-.403-.556.932-.517,2.004-.813,3.146-.813,1.435,0,2.758.471,3.833,1.259.526-.167,1.086-.259,1.667-.259,3.038,0,5.5,2.462,5.5,5.5ZM7,9.498c-1.356,0-2.574.699-3.257,1.871l-1.384,2.373c-1.175-.906-2.016-2.225-2.27-3.753,0,0,0-.001,0-.002-.053-.322-.088-.651-.088-.988,0-.33.034-.651.085-.967C.49,5.217,2.623,3.157,5.424,3.009c1.126-1.847,3.15-3.009,5.326-3.009,1.444,0,2.81.488,3.919,1.39.573-.256,1.194-.39,1.831-.39,1.914,0,3.592,1.24,4.22,2.996,1.657.302,2.947,1.621,3.216,3.289.002.012.061.675.061.675,0,1.489-.701,2.258-.972,2.573-1.259-.957-2.824-1.532-4.524-1.532-.438,0-.873.038-1.303.114-1.278-.731-2.712-1.114-4.197-1.114-1.865,0-3.587.611-4.99,1.634-.323-.088-.662-.136-1.01-.136Z"/>
  </svg>
);

const TuberculosisIcon = ({ color = '#f97316', size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="m18 12c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm-1.5 10c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm.5-4c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm4 2c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm-8-9.608v-6.396h3.022c2.794 0,5.219 1.929,5.847 4.651l.634 2.746c-1.284-.878-2.834-1.393-4.503-1.393-1.805 0-3.466.608-4.806 1.62-.125-.39-.194-.803-.194-1.228zm-2.453 10.494c-.531 1.067-1.494 1.895-2.703 2.218l-2.637.703c-.352.12-.777.189-1.204.19h-.006c-1.049 0-2.078-.428-2.826-1.176-.755-.753-1.17-1.757-1.17-2.827 0-1.402.16-2.805.475-4.169l1.656-7.177c.628-2.723 3.053-4.651 5.847-4.651h3.022v6.396c0 1.725-1.1 3.25-2.735 3.795l-2.581.86c-.523.175-.807.741-.632 1.265.174.529.754.807,1.265.632l2.581-.86c.587-.196 1.12-.483 1.6-.835-.316.859-.498 1.783-.498 2.751 0 1.018.199 1.989.547 2.885zm2.453-16.89h-2v-3c0-.553.447-1 1-1s1 .448 1 1z"/>
  </svg>
);

const TyphoidIcon = ({ color = '#8b5cf6', size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="m24,10v-2h-2.075c-.081-.581-.226-1.146-.447-1.682l1.772-1.051-1.021-1.72-1.773,1.052c-.156-.193-.32-.379-.498-.557h0c-.237-.238-.491-.446-.752-.642l.993-1.814-1.754-.961-.995,1.817c-.472-.174-.958-.295-1.451-.363V0h-2v2.088c-.569.084-1.129.234-1.667.459l-1.092-1.794-1.708,1.04,1.085,1.782c-.178.146-.351.301-.518.467l-.779.779-1.422-1.422-1.414,1.414,1.422,1.422-1.672,1.672-1.422-1.422-1.414,1.414,1.422,1.422-.779.779c-.166.166-.321.339-.467.517l-1.782-1.085-1.04,1.708,1.794,1.092c-.225.538-.375,1.098-.459,1.667H0v2h2.079c.069.493.189.979.363,1.451l-1.817.995.961,1.754,1.814-.993c.196.261.405.515.642.752.178.178.365.344.557.499l-1.052,1.772,1.72,1.021,1.053-1.775c.542.222,1.107.367,1.68.446v2.078h2v-2.087c.576-.085,1.143-.239,1.686-.468l1.134,1.862,1.708-1.04-1.13-1.856c.173-.142.341-.293.502-.454l.779-.779,1.488,1.488,1.414-1.414-1.488-1.488,1.672-1.672,1.488,1.488,1.414-1.414-1.488-1.488.779-.779c.161-.161.312-.329.455-.502l1.855,1.129,1.04-1.708-1.858-1.131c.228-.538.381-1.105.467-1.689h2.083Zm-16.5,6c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Zm6-1c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Zm1-6c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Z"/>
  </svg>
);

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
    { id: 1, name: 'Dengue Fever', dbName: 'Dengue', icon: <FeverIcon color="#ef4444" />, color: '#ef4444', desc: 'A viral infection transmitted by Aedes mosquitoes, causing high fever and severe body aches.' },
    { id: 2, name: 'Influenza A', dbName: 'Influenza A', icon: <InfluenzaAIcon color="#f59e0b" />, color: '#f59e0b', desc: 'A highly contagious respiratory illness caused by influenza viruses, leading to seasonal outbreaks.' },
    { id: 3, name: 'Covid-19', dbName: 'Covid-19', icon: '🛡️', color: '#3b82f6', desc: 'An infectious respiratory disease caused by the SARS-CoV-2 virus, requiring close contact tracing.' },
    { id: 4, name: 'Leptospirosis', dbName: 'Leptospirosis', icon: <LeptospirosisIcon color="#10b981" />, color: '#10b981', desc: 'A bacterial disease spread through contaminated water, posing a high risk during flood seasons.' },
    { id: 5, name: 'Tuberculosis', dbName: 'Tuberculosis', icon: <TuberculosisIcon color="#f97316" />, color: '#f97316', desc: 'An infectious bacterial disease that primarily affects the lungs, requiring long-term treatment.' },
    { id: 6, name: 'Typhoid Fever', dbName: 'Typhoid Fever', icon: <TyphoidIcon color="#8b5cf6" />, color: '#8b5cf6', desc: 'A systemic infection caused by Salmonella Typhi, spread through contaminated food and water.' },
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
  'Marinig','Niugan','Pittland','Pulo','Sala','San Isidro'
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

  const blkMatch = a.match(/\bBLOCK\s*(\d+[A-Z]?)\b/)
    || a.match(/\bBLK\.?\s*(\d+[A-Z]?)\b/)
    || a.match(/\bB\.?\s*(\d+[A-Z]?)(?=\s|,|$|[A-Z])/);
  if (blkMatch) found.blk = blkMatch[1];

  const lotMatch = a.match(/\bLOT\.?\s*(\d+[A-Z]?)\b/)
    || a.match(/\bL\.?\s*(\d+[A-Z]?)(?=\s|,|$|[A-Z])/);
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

  if (parts.length > 0) return parts.join(' ');

  const knownSubds = ['SOUTHVILLE 1A', 'SOUTHVILLE 1B', 'SOUTHVILLE 2', 'SOUTHVILLE 3'];
  for (const subd of knownSubds) {
    if (a.includes(subd)) return subd;
  }

  return null;
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

export default function ManageCases({ caseFilter, setCaseFilter, dateFormat, autoSave, confirmDelete, keyboardShortcuts, fontScale, compactMode, loggedUserId, loginRole, loginBarangay, sessionContext, initialView, onInitialViewConsumed }) {
  const [view, setView] = useState('categories');
  const [inboxItems, setInboxItems] = useState([]);
  const [outboxItems, setOutboxItems] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [cardPage, setCardPage] = useState(0);
  const [selectedDisease, setSelectedDisease] = useState(null);
  const gotoActiveRef = useRef(false);
  const [editingCase, setEditingCase] = useState(null);
  const [routingStep, setRoutingStep] = useState(null);
  const [routingData, setRoutingData] = useState(null);
  const [routingDescription, setRoutingDescription] = useState('');
  const [routingTargetType, setRoutingTargetType] = useState(null);
  const [routingTargetBarangay, setRoutingTargetBarangay] = useState('');

  const [allCases, setAllCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [barangayList, setBarangayList] = useState([]);
  const [allDiseases, setAllDiseases] = useState([]);
  const choUnitBarangays = sessionContext ? CHO_UNIT_BARANGAYS[sessionContext] || [] : [];
  const scopedBarangayOptions = (loginRole === 'CHO' && sessionContext && CHO_UNIT_BARANGAYS[sessionContext])
    ? CHO_UNIT_BARANGAYS[sessionContext]
    : CABUYAO_BARANGAYS;
  const scopedBarangayList = (loginRole === 'CHO' && scopedBarangayOptions.length > 0)
    ? barangayList.filter(b => scopedBarangayOptions.includes(b.name))
    : barangayList;

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
      if (caseFilter.purok) {
        gotoActiveRef.current = true;
        setFilterPurok(caseFilter.purok);
      }
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
    if (setCaseFilter) setCaseFilter({ disease: '', barangay: '', purok: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseFilter]);

  // Reset purok filter when user manually switches disease card (not during Go To)
  useEffect(() => {
    if (!gotoActiveRef.current) {
      setFilterPurok('All Puroks');
    }
    gotoActiveRef.current = false;
  }, [selectedDisease]);

  useEffect(() => {
    if (initialView === 'inbox') {
      setView('inbox');
      if (onInitialViewConsumed) onInitialViewConsumed();
    }
  }, [initialView]);

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

  const fetchInbox = () => {
    setInboxLoading(true);
    const params = { status: 'pending' };
    if (loginRole === 'BHW' && loginBarangay) {
      const matched = barangayList.find(b => b.name === loginBarangay);
      if (matched) params.barangay_id = matched.id;
    } else {
      params.cho_unit = sessionContext;
    }
    axios.get(`${API_URL}/api/case-inbox`, { params })
      .then(res => { setInboxItems(res.data); setInboxLoading(false); })
      .catch(() => setInboxLoading(false));
  };

  const getChoUnitForBarangay = (barangayName) => {
    const normalized = (barangayName || '').replace(/^Brgy\.\s*/i, '').trim().toLowerCase();
    for (const [unit, list] of Object.entries(CHO_UNIT_BARANGAYS)) {
      if (list.some(b => b.toLowerCase() === normalized)) return unit;
    }
    return null;
  };

  const fetchOutbox = () => {
    const choUnit = loginRole === 'BHW' && loginBarangay
      ? getChoUnitForBarangay(loginBarangay)
      : sessionContext;
    const params = { cho_unit: choUnit };
    if (loginRole === 'BHW' && loginBarangay) {
      params.barangay = loginBarangay;
      params.user_id = loggedUserId;
    }
    axios.get(`${API_URL}/api/case-outbox`, { params })
      .then(res => setOutboxItems(res.data))
      .catch(() => {});
  };

  const handleAcceptInboxItem = (item) => {
    axios.put(`${API_URL}/api/case-inbox/${item.id}/accept`)
      .then(res => {
        const caseId = res.data.case_id;
        const diseaseCard = findCardForDisease(item.disease_name);
        if (diseaseCard) setSelectedDisease(diseaseCard);
        fetchInbox();
        fetchCases();
        openEdit({
          case_id: caseId,
          patient_name: item.patient_name,
          disease_name: item.disease_name,
          age: item.age,
          severity: item.severity,
          gender: item.gender,
          status: 'Active',
          contact: item.contact,
          onset_date: item.onset_date,
          address: item.address,
          barangay_name: '',
          symptoms: item.symptoms,
          physician: item.physician,
          latitude: item.latitude,
          longitude: item.longitude,
        });
      })
      .catch(err => alert('Accept failed: ' + (err.response?.data?.error || err.message)));
  };

  const handleRoutingDelete = () => {
    setRoutingStep(null);
    setRoutingData(null);
    setRoutingDescription('');
    setRoutingTargetType(null);
    setRoutingTargetBarangay('');
    setView('categories');
  };

  const handleRoutingSendToDescription = () => {
    setRoutingTargetType('unit');
    setRoutingStep('description');
  };

  const handleRoutingShowBhwStep = () => {
    setRoutingTargetType('barangay');
    setRoutingTargetBarangay(routingData?.detectedBarangay || '');
    setRoutingStep('target-bhw');
  };

  const handleRoutingCancelDescription = () => {
    setRoutingStep('confirm');
  };

  const handleRoutingSendToBhw = async () => {
    if (!routingData) return;
    const { payload, detectedBarangay } = routingData;
    const targetBarangay = routingTargetBarangay || detectedBarangay;
    if (!targetBarangay) {
      setSubmitMsg('Please select a target barangay.');
      return;
    }
    setSubmitLoading(true);
    try {
      await axios.post(`${API_URL}/api/cases/route-to-barangay-inbox`, {
        ...payload,
        submitter_user_id: loggedUserId || null,
        submitter_name: loggedUserId ? String(loggedUserId) : 'Unknown',
        from_cho_unit: (loginRole === 'BHW' && loginBarangay ? getChoUnitForBarangay(loginBarangay) : sessionContext) || null,
        target_barangay_name: targetBarangay,
        notes: routingDescription || null,
      });
      setSubmitMsg('Case sent to ' + targetBarangay + ' BHW inbox successfully!');
      setRoutingStep(null);
      setRoutingData(null);
      setRoutingDescription('');
      setRoutingTargetType(null);
      await fetchCases();
      setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1200);
    } catch (routeErr) {
      setSubmitMsg('Error: ' + (routeErr.response?.data?.error || routeErr.message));
      setSubmitLoading(false);
    }
  };

  const handleRoutingSend = async () => {
    if (!routingData) return;
    const { targetUnit, payload } = routingData;
    setSubmitLoading(true);
    try {
      await axios.post(`${API_URL}/api/cases/route-to-inbox`, {
        ...payload,
        submitter_user_id: loggedUserId || null,
        submitter_name: loggedUserId ? String(loggedUserId) : 'Unknown',
        from_cho_unit: (loginRole === 'BHW' && loginBarangay ? getChoUnitForBarangay(loginBarangay) : sessionContext) || null,
        to_cho_unit: targetUnit,
        notes: routingDescription || null,
      });
      setSubmitMsg('Case sent to ' + targetUnit + ' inbox successfully!');
      setRoutingStep(null);
      setRoutingData(null);
      setRoutingDescription('');
      setRoutingTargetType(null);
      setRoutingTargetBarangay('');
      await fetchCases();
      setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1200);
    } catch (routeErr) {
      setSubmitMsg('Error: ' + (routeErr.response?.data?.error || routeErr.message));
      setSubmitLoading(false);
    }
  };

  const handleRejectInboxItem = (item) => {
    axios.put(`${API_URL}/api/case-inbox/${item.id}/reject`)
      .then(() => fetchInbox())
      .catch(err => alert('Reject failed: ' + (err.response?.data?.error || err.message)));
  };

  useEffect(() => {
    if (view === 'inbox') fetchInbox();
    if (view === 'outbox') fetchOutbox();
  }, [view, sessionContext]);

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
        if (view === 'add' || view === 'edit') { setView('list'); setFilterPurok('All Puroks'); }
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

    console.log('[handleSave] submitting. address:', formData.address, 'barangayId:', formData.barangayId, 'loginRole:', loginRole, 'loginBarangay:', loginBarangay);

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
        await axios.post(API_URL + '/api/cases', {
          ...payload,
          submitter_cho_unit: sessionContext || null,
          submitter_role: loginRole || null,
          submitter_own_barangay: loginBarangay || null,
        });
        setSubmitMsg(isDraft ? 'Case saved as draft!' : 'Case added successfully!');
      }
      await fetchCases();
      const diseaseCard = findCardForDisease(formData.diseaseType);
      if (diseaseCard) setSelectedDisease(diseaseCard);
      setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1200);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.crossBarangay) {
        const { detectedBarangay, message } = err.response.data;
        const confirmed = window.confirm(message);
        if (confirmed) {
          try {
            await axios.post(`${API_URL}/api/cases/route-to-barangay-inbox`, {
              ...payload,
              submitter_user_id: loggedUserId || null,
              submitter_name: loggedUserId ? String(loggedUserId) : 'Unknown',
              from_cho_unit: (loginRole === 'BHW' && loginBarangay ? getChoUnitForBarangay(loginBarangay) : sessionContext) || null,
              target_barangay_name: detectedBarangay,
            });
            setSubmitMsg('Case sent to ' + detectedBarangay + ' BHW inbox successfully!');
            await fetchCases();
            const diseaseCard = findCardForDisease(formData.diseaseType);
            if (diseaseCard) setSelectedDisease(diseaseCard);
            setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1200);
          } catch (routeErr) {
            setSubmitMsg('Error: ' + (routeErr.response?.data?.error || routeErr.message));
            setSubmitLoading(false);
          }
        } else {
          setSubmitMsg('Please select the correct assigned barangay.');
          setSubmitLoading(false);
        }
        return;
      }
      if (err.response?.status === 409 && err.response?.data?.crossUnit) {
        const { targetUnit, message, detectedBarangay } = err.response.data;
        setRoutingData({ targetUnit, message, detectedBarangay, payload });
        setRoutingStep('confirm');
        setSubmitLoading(false);
        return;
      }
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
      <div style={{ padding: compactMode ? '24px 14px 14px' : '48px 28px 28px', color: 'var(--text-main)', fontSize: `calc(14px * ${fs})` }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div onClick={() => { setView('inbox'); }}
                style={{ padding: '6px 14px', borderRadius: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: 'var(--text-main)', whiteSpace: 'nowrap', textAlign: 'center', minWidth: '70px' }}>
                Inbox
              </div>
              <div onClick={() => { setView('outbox'); }}
                style={{ padding: '6px 14px', borderRadius: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: 'var(--text-main)', whiteSpace: 'nowrap', textAlign: 'center', minWidth: '70px' }}>
                Outbox
              </div>
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
  // VIEW: INBOX (Gmail-style)
  // ═══════════════════════════════════
  if (view === 'inbox') {
    return (
      <div style={{ padding: compactMode ? '14px' : '28px', color: 'var(--text-main)', fontSize: `calc(14px * ${fs})` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Dashboard / Manage Cases / Inbox</div>
            <h2 style={{ margin: 0, fontSize: '22px' }}> Inbox</h2>
          </div>
          <button onClick={() => setView('categories')}
            style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>
            ← Back
          </button>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
          {inboxLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading inbox...</div>
          ) : inboxItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Inbox is empty.</div>
          ) : (
            inboxItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14.4px', color: 'var(--text-muted)', lineHeight: 1, textAlign: 'left' }}>
                    {item.from_user_role === 'BHW'
                      ? `From BHW (${item.from_sender_barangay_name || 'Unknown'})`
                      : `From ${item.from_cho_unit || 'Unknown Unit'}`}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                    <div className="inbox-avatar-circle">
                      {item.from_user_role === 'BHW' && item.from_sender_barangay_name
                        ? item.from_sender_barangay_name.slice(0, 2).toUpperCase()
                        : (item.from_cho_unit || 'U').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                        {item.patient_name} · {item.disease_name} ({item.severity})
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.address}
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          "{item.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {new Date(item.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => handleAcceptInboxItem(item)} title="Accept"
                    style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer', fontSize: '16px' }}>
                    ✓
                  </button>
                  <button onClick={() => handleRejectInboxItem(item)} title="Reject"
                    style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // VIEW: OUTBOX (Gmail-style)
  // ═══════════════════════════════════
  if (view === 'outbox') {
    return (
      <div style={{ padding: compactMode ? '14px' : '28px', color: 'var(--text-main)', fontSize: `calc(14px * ${fs})` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Dashboard / Manage Cases / Outbox</div>
            <h2 style={{ margin: 0, fontSize: '22px' }}> Outbox</h2>
          </div>
          <button onClick={() => setView('categories')}
            style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>
            ← Back
          </button>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
          {outboxItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Outbox is empty.</div>
          ) : (
            outboxItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: item.status === 'accepted' ? '#10b981' : item.status === 'rejected' ? '#ef4444' : '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '11px', flexShrink: 0 }}>
                  {item.status === 'accepted' ? '✓' : item.status === 'rejected' ? '✕' : '…'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>
                    {item.patient_name} · {item.disease_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
                    {item.direction === 'sent' ? 'Sent to' : 'Received from'} {item.direction === 'sent' ? (item.to_cho_unit || item.to_barangay_name || '—') : (item.from_barangay_name ? `BHW (${item.from_barangay_name})` : item.from_cho_unit || '—')}
                    {item.direction === 'sent' && <span> · Status: <span style={{ textTransform: 'capitalize', fontWeight: '600', color: item.status === 'accepted' ? '#10b981' : item.status === 'rejected' ? '#ef4444' : '#f59e0b' }}>{item.status}</span></span>}
                    {item.barangay_name && <span> · Assigned to {item.barangay_name}</span>}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {new Date(item.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))
          )}
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
        <button onClick={() => { setView('list'); setFilterPurok('All Puroks'); }}
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
                      let matchedBarangay = barangayList.find(b => {
                        const bNorm = b.name.replace(/\(.*?\)/g, '').toLowerCase().replace(/[\-\s().]/g, '').trim();
                        return addrLower.includes(bNorm);
                      });
                      if (!matchedBarangay) {
                        const BARANGAY_ALIASES = { 'bugtong': 'Butong', 'pitland': 'Pittland' };
                        for (const [alias, realName] of Object.entries(BARANGAY_ALIASES)) {
                          if (addrLower.includes(alias)) {
                            matchedBarangay = barangayList.find(b => b.name.toLowerCase() === realName.toLowerCase());
                            if (matchedBarangay) break;
                          }
                        }
                      }

                      if (matchedBarangay) {
                        setFormData(prev => ({ ...prev, barangayId: String(matchedBarangay.id) }));
                      }

                      // ── detect Purok/Blk/Phase/Lot from the typed address ──
                      const unit = extractLocationUnit(addr);
                      if (unit) {
                        setFormData(prev => ({ ...prev, purok: unit }));
                      }

                      const barangayName = matchedBarangay?.name || barangayList.find(b => String(b.id) === String(formData.barangayId))?.name || '';

                      // Prefer purok offset coordinates over Nominatim
                      const purokCoords = unit && barangayName
                        ? findPurokCoords(barangayName, unit, BARANGAY_COORDS)
                        : null;
                      if (purokCoords) {
                        const targetB = matchedBarangay || (formData.barangayId
                          ? barangayList.find(b => String(b.id) === String(formData.barangayId))
                          : null);
                        setFormData(prev => ({
                          ...prev,
                          barangayId: String(targetB?.id || prev.barangayId),
                          lat: String(purokCoords[0]),
                          lng: String(purokCoords[1]),
                        }));
                      } else {
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
                            const fallbackCoords = BARANGAY_COORDS[targetB.name];
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
                          const fallbackCoords = BARANGAY_COORDS[targetB.name];
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
                      }
                    }}
                      onKeyDown={async (e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const addr = e.target.value.trim();
                      if (!addr) return;

                      const addrLower = addr.toLowerCase().replace(/[\-\s]/g, '');
                      let matchedBarangay = barangayList.find(b => {
                        const bNorm = b.name.replace(/\(.*?\)/g, '').toLowerCase().replace(/[\-\s().]/g, '').trim();
                        return addrLower.includes(bNorm);
                      });
                      if (!matchedBarangay) {
                        const BARANGAY_ALIASES = { 'bugtong': 'Butong', 'pitland': 'Pittland' };
                        for (const [alias, realName] of Object.entries(BARANGAY_ALIASES)) {
                          if (addrLower.includes(alias)) {
                            matchedBarangay = barangayList.find(b => b.name.toLowerCase() === realName.toLowerCase());
                            if (matchedBarangay) break;
                          }
                        }
                      }

                      if (matchedBarangay) {
                        setFormData(prev => ({ ...prev, barangayId: String(matchedBarangay.id) }));
                      }

                      // ── detect Purok/Blk/Phase/Lot from the typed address ──
                      const unit = extractLocationUnit(addr);
                      if (unit) {
                        setFormData(prev => ({ ...prev, purok: unit }));
                      }

                      const barangayName = matchedBarangay?.name || barangayList.find(b => String(b.id) === String(formData.barangayId))?.name || '';

                      // Prefer purok offset coordinates over Nominatim
                      const purokCoords = unit && barangayName
                        ? findPurokCoords(barangayName, unit, BARANGAY_COORDS)
                        : null;
                      if (purokCoords) {
                        const targetB = matchedBarangay || (formData.barangayId
                          ? barangayList.find(b => String(b.id) === String(formData.barangayId))
                          : null);
                        setFormData(prev => ({
                          ...prev,
                          barangayId: String(targetB?.id || prev.barangayId),
                          lat: String(purokCoords[0]),
                          lng: String(purokCoords[1]),
                        }));
                      } else {
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
                            const fallbackCoords = BARANGAY_COORDS[targetB.name];
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
                          const fallbackCoords = BARANGAY_COORDS[targetB.name];
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
                        <span>{scopedBarangayList.find(b => String(b.id) === String(formData.barangayId))?.name || '— Select Barangay —'}</span>
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
                          {scopedBarangayList.map(b => (
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
              <button type="button" onClick={() => { setView('list'); setFilterPurok('All Puroks'); }}
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

        {/* Routing modal */}
        {routingStep && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              {routingStep === 'confirm' && (
                <>
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-main)' }}>
                    This address is not within our covered barangays, do you want to give it to {routingData?.targetUnit}?
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={handleRoutingDelete}
                      style={{ padding: '10px 24px', borderRadius: '6px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                      ✕ Delete
                    </button>
                    {loginRole === 'BHW' ? (
                      <>
                        <button onClick={handleRoutingSendToDescription}
                          style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                          → Send to CHO I
                        </button>
                        <button onClick={handleRoutingShowBhwStep}
                          style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                          → Send to BHW
                        </button>
                      </>
                    ) : (
                      <button onClick={handleRoutingSendToDescription}
                        style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                        → Send
                      </button>
                    )}
                  </div>
                </>
              )}
              {routingStep === 'description' && (
                <>
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-main)' }}>
                    Add a note about this case
                  </div>
                  <textarea
                    value={routingDescription}
                    onChange={e => setRoutingDescription(e.target.value)}
                    placeholder="Describe the issue or any additional information..."
                    rows={4}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                    <button onClick={handleRoutingCancelDescription}
                      style={{ padding: '10px 24px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                      ← Cancel
                    </button>
                    <button onClick={handleRoutingSend}
                      style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                      Send
                    </button>
                  </div>
                </>
              )}
              {routingStep === 'target-bhw' && (
                <>
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-main)' }}>
                    Select target barangay
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
                    {scopedBarangayOptions.map(b => (
                      <div
                        key={b}
                        onClick={() => setRoutingTargetBarangay(b)}
                        style={{
                          padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                          background: routingTargetBarangay === b ? '#3b82f6' : 'var(--input-bg)',
                          color: routingTargetBarangay === b ? '#fff' : 'var(--text-main)',
                          border: routingTargetBarangay === b ? 'none' : '1px solid var(--border-color)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {b}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Add a note (optional)
                  </div>
                  <textarea
                    value={routingDescription}
                    onChange={e => setRoutingDescription(e.target.value)}
                    placeholder="Describe the issue or any additional information..."
                    rows={3}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', outline: 'none', marginBottom: '12px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={() => { setRoutingStep('confirm'); setRoutingTargetBarangay(''); }}
                      style={{ padding: '10px 24px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                      ← Back
                    </button>
                    <button onClick={handleRoutingSendToBhw}
                      style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}