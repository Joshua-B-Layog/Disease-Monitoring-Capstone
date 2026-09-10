import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { API_URL } from './config';
import BackButton from './components/BackButton';
import './ManageCases.css';
import cabuyaoBoundaries from './data/cabuyao_barangays.geojson.json';
import { cacheCases, getCachedCases, cacheBarangays, cacheDiseases, getCachedBarangays, getCachedDiseases, isOnline, cacheInboxItems, getCachedInboxItems, cacheContactMessages, getCachedContactMessages, cacheEditRequests, getCachedEditRequests, cacheOutboxItems, getCachedOutboxItems, cachePendingRegistrations, getCachedPendingRegistrations, upsertCachedCase, removeCachedCase } from './offlineSync';
import { enqueueOperation, removePendingCreatesByCaseId } from './syncEngine';
import { getPointInBarangay } from './data/coordinates';
import { notify } from './components/Toast';
import { DISEASES as DEFAULT_DISEASES } from './resident/PreventionTips';
import { emitDiseasesChanged } from './diseaseSignal';
import { FeverIcon, InfluenzaAIcon, LeptospirosisIcon, TuberculosisIcon, TyphoidIcon, RabiesIcon } from './components/DiseaseIcons';

const AllDiseasesIcon = ({ color = '#121358', size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="m23.705,18.549c-.896-1.325-2.959-3.549-6.705-3.549s-5.81,2.224-6.705,3.549c-.391.577-.392,1.323,0,1.902.896,1.325,2.96,3.549,6.706,3.549s5.809-2.224,6.705-3.549c.391-.578.391-1.324,0-1.902Zm-6.705,2.951c-1.105,0-2-.895-2-2s.895-2,2-2,2,.895,2,2-.895,2-2,2Zm-8.362.072c-.852-1.262-.851-2.888.001-4.146,1.116-1.651,3.689-4.427,8.361-4.427,3.311,0,5.568,1.395,7,2.796V5c0-2.761-2.239-5-5-5H5C2.239,0,0,2.239,0,5v13c0,2.761,2.239,5,5,5h4.797c-.489-.506-.872-1.004-1.159-1.428Zm2.362-16.572h7c.552,0,1,.448,1,1s-.448,1-1,1h-7c-.552,0-1-.448-1-1s.448-1,1-1Zm0,5h7c.552,0,1,.448,1,1s-.448,1-1,1h-7c-.552,0-1-.448-1-1s.448-1,1-1Zm-4.5-5.5c.828,0,1.5.672,1.5,1.5s-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5.672-1.5,1.5-1.5Zm0,5c.828,0,1.5.672,1.5,1.5s-.672,1.5-1.5,1.5-1.5-.672-1.5-1.5.672-1.5,1.5-1.5Zm0,8c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Z"/>
  </svg>
);

const WaterborneIcon = ({ color = '#0EA5E9', size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M14,24a5.952,5.952,0,0,1-4.242-1.758,6.025,6.025,0,0,1,0-8.484L14,9.261l4.263,4.517a6.029,6.029,0,0,1-.021,8.464h0A5.952,5.952,0,0,1,14,24ZM5,12a4.968,4.968,0,0,1-3.535-1.465,5.022,5.022,0,0,1,0-7.07L5,.007l3.527,3.45a5.02,5.02,0,0,1,.008,7.078A4.965,4.965,0,0,1,5,12Zm15-2a3.973,3.973,0,0,1-2.828-1.172,4.017,4.017,0,0,1,0-5.656L19.982.049,22.86,3.205a4.02,4.02,0,0,1-.032,5.623h0A3.973,3.973,0,0,1,20,10Z"/>
  </svg>
);

const VectorborneIcon = ({ color = '#D97706', size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="m23.876,14.461c-.243.889-.819,1.63-1.621,2.086-.527.3-1.111.454-1.702.454-.307,0-.615-.041-.919-.125-1.126-.31-4.501-3.197-6.48-4.895l5.245,6.119c.388.451.602,1.029.602,1.627v1.022c0,.157.075.307.201.401l1.398,1.048c.442.332.532.958.2,1.4-.196.262-.496.4-.801.4-.209,0-.419-.065-.599-.2l-1.4-1.05c-.627-.472-1-1.219-1-2v-1.022c0-.119-.042-.234-.119-.324l-3.881-4.527v4.123c0,.552-.447,1-1,1s-1-.448-1-1v-4.123l-3.879,4.526c-.079.091-.121.206-.121.325v1.022c0,.781-.373,1.529-.998,1.999l-1.402,1.051c-.18.135-.39.2-.599.2-.305,0-.604-.138-.801-.4-.332-.442-.242-1.068.2-1.4l1.4-1.05c.124-.093.199-.243.199-.4v-1.022c0-.598.214-1.176.604-1.628l5.243-6.118c-1.979,1.698-5.354,4.585-6.48,4.895-.304.083-.612.125-.919.125-.591,0-1.175-.153-1.702-.454-.802-.456-1.378-1.197-1.621-2.086-.244-.889-.128-1.82.328-2.621s1.197-1.377,2.086-1.621c.747-.205,2.689-.209,5.462-.219h2.029l-4.982-3.559c-.655-.468-1.047-1.229-1.047-2.034v-.787c0-.131-.054-.26-.146-.354l-1.561-1.561c-.391-.391-.391-1.023,0-1.414S3.316-.098,3.707.293l1.561,1.561c.466.465.732,1.11.732,1.768v.787c0,.161.078.313.209.407l3.831,2.737c-.338-.426-.54-.965-.54-1.551,0-.922.499-1.727,1.242-2.16l.746-3.428c.12-.55.904-.55,1.023,0l.746,3.428c.743.433,1.242,1.238,1.242,2.16,0,.592-.206,1.136-.551,1.565l3.862-2.749c.134-.095.213-.25.21-.415l-.012-.751c-.01-.674.258-1.332.733-1.807l1.55-1.551c.391-.391,1.023-.391,1.414,0,.391.39.391,1.023,0,1.414l-1.551,1.551c-.096.095-.148.227-.146.362l.012.75c.013.822-.379,1.597-1.05,2.075l-4.994,3.555h2.023c2.77-.013,4.714.014,5.462.219.889.244,1.63.82,2.086,1.621s.572,1.732.328,2.621Z"/>
  </svg>
);

const VaccineIcon = ({ color = '#129968', size = 28 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="m20.499,9h-.002c-.936,0-1.837-.366-2.473-1.002-.66-.658-1.024-1.537-1.024-2.474s.361-1.812,1.019-2.468l2.481-2.428,2.467,2.414c.669.669,1.033,1.548,1.033,2.482s-.364,1.814-1.025,2.475c-.637.636-1.539,1.001-2.476,1.001ZM3.564,5.257l2.163,2.023-.844.844c-1.17,1.17-1.17,3.073,0,4.243l8.707,8.707h6s2.957,2.957,2.957,2.957l1.414-1.414-2.957-2.957v-6s-1.302-1.302-1.302-1.302l-3.207,3.207-1.414-1.414,3.207-3.207-1.586-1.586-3.207,3.207-1.414-1.414,3.207-3.207-1.586-1.586-3.207,3.207-1.414-1.414,3.206-3.206c-1.171-1.162-3.066-1.159-4.233.008l-.913.913-2.178-2.038,2.255-2.305L5.789.124.039,5.999l1.43,1.398,2.095-2.141Z"/>
  </svg>
);


// ── Icon token system: icons are stored as serializable tokens so they survive the DB round-trip ──
const SVG_ICON_DEFS = [
  { token: 'svg:fever', name: 'Fever', render: () => <FeverIcon color="#ef4444" /> },
  { token: 'svg:flu-a', name: 'Influenza A', render: () => <InfluenzaAIcon color="#D97706" /> },
  { token: 'svg:leptospirosis', name: 'Leptospirosis', render: () => <LeptospirosisIcon color="#129968" /> },
  { token: 'svg:tuberculosis', name: 'Tuberculosis', render: () => <TuberculosisIcon color="#F97316" /> },
  { token: 'svg:typhoid', name: 'Typhoid', render: () => <TyphoidIcon color="#8B5CF6" /> },
  { token: 'svg:alldiseases', name: 'All Diseases', render: () => <AllDiseasesIcon color="#121358" /> },
  { token: 'svg:waterborne', name: 'Water & Foodborne', render: () => <WaterborneIcon color="#0EA5E9" /> },
  { token: 'svg:vectorborne', name: 'Vector-borne', render: () => <VectorborneIcon color="#D97706" /> },
  { token: 'svg:vaccine', name: 'Vaccine-Preventable', render: () => <VaccineIcon color="#129968" /> },
  { token: 'svg:rabies', name: 'Rabies', render: () => <RabiesIcon color="#DC2626" /> },
];

// Maps each built-in SVG disease to its token
const SVG_ENTRY_TOKEN = {
  'Dengue Fever': 'svg:fever',
  'Influenza A': 'svg:flu-a',
  'Leptospirosis': 'svg:leptospirosis',
  'Tuberculosis': 'svg:tuberculosis',
  'Typhoid Fever': 'svg:typhoid',
  'Rabies': 'svg:rabies',
};

// Convert any icon (emoji string or SVG JSX element) to its serializable token
const iconToToken = (icon, fallback = '🦠') => {
  if (!icon) return fallback;
  if (typeof icon === 'string') return icon;
  const elName = icon && icon.type && icon.type.name;
  if (elName) {
    const def = SVG_ICON_DEFS.find(s => s.render().type.name === elName);
    if (def) return def.token;
  }
  return fallback;
};

// Resolve a token back to a renderable icon (emoji string or SVG element)
const resolveIcon = (token) => {
  if (!token) return '🦠';
  const def = SVG_ICON_DEFS.find(s => s.token === token);
  if (def) return def.render();
  return typeof token === 'string' ? token : '🦠';
};

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

// ── All 28 disease entries with name, dbName (prefix match), icon, color, desc ──
const ALL_DISEASE_ENTRIES = [
  { id: 1,  name: 'Acute Respiratory Infection',   dbName: 'Acute Respiratory Infection', icon: '🫁', color: '#60A5FA', desc: 'Highly contagious respiratory infection affecting the upper and lower respiratory tract.' },
  { id: 2,  name: 'Avian Influenza',               dbName: 'Avian Influenza', icon: '🐔', color: '#F97316', desc: 'A viral influenza subtype transmitted from birds to humans, causing severe respiratory illness.' },
  { id: 3,  name: 'Chickenpox',                    dbName: 'Chickenpox', icon: '🟠', color: '#FB923C', desc: 'A highly contagious viral infection causing an itchy, blister-like rash and fever.' },
  { id: 4,  name: 'Cholera',                       dbName: 'Cholera', icon: '🌊', color: '#0EA5E9', desc: 'An acute diarrheal infection caused by ingestion of food or water contaminated with Vibrio cholerae.' },
  { id: 5,  name: 'Covid-19',                      dbName: 'Covid-19', icon: '🛡️', color: '#3B82F6', desc: 'An infectious respiratory disease caused by the SARS-CoV-2 virus, requiring close contact tracing.' },
  { id: 6,  name: 'Dengue Fever',                  dbName: 'Dengue', icon: <FeverIcon color="#ef4444" />, color: '#ef4444', desc: 'A viral infection transmitted by Aedes mosquitoes, causing high fever and severe body aches.' },
  { id: 7,  name: 'Diarrhea',                      dbName: 'Diarrhea', icon: '💩', color: '#D97706', desc: 'A gastrointestinal infection causing loose, watery stools, often leading to dehydration.' },
  { id: 8,  name: 'Diphtheria',                    dbName: 'Diphtheria', icon: '🫁', color: '#A78BFA', desc: 'A serious bacterial infection affecting the mucous membranes of the nose and throat.' },
  { id: 9,  name: 'Ebola',                         dbName: 'Ebola', icon: '🦠', color: '#DC2626', desc: 'A severe, often fatal viral hemorrhagic fever with high transmission risk.' },
  { id: 10, name: 'Hand Foot and Mouth Disease',   dbName: 'Hand Foot and Mouth Disease', icon: '🖐️', color: '#F472B6', desc: 'A mild viral illness common in children, causing sores in the mouth and rash on hands and feet.' },
  { id: 11, name: 'Hepatitis A',                   dbName: 'Hepatitis A', icon: '🫀', color: '#CA8A04', desc: 'A viral liver infection spread through contaminated food and water or close contact.' },
  { id: 12, name: 'Hepatitis B',                   dbName: 'Hepatitis B', icon: '🩸', color: '#B45309', desc: 'A serious liver infection caused by the hepatitis B virus, transmitted through blood and bodily fluids.' },
  { id: 13, name: 'Hepatitis C',                   dbName: 'Hepatitis C', icon: '🩸', color: '#92400E', desc: 'A viral liver infection transmitted through blood contact, often becoming chronic.' },
  { id: 14, name: 'HIV/AIDS',                      dbName: 'HIV/AIDS', icon: '🔴', color: '#DC2626', desc: 'A chronic viral infection attacking the immune system, requiring lifelong management.' },
  { id: 15, name: 'Influenza',                     dbName: 'Influenza', icon: '🤧', color: '#F59E0B', desc: 'A common contagious respiratory viral infection causing fever, cough, and body aches.' },
  { id: 16, name: 'Influenza A',                   dbName: 'Influenza A', icon: <InfluenzaAIcon color="#D97706" />, color: '#D97706', desc: 'A highly contagious respiratory illness caused by influenza viruses, leading to seasonal outbreaks.' },
  { id: 17, name: 'Leprosy',                       dbName: 'Leprosy', icon: '🧬', color: '#A1A1AA', desc: 'A chronic infectious disease affecting the skin and nerves, curable with multidrug therapy.' },
  { id: 18, name: 'Leptospirosis',                 dbName: 'Leptospirosis', icon: <LeptospirosisIcon color="#129968" />, color: '#129968', desc: 'A bacterial disease spread through contaminated water, posing a high risk during flood seasons.' },
  { id: 19, name: 'Malaria',                       dbName: 'Malaria', icon: '🦟', color: '#84CC16', desc: 'A life-threatening mosquito-borne disease causing fever, chills, and flu-like symptoms.' },
  { id: 20, name: 'Measles',                       dbName: 'Measles', icon: '🔴', color: '#DC2626', desc: 'A highly contagious viral disease causing fever and rash, preventable through vaccination.' },
  { id: 21, name: 'Meningococcemia',               dbName: 'Meningococcemia', icon: '🧠', color: '#8B5CF6', desc: 'A serious bacterial bloodstream infection that can lead to meningitis and sepsis.' },
  { id: 22, name: 'Pertussis',                     dbName: 'Pertussis', icon: '🤒', color: '#F472B6', desc: 'A highly contagious respiratory infection known as whooping cough, severe in infants.' },
  { id: 23, name: 'Poliomyelitis',                 dbName: 'Poliomyelitis', icon: '🦽', color: '#FCA5A5', desc: 'A viral disease that can cause permanent paralysis, preventable through vaccination.' },
  { id: 24, name: 'Rabies',                        dbName: 'Rabies', icon: <RabiesIcon color="#DC2626" />, color: '#DC2626', desc: 'A fatal viral disease transmitted through the bite of an infected animal, requiring immediate treatment.' },
  { id: 25, name: 'SARS',                          dbName: 'SARS', icon: '😷', color: '#6366F1', desc: 'A severe respiratory illness caused by a coronavirus, with high fever and respiratory distress.' },
  { id: 26, name: 'Sore Eyes',                     dbName: 'Sore Eyes', icon: '👁️', color: '#FCD34D', desc: 'A contagious eye infection causing redness, itching, and discharge, common in children.' },
  { id: 27, name: 'Tuberculosis',                  dbName: 'Tuberculosis', icon: <TuberculosisIcon color="#F97316" />, color: '#F97316', desc: 'An infectious bacterial disease that primarily affects the lungs, requiring long-term treatment.' },
  { id: 28, name: 'Typhoid Fever',                 dbName: 'Typhoid Fever', icon: <TyphoidIcon color="#8B5CF6" />, color: '#8B5CF6', desc: 'A systemic infection caused by Salmonella Typhi, spread through contaminated food and water.' },
];

// Icon picker choices: every disease's own icon (SVG components + emojis) labelled by disease name,
// keyed by serializable token, with duplicate emoji icons removed (only the first disease using that emoji is kept),
// plus every SVG logo (category + disease logos) so all of them are always available in the picker
const DISEASE_ICON_CHOICES = (() => {
  const seen = new Set();
  const out = [];
  for (const d of ALL_DISEASE_ENTRIES) {
    const token = SVG_ENTRY_TOKEN[d.name] || iconToToken(d.icon);
    if (seen.has(token)) continue;
    seen.add(token);
    out.push({ key: token, label: d.name, icon: d.icon });
  }
  for (const def of SVG_ICON_DEFS) {
    if (seen.has(def.token)) continue;
    if (def.token === 'svg:alldiseases') continue;
    seen.add(def.token);
    out.push({ key: def.token, label: def.name, icon: def.render() });
  }
  return out;
})();

// Extra emoji choices for the "Add New Disease" icon picker,
// minus any emoji already covered by the disease icons above
const EXTRA_ICON_CHOICES = (() => {
  const covered = new Set(
    DISEASE_ICON_CHOICES.filter(c => typeof c.key === 'string' && !c.key.startsWith('svg:')).map(c => c.key)
  );
  return ['🦠','🦟','🫁','🩺','💊','🧪','🧫','👁️','🩹','🦻','🧠','🫀','🩸','🦾','🐾','😷','🤒','🏥','🧬','💧','🫧','🌡️','🩼']
    .filter(ic => !covered.has(ic));
})();

// Card dbNames sorted by length descending (longest-first for prefix matching)
const SORTED_CARD_DBNAMES = ALL_DISEASE_ENTRIES
  .map(d => d.dbName.toLowerCase())
  .sort((a, b) => b.length - a.length);

const findDiseaseEntry = (diseaseName) => {
  if (!diseaseName) return null;
  const dn = diseaseName.toLowerCase();
  for (const entry of ALL_DISEASE_ENTRIES) {
    const target = entry.dbName.toLowerCase();
    if (dn === target || dn.startsWith(target + ' ')) return entry;
  }
  return null;
};

// ── Disease categories ──
const DISEASE_CATEGORIES = [
  {
    id: 'all', name: 'All Diseases', icon: resolveIcon('svg:alldiseases'), color: '#121358',
    desc: 'All 28 tracked communicable diseases in Cabuyao',
    diseases: ALL_DISEASE_ENTRIES,
  },
  {
    id: 'exclusive', name: 'Exclusive Diseases', icon: resolveIcon('svg:rabies'), color: '#DC2626',
    desc: 'Diseases with no known 100% cure in current medical science',
    diseases: ALL_DISEASE_ENTRIES.filter(d => ['HIV/AIDS', 'Rabies', 'Hepatitis B', 'Leprosy', 'Poliomyelitis'].includes(d.name)),
  },
  {
    id: 'waterborne', name: 'Water & Foodborne', icon: resolveIcon('svg:waterborne'), color: '#0EA5E9',
    desc: 'Diseases spread through contaminated water or food',
    diseases: ALL_DISEASE_ENTRIES.filter(d => ['Cholera', 'Typhoid Fever', 'Hepatitis A', 'Diarrhea'].includes(d.name)),
  },
  {
    id: 'vector', name: 'Vector-borne', icon: resolveIcon('svg:vectorborne'), color: '#D97706',
    desc: 'Diseases transmitted by mosquitoes and other vectors',
    diseases: ALL_DISEASE_ENTRIES.filter(d => ['Dengue Fever', 'Leptospirosis', 'Malaria'].includes(d.name)),
  },
  {
    id: 'respiratory', name: 'Respiratory', icon: resolveIcon('svg:flu-a'), color: '#3B82F6',
    desc: 'Diseases spread through respiratory droplets and airborne transmission',
    diseases: ALL_DISEASE_ENTRIES.filter(d => ['Acute Respiratory Infection', 'Avian Influenza', 'Covid-19', 'Influenza', 'Influenza A', 'SARS', 'Tuberculosis'].includes(d.name)),
  },
  {
    id: 'vaccine', name: 'Vaccine-Preventable', icon: resolveIcon('svg:vaccine'), color: '#129968',
    desc: 'Diseases that can be prevented through routine vaccination programs',
    diseases: ALL_DISEASE_ENTRIES.filter(d => ['Chickenpox', 'Diphtheria', 'Measles', 'Pertussis'].includes(d.name)),
  },
  {
    id: 'contact', name: 'Contact & Bloodborne', icon: '🩸', color: '#7C3AED',
    desc: 'Diseases transmitted through direct contact, bodily fluids, or blood exposure',
    diseases: ALL_DISEASE_ENTRIES.filter(d => ['Ebola', 'Hepatitis C', 'Hand Foot and Mouth Disease', 'Meningococcemia', 'Sore Eyes'].includes(d.name)),
  },
];

const ALL_DISEASE_OPTIONS = ALL_DISEASE_ENTRIES.map(d => d.name).sort();

// Merge DB diseases into ALL_DISEASE_ENTRIES so added diseases persist in the UI after refresh
const mergeDiseaseEntries = (dbList) => {
  if (!Array.isArray(dbList)) return;
  const known = new Set(ALL_DISEASE_ENTRIES.map(d => (d.dbName || '').toLowerCase()));
  let added = false;
  dbList.forEach(d => {
    const nm = (d.name || '').trim();
    if (!nm) return;
    if (known.has(nm.toLowerCase())) return;
    ALL_DISEASE_ENTRIES.push({
      id: d.id,
      name: nm,
      dbName: nm,
      icon: resolveIcon(d.icon || null),
      color: d.color || '#3B82F6',
      desc: d.description || 'Custom communicable disease',
    });
    known.add(nm.toLowerCase());
    added = true;
  });
  if (added) {
    SORTED_CARD_DBNAMES.length = 0;
    SORTED_CARD_DBNAMES.push(...ALL_DISEASE_ENTRIES.map(d => d.dbName.toLowerCase()).sort((a, b) => b.length - a.length));
    ALL_DISEASE_OPTIONS.length = 0;
    ALL_DISEASE_OPTIONS.push(...ALL_DISEASE_ENTRIES.map(d => d.name).sort());
  }
};

// Merge persisted custom categories into DISEASE_CATEGORIES (call after mergeDiseaseEntries)
const mergeCustomCategories = (categories) => {
  if (!Array.isArray(categories)) return;
  const knownIds = new Set(DISEASE_CATEGORIES.map(c => c.id));
  categories.forEach(cat => {
    const id = 'custom-' + cat.id;
    if (knownIds.has(id)) return;
    const diseases = (cat.diseases || [])
      .map(did => ALL_DISEASE_ENTRIES.find(d => d.id === did))
      .filter(Boolean);
    DISEASE_CATEGORIES.push({
      id,
      name: cat.name,
      icon: resolveIcon(cat.icon || null),
      color: cat.color || '#3B82F6',
      desc: cat.description || 'Custom disease category',
      diseases,
    });
    knownIds.add(id);
  });
};

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

// Safe normalize - never crashes on non-string input
const norm = (s) => {
  if (typeof s !== 'string') return '';
  return s.toLowerCase().replace(/[\s\-().]/g, '');
};

// Maps GeoJSON ADM4_EN values to DB's barangays.name values
const GEOJSON_TO_DB_NAME = {
  'Baclaran': 'Baclaran',
  'Banaybanay': 'Banay-Banay',
  'Banlic': 'Banlic',
  'Butong': 'Butong',
  'Bigaa': 'Bigaa',
  'Casile': 'Casile',
  'Gulod': 'Gulod',
  'Mamatid': 'Mamatid',
  'Marinig': 'Marinig',
  'Niugan': 'Niugan',
  'Pittland': 'Pittland',
  'Pulo': 'Pulo',
  'Sala': 'Sala',
  'San Isidro': 'San Isidro',
  'Diezmo': 'Diezmo',
  'Barangay Uno (Pob.)': 'Barangay Uno (Poblacion)',
  'Barangay Dos (Pob.)': 'Barangay Dos (Poblacion)',
  'Barangay Tres (Pob.)': 'Barangay Tres (Poblacion)',
};

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

  const mabitacMatch = a.match(/\bMABITAC\s+PHASE\s*(\d+)\b/);
  if (mabitacMatch) return `Mabitac Phase ${mabitacMatch[1]}`;

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
  lat: '', lng: ''
};

const CATEGORIES_PER_PAGE = 8;
const DISEASES_PER_PAGE = 12;

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

export default function ManageCases({ caseFilter, setCaseFilter, dateFormat, autoSave, confirmDelete, keyboardShortcuts, fontScale, compactMode, loggedUserId, loggedUser, loginRole, loginBarangay, sessionContext, initialView, onInitialViewConsumed }) {
  const [view, setView] = useState('categories');
  const [inboxItems, setInboxItems] = useState([]);
  const [outboxItems, setOutboxItems] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxSubTab, setInboxSubTab] = useState('referrals');
  const [contactMessages, setContactMessages] = useState([]);
  const [contactMessagesLoading, setContactMessagesLoading] = useState(false);
  const [editRequests, setEditRequests] = useState([]);
  const [editRequestsLoading, setEditRequestsLoading] = useState(false);
  const [passwordRequests, setPasswordRequests] = useState([]);
  const [passwordRequestsLoading, setPasswordRequestsLoading] = useState(false);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [pendingRegistrationsLoading, setPendingRegistrationsLoading] = useState(false);
  const [myEditRequests, setMyEditRequests] = useState([]);
  const [myEditRequestsLoading, setMyEditRequestsLoading] = useState(false);
  const [showEditRequestForm, setShowEditRequestForm] = useState(false);
  const [editRequestNote, setEditRequestNote] = useState('');
  const [editRequestSuccess, setEditRequestSuccess] = useState(null);
  const [addRequests, setAddRequests] = useState([]);
  const [addRequestsLoading, setAddRequestsLoading] = useState(false);
  const [myAddRequests, setMyAddRequests] = useState([]);
  const [myAddRequestsLoading, setMyAddRequestsLoading] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [isBhwReadOnly, setIsBhwReadOnly] = useState(false);
  const [pendingContactMessageId, setPendingContactMessageId] = useState(null);
  const [cardPage, setCardPage] = useState(0);
  const [categoryPage, setCategoryPage] = useState(0);
  const [browseAllCategories, setBrowseAllCategories] = useState(false);
  const [browseAllExclusive, setBrowseAllExclusive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [diseasePage, setDiseasePage] = useState(0);
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [editingCase, setEditingCase] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [routingStep, setRoutingStep] = useState(null);
  const [routingData, setRoutingData] = useState(null);
  const [routingDescription, setRoutingDescription] = useState('');
  const [routingTargetType, setRoutingTargetType] = useState(null);
  const [routingTargetBarangay, setRoutingTargetBarangay] = useState('');
  const [crossUnit, setCrossUnit] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0); // 0 = categories grid, 1 = exclusive diseases, 2 = add disease form
  const [newDiseaseName, setNewDiseaseName] = useState('');
  const [newDiseaseIcon, setNewDiseaseIcon] = useState('🦠');
  const [newDiseaseColor, setNewDiseaseColor] = useState('#3B82F6');
  const [newDiseaseDesc, setNewDiseaseDesc] = useState('');
  const [newDiseaseCategory, setNewDiseaseCategory] = useState('all');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addDiseaseMsg, setAddDiseaseMsg] = useState('');

  const [tipsList, setTipsList] = useState([]);
  const [tipsEditor, setTipsEditor] = useState(null);
  const [tipsSaving, setTipsSaving] = useState(false);
  const [tipsMsg, setTipsMsg] = useState('');
  const [tipsOpen, setTipsOpen] = useState(false);
  const [tipsBackdrop, setTipsBackdrop] = useState(null);

  const [box2DiseaseId, setBox2DiseaseId] = useState('');
  const [box2Tips, setBox2Tips] = useState('');
  const [box2Symptoms, setBox2Symptoms] = useState('');
  const [box2Video, setBox2Video] = useState('');
  const [box2Saving, setBox2Saving] = useState(false);
  const [box2Msg, setBox2Msg] = useState('');
  const [addTipsPrompt, setAddTipsPrompt] = useState(null);
  const [box2DiseaseOpen, setBox2DiseaseOpen] = useState(false);
  const box2DiseaseRef = useRef(null);

  const measureTipsBackdrop = () => {
    const el = document.querySelector('.content-scroller');
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTipsBackdrop({
      position: 'fixed', left: r.left, top: r.top,
      width: r.width, height: r.height,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!tipsOpen) return;
    measureTipsBackdrop();
    const onResize = () => measureTipsBackdrop();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipsOpen]);

  const closeTipsManager = () => {
    setTipsOpen(false);
    setTipsEditor(null);
    setTipsMsg('');
    setTipsList([]);
  };

  const openTipsManager = () => {
    setTipsEditor(null);
    setTipsMsg('');
    setTipsList([]);
    setTipsOpen(true);
    axios.get(`${API_URL}/api/diseases`)
      .then(res => { setTipsList(Array.isArray(res.data) ? res.data : []); })
      .catch(err => setTipsMsg('Error: ' + (err.response?.data?.error || err.message)));
  };

  const openTipsEditor = (d) => {
    const hard = DEFAULT_DISEASES.find(h => h.name === d.name);
    setTipsEditor({
      id: d.id, name: d.name, icon: d.icon || '🦠', color: d.color || '#64748b',
      preventionTips: d.prevention_tips || (hard && Array.isArray(hard.tips) ? hard.tips.join('\n') : ''),
      symptoms: d.symptoms || (hard && Array.isArray(hard.symptoms) ? hard.symptoms.join('\n') : ''),
      videoUrl: d.video_url || (hard && hard.videoUrl ? hard.videoUrl : ''),
    });
    setTipsMsg('');
  };

  const saveTips = async () => {
    if (!tipsEditor) return;
    setTipsSaving(true);
    try {
      await axios.put(`${API_URL}/api/diseases/${tipsEditor.id}`, {
        preventionTips: tipsEditor.preventionTips,
        symptoms: tipsEditor.symptoms,
        videoUrl: tipsEditor.videoUrl,
      }, { headers: { 'x-user-role': 'CHO', 'x-user-id': loggedUserId || '', 'x-user-name': loggedUser || '' } });
      notify('Prevention tips updated successfully!', 'success');
      emitDiseasesChanged();
      setTipsEditor(null);
      openTipsManager();
    } catch (err) {
      setTipsMsg('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setTipsSaving(false);
    }
  };

  // ── BOX 2: Inline Add/Edit Prevention Tips ──
  const loadBox2 = (diseaseId) => {
    const d = allDiseases.find(x => String(x.id) === String(diseaseId));
    if (!d) { setBox2DiseaseId(''); setBox2Tips(''); setBox2Symptoms(''); setBox2Video(''); return; }
    const hard = DEFAULT_DISEASES.find(h => h.name === d.name);
    setBox2DiseaseId(String(d.id));
    setBox2Tips(d.prevention_tips || (hard && Array.isArray(hard.tips) ? hard.tips.join('\n') : ''));
    setBox2Symptoms(d.symptoms || (hard && Array.isArray(hard.symptoms) ? hard.symptoms.join('\n') : ''));
    setBox2Video(d.video_url || (hard && hard.videoUrl ? hard.videoUrl : ''));
    setBox2Msg('');
  };

  const saveBox2Tips = async () => {
    if (!box2DiseaseId) { setBox2Msg('Error: Select a disease first.'); return; }
    setBox2Saving(true);
    try {
      await axios.put(`${API_URL}/api/diseases/${box2DiseaseId}`, {
        preventionTips: box2Tips,
        symptoms: box2Symptoms,
        videoUrl: box2Video,
      }, { headers: { 'x-user-role': 'CHO', 'x-user-id': loggedUserId || '', 'x-user-name': loggedUser || '' } });
      notify('Prevention tips saved!', 'success');
      emitDiseasesChanged();
      setBox2Msg('');
      const dres = await axios.get(API_URL + '/api/diseases');
      setAllDiseases(dres.data);
      setTipsList(dres.data);
      const updated = (dres.data || []).find(x => String(x.id) === String(box2DiseaseId));
      if (updated) { setBox2Tips(updated.prevention_tips || ''); setBox2Symptoms(updated.symptoms || ''); setBox2Video(updated.video_url || ''); }
    } catch (err) {
      setBox2Msg('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setBox2Saving(false);
    }
  };

  const toggleDiseaseActive = async (d) => {
    const next = d.active ? 0 : 1;
    try {
      await axios.patch(`${API_URL}/api/diseases/${d.id}/visibility`, { active: next },
        { headers: { 'x-user-role': 'CHO', 'x-user-id': loggedUserId || '', 'x-user-name': loggedUser || '' } });
      notify(next ? `"${d.name}" is now visible to residents.` : `"${d.name}" hidden from residents.`, 'info');
      emitDiseasesChanged();
      const dres = await axios.get(API_URL + '/api/diseases');
      setTipsList(dres.data);
      setAllDiseases(dres.data);
    } catch (err) {
      notify('Error: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const [allCases, setAllCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [offlineMode, setOfflineMode] = useState(!isOnline());
  const appOnlineRef = useRef(navigator.onLine);
  useEffect(() => { appOnlineRef.current = navigator.onLine; }, []);
  const [barangayList, setBarangayList] = useState([]);
  const [allDiseases, setAllDiseases] = useState([]);
  const choUnitBarangays = sessionContext ? CHO_UNIT_BARANGAYS[sessionContext] || [] : [];
  const scopedBarangayOptions = (loginRole === 'CHO' && sessionContext && CHO_UNIT_BARANGAYS[sessionContext])
    ? CHO_UNIT_BARANGAYS[sessionContext]
    : CABUYAO_BARANGAYS;
  const scopedBarangayList = (loginRole === 'CHO' && scopedBarangayOptions.length > 0)
    ? barangayList.filter(b => scopedBarangayOptions.includes(b.name)).sort((a, b) => a.name.localeCompare(b.name))
    : [...barangayList].sort((a, b) => a.name.localeCompare(b.name));

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
  const [tablePage, setTablePage] = useState(1);
  const [tableEllipsisOpen, setTableEllipsisOpen] = useState(false);
  const [tableEllipsisInput, setTableEllipsisInput] = useState('');
  const tableEllipsisRef = useRef(null);

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

  // Dynamic purok options - merge PUROK_OPTIONS with values already in this BHW's barangay
  const dynamicPurokOptions = React.useMemo(() => {
    const uniqueFromCases = new Set();
    const targetBarangay = loginRole === 'BHW' && loginBarangay
      ? loginBarangay.toLowerCase().replace(/[^a-z\s]/g, '').trim()
      : null;
    allCases.forEach(c => {
      if (!c.address) return;
      const parts = c.address.split('|');
      const purokVal = parts.length > 1 ? parts[1].trim() : null;
      if (!purokVal) return;
      if (targetBarangay) {
        const cb = (c.barangay_name || '').toLowerCase().replace(/[^a-z\s]/g, '').trim();
        if (cb !== targetBarangay) return;
      }
      uniqueFromCases.add(purokVal);
    });
    return [...new Set([...PUROK_OPTIONS, ...uniqueFromCases])].sort();
  }, [allCases, loginRole, loginBarangay]);

  // Purok/Blk/Phase filter dropdown
  const [purokOpen, setPurokOpen] = useState(false);
  const purokRef = useRef(null);

  // Add New Disease category dropdown
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef(null);

  // Form dropdowns
  const [barangayFormOpen, setBarangayFormOpen] = useState(false);
  const [diseaseOpen, setDiseaseOpen] = useState(false);
  const barangayFormRef = useRef(null);
  const diseaseFormRef = useRef(null);

  // Status filter dropdown
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);

  // Form dropdowns: gender, severity, patient status
  const [genderOpen, setGenderOpen] = useState(false);
  const genderRef = useRef(null);
  const [severityOpen, setSeverityOpen] = useState(false);
  const severityRef = useRef(null);
  const [patientStatusOpen, setPatientStatusOpen] = useState(false);
  const patientStatusRef = useRef(null);

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

    const diseaseEntry = findDiseaseEntry(targetDisease);

    if (diseaseEntry) {
      setSelectedDisease(diseaseEntry);
      setSelectedCategory(null);
      setCategoryPage(0);
      setBrowseAllCategories(false);
      setBrowseAllExclusive(false);
      setFilterBarangay(targetBarangay || 'All Barangays');
      if (caseFilter.purok) {
        setFilterPurok(caseFilter.purok);
      }
      setSearchQuery('');
      setFilterStatus('All Status');
      setTablePage(1);
      setView('list');
    }

    // Clear the filter so navigating back works normally
    if (setCaseFilter) setCaseFilter({ disease: '', barangay: '', purok: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseFilter]);

  useEffect(() => {
    if (initialView === 'outbox') {
      setView('outbox');
      if (onInitialViewConsumed) onInitialViewConsumed();
    } else if (initialView && initialView.startsWith('inbox')) {
      setView('inbox');
      const parts = initialView.split(':');
      if (parts[1]) setInboxSubTab(parts[1]);
      if (onInitialViewConsumed) onInitialViewConsumed();
    }
  }, [initialView]);

  useEffect(() => {
    if (editRequestSuccess) {
      const t = setTimeout(() => {
        setView('list');
        setFilterPurok('All Puroks');
        setIsBhwReadOnly(false);
        setEditRequestSuccess(null);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [editRequestSuccess]);

  // Fetch all cases
  const fetchCases = () => {
    setLoadingCases(true);
    if (!appOnlineRef.current) {
      getCachedCases().then(cached => {
        if (cached.length > 0) setAllCases(cached);
        setOfflineMode(true);
        setLoadingCases(false);
      });
      return;
    }
    axios.get(API_URL + '/api/disease_cases?user_id=' + (loggedUserId || ''))
      .then(res => { setAllCases(res.data); setLoadingCases(false); setLastUpdated(Date.now()); cacheCases(res.data).catch(() => {}); })
      .catch(async () => {
        const cached = await getCachedCases();
        if (cached.length > 0) { setAllCases(cached); setOfflineMode(true); }
        setLoadingCases(false);
      });
  };

  useEffect(() => {
    fetchCases();
    const interval = setInterval(() => {
      if (!appOnlineRef.current) return;
      if (view !== 'add' && view !== 'edit') fetchCases();
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for App-level heartbeat online status + post-sync refresh signals
  useEffect(() => {
    const onStatus = (e) => {
      const online = !!e.detail?.online;
      const wasOnline = appOnlineRef.current;
      appOnlineRef.current = online;
      setOfflineMode(!online);
      if (!online && wasOnline) fetchCases();
      if (online && !wasOnline) fetchCases();
    };
    const onSynced = () => {
      appOnlineRef.current = navigator.onLine;
      setOfflineMode(!navigator.onLine);
      fetchCases();
    };
    window.addEventListener('cdms-online-status', onStatus);
    window.addEventListener('cdms-data-synced', onSynced);
    return () => {
      window.removeEventListener('cdms-online-status', onStatus);
      window.removeEventListener('cdms-data-synced', onSynced);
    };
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
      .then(res => { setInboxItems(res.data); setInboxLoading(false); cacheInboxItems(res.data).catch(() => {}); })
      .catch(async () => {
        const cached = await getCachedInboxItems();
        if (cached.length > 0) { setInboxItems(cached); setOfflineMode(true); }
        setInboxLoading(false);
      });
  };

  const fetchContactMessages = () => {
    setContactMessagesLoading(true);
    const params = {};
    if (loginRole === 'CHO') {
      params.choUnit = sessionContext;
    } else if (loginRole === 'BHW' && loginBarangay) {
      params.barangay = loginBarangay;
    }
    axios.get(`${API_URL}/api/contact-messages`, { params })
      .then(res => { setContactMessages(res.data); setContactMessagesLoading(false); cacheContactMessages(res.data).catch(() => {}); })
      .catch(async () => {
        const cached = await getCachedContactMessages();
        if (cached.length > 0) { setContactMessages(cached); setOfflineMode(true); }
        setContactMessagesLoading(false);
      });
  };

  const getChoUnitForBarangay = (barangayName) => {
    const normalized = (barangayName || '').replace(/^Brgy\.\s*/i, '').trim().toLowerCase();
    for (const [unit, list] of Object.entries(CHO_UNIT_BARANGAYS)) {
      if (list.some(b => b.toLowerCase() === normalized)) return unit;
    }
    return null;
  };

  const detectBarangayFromAddressLocal = (address) => {
    const addr = (address || '').trim();
    if (!addr) return null;
    const addrLower = addr.toLowerCase().replace(/[\-\s]/g, '');
    const matched = barangayList.find(b => {
      const bNorm = b.name.replace(/\(.*?\)/g, '').toLowerCase().replace(/[\-\s().]/g, '').trim();
      return addrLower.includes(bNorm);
    });
    if (matched) return matched.name;
    const BARANGAY_ALIASES = { 'bugtong': 'Butong', 'pitland': 'Pittland', 'poblacion1': 'Barangay Uno (Poblacion)', 'poblacion 1': 'Barangay Uno (Poblacion)', 'poblacion2': 'Barangay Dos (Poblacion)', 'poblacion 2': 'Barangay Dos (Poblacion)', 'poblacion3': 'Barangay Tres (Poblacion)', 'poblacion 3': 'Barangay Tres (Poblacion)' };
    for (const [alias, realName] of Object.entries(BARANGAY_ALIASES)) {
      if (addrLower.includes(alias)) return realName;
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
      .then(res => { setOutboxItems(res.data); cacheOutboxItems(res.data).catch(() => {}); })
      .catch(async () => {
        const cached = await getCachedOutboxItems();
        if (cached.length > 0) { setOutboxItems(cached); setOfflineMode(true); }
      });
  };

  const handleAcceptInboxItem = (item) => {
    axios.put(`${API_URL}/api/case-inbox/${item.id}/accept`)
      .then(res => {
        const caseId = res.data.case_id;
        const diseaseEntry = findDiseaseEntry(item.disease_name);
        if (diseaseEntry) { setSelectedDisease(diseaseEntry); setSelectedCategory(null); setCategoryPage(0); }
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
      .catch(err => notify('Accept failed: ' + (err.response?.data?.error || err.message), 'error'));
  };

  const performAddRequestSubmit = async (pendingPayload) => {
    const ownedUnit = sessionContext || getChoUnitForBarangay(loginBarangay);
    const detectedName = detectBarangayFromAddressLocal(pendingPayload.address);
    const selectedName = barangayList.find(b => String(b.id) === String(pendingPayload.barangay_id))?.name || null;
    const targetUnit = getChoUnitForBarangay(selectedName) || getChoUnitForBarangay(detectedName) || ownedUnit;
    try {
      await axios.post(`${API_URL}/api/cases/request-add`, {
        ...pendingPayload,
        requested_by: loggedUserId,
        requested_by_name: loggedUser || 'Unknown BHW',
        submitter_cho_unit: sessionContext || null,
        from_barangay_name: loginBarangay || null,
      });
      if (pendingContactMessageId) {
        await axios.put(`${API_URL}/api/contact-messages/${pendingContactMessageId}/accept`).catch(() => {});
        setPendingContactMessageId(null);
        fetchOutbox();
      }
      const routedMsg = ownedUnit && targetUnit && targetUnit !== ownedUnit
        ? `Case submitted to ${targetUnit} for approval!`
        : 'Case submitted to your CHO for approval!';
      setSubmitMsg(routedMsg);
      notify(routedMsg, 'success');
      await fetchCases();
      const diseaseEntry = findDiseaseEntry(formData.diseaseType);
      if (diseaseEntry) { setSelectedDisease(diseaseEntry); setSelectedCategory(null); setCategoryPage(0); }
      setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1200);
    } catch (err) {
      setSubmitLoading(false);
      if (!err.response) {
        await enqueueOperation({
          type: 'add_request',
          endpoint: '/api/cases/request-add',
          method: 'POST',
          payload: {
            ...pendingPayload, case_id: 'temp-' + Date.now(),
            requested_by: loggedUserId,
            requested_by_name: loggedUser || 'Unknown BHW',
            from_barangay_name: loginBarangay,
            submitter_cho_unit: sessionContext,
            note: '',
          },
          userId: loggedUserId,
          userName: loggedUser,
        });
        setSubmitMsg('Case submitted to CHO for approval (offline) - will sync when reconnected.');
        notify('Submitted to CHO for approval. Will sync when reconnected.', 'info');
        setOfflineMode(true);
        setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1800);
      } else {
        const errMsg = 'Submit failed: ' + (err.response?.data?.error || err.message);
        setSubmitMsg(errMsg);
        notify(errMsg, 'error');
      }
    } finally {
      setCrossUnit(null);
    }
  };

  const handlePendingContactMessage = (msg) => {
    axios.put(`${API_URL}/api/contact-messages/${msg.id}/pending`)
      .then(() => {
        setPendingContactMessageId(msg.id);
        setFormData({
          patientName: msg.name,
          diseaseType: msg.disease_name || '',
          age: msg.age || '',
          severity: 'Mild',
          gender: msg.gender || 'Male',
          contact: msg.contact_no || '',
          onsetDate: '',
          address: msg.address || '',
          barangayId: '',
          barangayName: '',
          symptoms: msg.message || '',
          physician: '',
          lat: '',
          lng: '',
          purok: '',
          status: 'Active',
        });
        setView('add');
      })
      .catch(err => notify('Failed to mark message pending: ' + (err.response?.data?.error || err.message), 'error'));
  };

  const handleRejectContactMessage = (msg) => {
    if (!window.confirm(`Reject message from ${msg.name}?`)) return;
    axios.put(`${API_URL}/api/contact-messages/${msg.id}/reject`)
      .then(() => {
        fetchContactMessages();
        fetchOutbox();
      })
      .catch(err => notify('Failed to reject message: ' + (err.response?.data?.error || err.message), 'error'));
  };

  const handleMessageToCase = (msg) => {
    axios.put(`${API_URL}/api/contact-messages/${msg.id}/accept`)
      .then(res => {
        const caseId = res.data.case_id;
        const diseaseEntry = findDiseaseEntry(msg.disease_name);
        if (diseaseEntry) { setSelectedDisease(diseaseEntry); setSelectedCategory(null); setCategoryPage(0); }
        fetchCases();
        fetchContactMessages();
        openEdit({
          case_id: caseId,
          patient_name: msg.name,
          disease_name: msg.disease_name || '',
          age: msg.age || '',
          severity: 'Mild',
          gender: msg.gender || 'Male',
          status: 'Active',
          contact: msg.contact_no || '',
          onset_date: null,
          address: msg.address || '',
          barangay_name: '',
          symptoms: msg.message || '',
          physician: '',
          latitude: null,
          longitude: null,
        });
      })
      .catch(err => notify('Failed to add case: ' + (err.response?.data?.error || err.message), 'error'));
  };

  // ── BHW's OWN EDIT REQUESTS (for BHW Referrals tab) ──
  const fetchMyEditRequests = () => {
    if (loginRole !== 'BHW' || !loggedUserId) return;
    setMyEditRequestsLoading(true);
    axios.get(`${API_URL}/api/case-edit-requests?requested_by=${loggedUserId}&unread_only=true`)
      .then(res => { setMyEditRequests(res.data); setMyEditRequestsLoading(false); cacheEditRequests(res.data).catch(() => {}); })
      .catch(async () => {
        const cached = await getCachedEditRequests();
        if (cached.length > 0) { setMyEditRequests(cached); setOfflineMode(true); }
        setMyEditRequestsLoading(false);
      });
  };

  // ── ADD REQUESTS (BHW submits case → CHO approval) ──
  const fetchAddRequests = () => {
    if (loginRole === 'BHW') {
      setMyAddRequestsLoading(true);
      axios.get(`${API_URL}/api/case-add-requests?requested_by=${loggedUserId}&unread_only=true`)
        .then(res => { setMyAddRequests(res.data || []); setMyAddRequestsLoading(false); })
        .catch(() => setMyAddRequestsLoading(false));
    } else {
      setAddRequestsLoading(true);
      axios.get(`${API_URL}/api/case-add-requests?cho_unit=${sessionContext || ''}`)
        .then(res => { setAddRequests(res.data || []); setAddRequestsLoading(false); })
        .catch(() => setAddRequestsLoading(false));
    }
  };

  // ── EDIT REQUESTS (BHW → CHO) ──
  const fetchEditRequests = () => {
    setEditRequestsLoading(true);
    const params = {};
    if (loginRole === 'CHO' && sessionContext) {
      params.cho_unit = sessionContext;
    }
    axios.get(`${API_URL}/api/case-edit-requests`, { params })
      .then(res => { 
        setEditRequests(res.data); 
        setEditRequestsLoading(false); 
        cacheEditRequests(res.data).catch(() => {});
      })
      .catch(async (err) => { 
        console.error('[fetchEditRequests] error:', err);
        const cached = await getCachedEditRequests();
        if (cached.length > 0) { setEditRequests(cached); setOfflineMode(true); }
        setEditRequestsLoading(false); 
      });
  };

  // ── PASSWORD CHANGE REQUESTS (BHW → CHO) ──
  const fetchPasswordRequests = () => {
    setPasswordRequestsLoading(true);
    axios.get(`${API_URL}/api/password-change-requests?pending_only=true`)
      .then(res => { setPasswordRequests(res.data || []); setPasswordRequestsLoading(false); })
      .catch(() => { setPasswordRequestsLoading(false); });
  };

  // ── PENDING REGISTRATIONS (BHW → CHO approval) ──
  const fetchPendingRegistrations = () => {
    setPendingRegistrationsLoading(true);
    const params = {};
    if (loginRole === 'CHO' && sessionContext) params.cho_unit = sessionContext;
    axios.get(`${API_URL}/api/pending-registrations`, { params })
      .then(res => { setPendingRegistrations(res.data); setPendingRegistrationsLoading(false); cachePendingRegistrations(res.data).catch(() => {}); })
      .catch(async () => {
        const cached = await getCachedPendingRegistrations();
        if (cached.length > 0) { setPendingRegistrations(cached); setOfflineMode(true); }
        setPendingRegistrationsLoading(false);
      });
  };

  const handleApproveRegistration = (reg) => {
    axios.put(`${API_URL}/api/pending-registrations/${reg.user_id}/approve`, { actor_id: loggedUserId })
      .then(() => { fetchPendingRegistrations(); })
      .catch(err => notify('Approve failed: ' + (err.response?.data?.error || err.message), 'error'));
  };

  const handleRejectRegistration = (reg) => {
    const reason = window.prompt(`Reject registration for ${reg.full_name}? Enter optional reason (or leave blank):`);
    if (reason === null) return; // user cancelled
    axios.put(`${API_URL}/api/pending-registrations/${reg.user_id}/reject`, { reason, actor_id: loggedUserId })
      .then(() => { fetchPendingRegistrations(); })
      .catch(err => notify('Reject failed: ' + (err.response?.data?.error || err.message), 'error'));
  };

  const handleSendEditRequest = async () => {
    if (!editRequestNote.trim() || !editingCase) return;
    const targetCho = loginBarangay ? getChoUnitForBarangay(loginBarangay) : sessionContext;
    const editPayload = {
      requested_by: loggedUserId,
      requested_by_name: loggedUser,
      from_barangay_name: loginBarangay,
      target_cho_unit: targetCho,
      note: editRequestNote.trim(),
      proposed_data: {
        patient_name: formData.patientName,
        disease_name: formData.diseaseType,
        age: formData.age,
        severity: formData.severity,
        gender: formData.gender,
        status: formData.status,
        contact: formData.contact,
        onset_date: formData.onsetDate,
        address: formData.address,
        purok: formData.purok,
        barangay_id: formData.barangayId,
        symptoms: formData.symptoms,
        physician: formData.physician,
        latitude: formData.lat,
        longitude: formData.lng,
      },
    };
    if (!isOnline()) {
      try {
        await enqueueOperation({
          type: 'edit-request',
          endpoint: `/api/cases/${editingCase.case_id}/request-edit`,
          method: 'POST',
          payload: editPayload,
          userId: loggedUserId,
          userName: loggedUser,
        });
        setEditRequestSuccess(loggedUser);
        setShowEditRequestForm(false);
        setEditRequestNote('');
      } catch (err) {
        notify('Failed to queue edit request: ' + err.message, 'error');
      }
      return;
    }
    try {
      await axios.post(`${API_URL}/api/cases/${editingCase.case_id}/request-edit`, editPayload);
      setEditRequestSuccess(loggedUser);
      setShowEditRequestForm(false);
      setEditRequestNote('');
    } catch (err) {
      if (!err.response) {
        try {
          await enqueueOperation({
            type: 'edit-request',
            endpoint: `/api/cases/${editingCase.case_id}/request-edit`,
            method: 'POST',
            payload: editPayload,
            userId: loggedUserId,
            userName: loggedUser,
          });
          setEditRequestSuccess(loggedUser);
          setShowEditRequestForm(false);
          setEditRequestNote('');
        } catch (queueErr) {
          notify('Failed to queue edit request: ' + queueErr.message, 'error');
        }
        return;
      }
      notify('Failed to send edit request: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleAcceptEditRequest = (req) => {
    axios.put(`${API_URL}/api/case-edit-requests/${req.id}/accept`)
      .then(res => {
        const caseId = res.data.case_id;
        fetchEditRequests();
        fetchCases();
        const proposed = res.data.proposed_data || null;
        const c = allCases.find(x => x.case_id === caseId);
        if (c) {
          openEdit({
            case_id: c.case_id,
            patient_name: (proposed && proposed.patient_name) || c.patient_name,
            disease_name: (proposed && proposed.disease_name) || c.disease_name,
            age: (proposed && proposed.age) || c.age,
            severity: (proposed && proposed.severity) || c.severity,
            gender: (proposed && proposed.gender) || c.gender,
            status: (proposed && proposed.status) || c.status,
            contact: (proposed && proposed.contact) || c.contact,
            onset_date: (proposed && proposed.onset_date) || c.onset_date,
            address: (proposed && proposed.address) || c.address,
            purok: (proposed && proposed.purok) || '',
            barangay_name: c.barangay_name || '',
            symptoms: (proposed && proposed.symptoms) || c.symptoms,
            physician: (proposed && proposed.physician) || c.physician,
            latitude: (proposed && proposed.latitude) || c.latitude,
            longitude: (proposed && proposed.longitude) || c.longitude,
          });
        } else {
          notify('Case found, but data not loaded yet. Please refresh.', 'error');
        }
      })
      .catch(err => notify('Failed to accept edit request: ' + (err.response?.data?.error || err.message), 'error'));
  };

  const handleRejectEditRequest = (req) => {
    axios.put(`${API_URL}/api/case-edit-requests/${req.id}/reject`)
      .then(() => fetchEditRequests())
      .catch(err => notify('Failed to reject edit request: ' + (err.response?.data?.error || err.message), 'error'));
  };

  // ── ADD REQUEST APPROVAL (CHO reviews a BHW-submitted case) ──
  const openApprovalReview = (req) => {
    setApprovalRequest(req);
    setShowEditRequestForm(false);
    setEditingCase(null);
    setIsBhwReadOnly(false);
    const brgy = barangayList.find(b => b.id === req.barangay_id);
    let parsedAddress = req.address || '';
    let parsedPurok = '';
    if (parsedAddress.includes('|')) {
      const [addrPart, purokPart] = parsedAddress.split('|');
      parsedAddress = addrPart.trim();
      parsedPurok = (purokPart || '').trim();
    }
    setFormData({
      patientName: req.patient_name || '',
      diseaseType: req.disease_name || '',
      age: req.age || '',
      severity: req.severity || 'Moderate',
      gender: req.gender || 'Male',
      status: req.case_status || 'Active',
      contact: req.contact || '',
      onsetDate: req.onset_date ? String(req.onset_date).slice(0, 10) : '',
      address: parsedAddress,
      purok: parsedPurok,
      barangayId: brgy ? brgy.id : (req.barangay_id || ''),
      symptoms: req.symptoms || '',
      physician: req.physician || '',
      lat: req.latitude || '',
      lng: req.longitude || '',
    });
    setFormErrors({});
    setView('add');
  };

  const closeApprovalReview = () => {
    setApprovalRequest(null);
    setView('inbox');
    setInboxSubTab('add-requests');
  };

  const handleRejectAddRequest = (req) => {
    const reason = (window.prompt('Reason for rejection (shown to the BHW):', '') || '').trim();
    axios.put(`${API_URL}/api/case-add-requests/${req.id}/reject`, {
      reason: reason || null,
      actor_id: loggedUserId,
      actor_name: loggedUser || 'CHO',
      actor_role: loginRole || 'CHO',
    })
      .then(() => { fetchAddRequests(); })
      .catch(err => notify('Failed to reject add request: ' + (err.response?.data?.error || err.message), 'error'));
  };

  // ── PASSWORD REQUEST HANDLERS ──
  const handleAcceptPasswordRequest = (req) => {
    axios.put(`${API_URL}/api/password-change-requests/${req.id}/accept`)
      .then(() => { fetchPasswordRequests(); })
      .catch(err => notify('Failed to accept request: ' + (err.response?.data?.error || err.message), 'error'));
  };
  const handleRejectPasswordRequest = (req) => {
    axios.put(`${API_URL}/api/password-change-requests/${req.id}/reject`)
      .then(() => { fetchPasswordRequests(); })
      .catch(err => notify('Failed to reject request: ' + (err.response?.data?.error || err.message), 'error'));
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

  const handleRoutingCancelDescription = () => {
    setRoutingStep('confirm');
  };

  const handleRoutingSend = async () => {
    if (!routingData) return;
    const { targetUnit, payload } = routingData;
    setSubmitLoading(true);
    try {
      await axios.post(`${API_URL}/api/cases/route-to-inbox`, {
        ...payload,
        submitter_user_id: loggedUserId || null,
        submitter_name: loggedUser || 'Unknown',
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
      .catch(err => notify('Reject failed: ' + (err.response?.data?.error || err.message), 'error'));
  };

  useEffect(() => {
    if (view === 'inbox') {
      fetchInbox();
      fetchContactMessages();
      fetchEditRequests();
      fetchAddRequests();
      if (loginRole === 'CHO') { fetchPendingRegistrations(); fetchPasswordRequests(); }
      if (loginRole === 'BHW') fetchMyEditRequests();
    }
    if (view === 'outbox') fetchOutbox();
  }, [view, sessionContext]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    axios.get(API_URL + '/api/barangays')
      .then(res => { setBarangayList(res.data); cacheBarangays(res.data).catch(() => {}); })
      .catch(async () => {
        const cached = await getCachedBarangays();
        if (cached.length > 0) setBarangayList(cached);
      });
    axios.get(API_URL + '/api/diseases')
      .then(async res => {
        mergeDiseaseEntries(res.data);
        setAllDiseases(res.data);
        cacheDiseases(res.data).catch(() => {});
        try {
          const cres = await axios.get(API_URL + '/api/disease_categories');
          mergeCustomCategories(cres.data);
        } catch (e) { /* categories unavailable offline - skip */ }
      })
      .catch(async () => {
        const cached = await getCachedDiseases();
        if (cached.length > 0) {
          mergeDiseaseEntries(cached);
          setAllDiseases(cached);
        }
        try {
          const cres = await axios.get(API_URL + '/api/disease_categories');
          mergeCustomCategories(cres.data);
        } catch (e) { /* categories unavailable offline - skip */ }
      });
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
      if (categoryRef.current && !categoryRef.current.contains(e.target)) {
        setCategoryOpen(false);
      }
      if (barangayFormRef.current && !barangayFormRef.current.contains(e.target)) setBarangayFormOpen(false);
      if (diseaseFormRef.current && !diseaseFormRef.current.contains(e.target)) setDiseaseOpen(false);
      if (statusRef.current && !statusRef.current.contains(e.target)) {
        setStatusOpen(false);
      }
      if (genderRef.current && !genderRef.current.contains(e.target)) {
        setGenderOpen(false);
      }
      if (severityRef.current && !severityRef.current.contains(e.target)) {
        setSeverityOpen(false);
      }
      if (patientStatusRef.current && !patientStatusRef.current.contains(e.target)) {
        setPatientStatusOpen(false);
      }
      if (lookupDropdownRef.current && !lookupDropdownRef.current.contains(e.target)) {
        setShowLookupDropdown(false);
      }
      if (box2DiseaseRef.current && !box2DiseaseRef.current.contains(e.target)) {
        setBox2DiseaseOpen(false);
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
        if (view === 'add' || view === 'edit') { setApprovalRequest(null); setView('list'); setFilterPurok('All Puroks'); }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        const form = document.querySelector('#case-form');
        if (form) form.requestSubmit();
      }

      if ((view === 'list' || view === 'categories') && (e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
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
        .catch(async () => {
          try {
            const cached = await getCachedCases();
            const nameLower = name.toLowerCase();
            const results = cached.filter(c => (c.patient_name || '').toLowerCase().includes(nameLower));
            const unique = results.filter((r, i, arr) => arr.findIndex(x => x.patient_name === r.patient_name) === i);
            setPatientLookupResults(unique);
            if (unique.length === 1) {
              applyPatientAutoFill(unique[0]);
              setShowLookupDropdown(false);
            } else if (unique.length > 1) {
              setShowLookupDropdown(true);
            } else {
              setShowLookupDropdown(false);
            }
          } catch {
            setPatientLookupResults([]);
            setShowLookupDropdown(false);
          }
          setLookupLoading(false);
        });
    }, 300);

    return () => {
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.patientName]);

  // ── Match cases to disease entry (prefix matching) ──
  const matchesCard = (caseItem, entry) => {
    if (!caseItem.disease_name) return false;
    return caseItem.disease_name.toLowerCase().startsWith(entry.dbName.toLowerCase());
  };

  const getCaseCount = (cardOrCategory) => {
    if (!cardOrCategory) return 0;
    if (cardOrCategory.diseases) {
      // It's a category - sum counts across diseases
      return cardOrCategory.diseases.reduce((sum, d) => {
        return sum + baseCases.filter(c => matchesCard(c, d)).length;
      }, 0);
    }
    // It's a single disease entry
    return baseCases.filter(c => matchesCard(c, cardOrCategory)).length;
  };

  // ── Filter cases for list ──
  const getFilteredCases = () => {
    let result = selectedDisease
      ? baseCases.filter(c => matchesCard(c, selectedDisease))
      : baseCases;

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
      const normalize = (s) => (s || '').toUpperCase().replace(/[.\-\s]/g, '');
      const target = normalize(filterPurok);
      const comps = [...filterPurok.matchAll(/(Purok|Blk|Lot|Phase)\s+(\d+[A-Z]?)/gi)];

      result = result.filter(c => {
        const addr = c.address || '';
        const parts = addr.split('|');
        const purokPart = parts.length > 1 ? parts[1] : '';
        const purokPartNormalized = normalize(purokPart);

        // Exact match against the stored purok segment (handles "SouthVille 1A" and similar names)
        if (purokPartNormalized === target) return true;

        // Structured Purok/Blk/Lot/Phase component match (handles "Purok 2", "Blk 1 Lot 6", etc.)
        if (comps.length > 0) {
          const fullAddrUpper = addr.toUpperCase();
          return comps.every(([, type, num]) => {
            const reStr = type === 'Purok' ? `(?:PUROK|PRK)\\.?[\\s-]*${num}(?!\\d)` :
                          type === 'Blk'   ? `(?:BLK|BLOCK|B)\\.?[\\s-]*${num}(?!\\d)` :
                          type === 'Lot'   ? `(?:LOT|L)\\.?[\\s-]*${num}(?!\\d)` :
                          `(?:PHASE|PH)\\.?[\\s-]*${num}(?!\\d)`;
            return new RegExp(reStr).test(fullAddrUpper);
          });
        }

        // Fallback: plain substring match anywhere in the full address
        return normalize(addr).includes(target);
      });
    }
    return result;
  };

  const filteredCases = getFilteredCases();
  const totalTablePages = Math.ceil(filteredCases.length / CASES_PER_PAGE);
  const paginatedCases = filteredCases.slice(
    (tablePage - 1) * CASES_PER_PAGE,
    tablePage * CASES_PER_PAGE
  );

  const getVisiblePages = (cur, total) => {
    if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
    let start = 1 + 9 * Math.floor((cur - 1) / 9);
    start = Math.max(1, Math.min(start, total - 8));
    const end = Math.min(total, start + 8);
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total) pages.push('...');
    return pages;
  };

  useEffect(() => {
    if (!tableEllipsisOpen) return;
    const handler = (e) => { if (tableEllipsisRef.current && !tableEllipsisRef.current.contains(e.target)) setTableEllipsisOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tableEllipsisOpen]);

  const getStatusStyle = (status) => {
    if (status === 'Active') return { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' };
    if (status === 'Pending') return { background: 'rgba(37,99,235,0.15)', color: '#3B82F6' };
    if (status === 'Under Treatment') return { background: 'rgba(124,58,237,0.15)', color: '#a78bfa' };
    if (status === 'Recovered') return { background: 'rgba(18,153,104,0.15)', color: '#3cb882' };
    if (status === 'Deceased') return { background: 'rgba(220,38,38,0.15)', color: '#f87171' };
    if (status === 'Draft') return { background: 'var(--input-bg)', color: 'var(--text-muted)' };
    return { background: 'var(--input-bg)', color: 'var(--text-muted)' };
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
      <h2>CDMS - ${selectedDisease?.name || 'Cases'} Export</h2>
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
  // Queue an offline delete and remove the case from the local list + cache immediately
  const handleOfflineDelete = async (caseId) => {
    const cid = String(caseId);
    if (cid.startsWith('temp-')) {
      await removePendingCreatesByCaseId(caseId);
    } else {
      await enqueueOperation({
        type: 'delete',
        endpoint: `/api/cases/${caseId}`,
        method: 'DELETE',
        payload: { _offlineUserId: loggedUserId, _offlineUserName: loggedUser },
        userId: loggedUserId,
        userName: loggedUser,
      });
    }
    setAllCases(prev => prev.filter(c => String(c.case_id) !== cid));
    await removeCachedCase(caseId);
    setOfflineMode(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (!isOnline() || !appOnlineRef.current) {
        await handleOfflineDelete(deleteTarget.case_id);
        setDeleteTarget(null);
        return;
      }
      await axios.delete(`${API_URL}/api/cases/${deleteTarget.case_id}`);
      fetchCases();
      setDeleteTarget(null);
      notify('Case deleted successfully!', 'success');
    } catch (err) {
      notify('Delete failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── OPEN EDIT ──
  const openEdit = (caseItem) => {
    setIsBhwReadOnly(loginRole === 'BHW');
    setShowEditRequestForm(false);
    setEditRequestNote('');
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

    // Fetch status history for this case
    setStatusHistory([]);
    axios.get(`${API_URL}/api/cases/${caseItem.case_id}/status-history`)
      .then(res => { if (Array.isArray(res.data)) setStatusHistory(res.data); })
      .catch(() => {});

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
      diseaseType: selectedDisease?.name || '',
    });
    setEditingCase(null);
    setFormErrors({});
    setView('add');
  };

  // ── DISEASE CAROUSEL ──
  const changeCarousel = (dir) => setCarouselIndex(prev => (prev + dir + 3) % 3);

  const handleAddNewDisease = async () => {
    if (!newDiseaseName.trim()) {
      setAddDiseaseMsg('Error: Disease name is required.');
      return;
    }
    if (newDiseaseCategory === '__new__' && !newCategoryName.trim()) {
      setAddDiseaseMsg('Error: New category name is required.');
      return;
    }
    try {
      const res = await axios.post(API_URL + '/api/diseases', {
        name: newDiseaseName.trim(),
        icon: newDiseaseIcon || '🦠',
        color: newDiseaseColor,
        description: newDiseaseDesc,
      });
      const entry = {
        id: res.data.id,
        name: newDiseaseName.trim(),
        dbName: newDiseaseName.trim(),
        icon: resolveIcon(newDiseaseIcon),
        color: newDiseaseColor,
        desc: newDiseaseDesc,
      };
      ALL_DISEASE_ENTRIES.push(entry);
      if (newDiseaseCategory && newDiseaseCategory !== 'all') {
        if (newDiseaseCategory === '__new__') {
          try {
            const cres = await axios.post(API_URL + '/api/disease_categories', {
              name: newCategoryName.trim(),
              icon: newDiseaseIcon || '📁',
              color: newDiseaseColor,
              description: newDiseaseDesc,
              diseaseIds: [res.data.id],
            });
            DISEASE_CATEGORIES.push({
              id: 'custom-' + cres.data.id,
              name: newCategoryName.trim(),
              icon: resolveIcon(newDiseaseIcon),
              color: newDiseaseColor,
              desc: newDiseaseDesc,
              diseases: [entry],
            });
          } catch (catErr) {
            console.error('Category creation failed:', catErr.message);
          }
        } else {
          const cat = DISEASE_CATEGORIES.find(c => c.id === newDiseaseCategory);
          if (cat) cat.diseases.push(entry);
        }
      }
      ALL_DISEASE_OPTIONS.length = 0;
      ALL_DISEASE_OPTIONS.push(...ALL_DISEASE_ENTRIES.map(d => d.name).sort());
      setAddDiseaseMsg('✅ Disease added successfully!');
      const addedName = newDiseaseName.trim();
      setNewDiseaseName('');
      setNewDiseaseDesc('');
      setNewDiseaseIcon('🦠');
      setNewDiseaseColor('#3B82F6');
      setNewDiseaseCategory('all');
      setNewCategoryName('');
      const dres = await axios.get(API_URL + '/api/diseases');
      setAllDiseases(dres.data);
      setTipsList(dres.data);
      cacheDiseases(dres.data).catch(() => {});
      notify('Disease added!', 'success');
      emitDiseasesChanged();
      const added = (dres.data || []).find(d => d.name === addedName);
      setAddTipsPrompt(added ? { id: added.id, name: added.name } : { id: null, name: addedName });
      setCarouselIndex(2);
      setAddDiseaseMsg('');
    } catch (err) {
      setAddDiseaseMsg('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  // ── SAVE CASE (Add or Edit) ──
  // Apply an offline-queued create/edit to the local list + IndexedDB so it's visible immediately
  const applyLocalOfflineCase = async (op, existing) => {
    const payload = op.payload || {};
    const brgy = barangayList.find(b => b.id === payload.barangay_id);
    if (op.type === 'create') {
      const localCase = {
        case_id: payload.case_id,
        patient_name: payload.patient_name,
        disease_name: payload.disease_name,
        age: payload.age,
        gender: payload.gender,
        severity: payload.severity,
        status: payload.status,
        contact: payload.contact,
        onset_date: payload.onset_date,
        address: payload.address,
        barangay_id: payload.barangay_id,
        barangay_name: brgy?.name || payload.barangay_name || '',
        symptoms: payload.symptoms,
        physician: payload.physician,
        latitude: payload.latitude,
        longitude: payload.longitude,
        user_id: payload.user_id,
        date_reported: new Date().toISOString(),
        _pendingSync: true,
      };
      setAllCases(prev => [localCase, ...prev]);
      await upsertCachedCase(localCase);
    } else if (op.type === 'edit' && existing) {
      const updated = {
        ...existing,
        patient_name: payload.patient_name,
        disease_name: payload.disease_name,
        age: payload.age,
        gender: payload.gender,
        severity: payload.severity,
        status: payload.status,
        contact: payload.contact,
        onset_date: payload.onset_date,
        address: payload.address,
        barangay_id: payload.barangay_id,
        barangay_name: brgy?.name || existing.barangay_name || '',
        symptoms: payload.symptoms,
        physician: payload.physician,
        latitude: payload.latitude,
        longitude: payload.longitude,
        user_id: payload.user_id,
        _pendingSync: true,
      };
      setAllCases(prev => prev.map(c => String(c.case_id) === String(existing.case_id) ? updated : c));
      await upsertCachedCase(updated);
    }
  };

  const handleSave = async (e, isDraft = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (submitLoading) return;
    setSubmitLoading(true);
    setSubmitMsg('');

    if (!formData.barangayId) {
      setFormErrors({ barangayId: true });
      setSubmitMsg('Error: Please select an assigned barangay.');
      setSubmitLoading(false);
      return;
    }

    if (!isDraft) {
      const errors = {};
      if (!formData.patientName.trim()) errors.patientName = true;
      if (!formData.diseaseType) errors.diseaseType = true;
      if (!formData.age) errors.age = true;
      else {
        const ageNum = Number(formData.age);
        if (isNaN(ageNum) || ageNum < 0 || ageNum > 130) errors.age = true;
      }
      if (!formData.contact.trim()) errors.contact = true;
      else {
        const phoneClean = formData.contact.replace(/[\s\-()]/g, '');
        if (!/^(09\d{9}|\+639\d{9}|639\d{9})$/.test(phoneClean)) errors.contact = true;
      }
      if (!formData.address.trim()) errors.address = true;
      if (!formData.onsetDate) errors.onsetDate = true;
      else {
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        if (new Date(formData.onsetDate).getTime() > todayEnd.getTime()) errors.onsetDate = true;
      }
      if (!formData.physician.trim()) errors.physician = true;
      if (!formData.symptoms.trim()) errors.symptoms = true;
      if (!formData.lat || !formData.lng) errors.location = true;
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        const msgs = [];
        if (errors.age) msgs.push('Age must be 0–130');
        if (errors.contact) msgs.push('Use valid PH phone (e.g., 09123456789)');
        if (errors.onsetDate) msgs.push('Onset date cannot be in the future');
        setSubmitMsg(msgs.length > 0 ? `Error: ${msgs.join('. ')}.` : 'Error: Please fill in all required fields highlighted in red.');
        setSubmitLoading(false);
        return;
      }
    }
    setFormErrors({});

    let diseaseNameToSave = formData.diseaseType;
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

    // CHO reviewing an add request → this submit is the final approval
    if (approvalRequest) {
      try {
        if (!isOnline() || !appOnlineRef.current) {
          setSubmitMsg('Error: approving an add request requires a connection.');
          notify('You are offline. Reconnect to approve add requests.', 'error');
          setSubmitLoading(false);
          return;
        }
        await axios.put(`${API_URL}/api/case-add-requests/${approvalRequest.id}/approve`, {
          ...payload,
          actor_id: loggedUserId,
          actor_name: loggedUser || 'CHO',
          actor_role: loginRole || 'CHO',
        });
        setSubmitMsg('Add request approved - case added to records!');
        notify('Add request approved!', 'success');
        setApprovalRequest(null);
        await fetchCases();
        fetchAddRequests();
        setTimeout(() => { setView('inbox'); setSubmitMsg(''); setSubmitLoading(false); setInboxSubTab('add-requests'); }, 1200);
        return;
      } catch (errApproval) {
        setSubmitMsg('Error: ' + (errApproval.response?.data?.error || errApproval.message));
        notify('Approval failed: ' + (errApproval.response?.data?.error || errApproval.message), 'error');
        setSubmitLoading(false);
        return;
      }
    }

    try {
      if (!isOnline() || !appOnlineRef.current) {
        const tempId = 'temp-' + Date.now();
        if (editingCase) {
          const op = {
            type: 'edit',
            endpoint: `/api/cases/${editingCase.case_id}`,
            method: 'PUT',
            payload,
            userId: loggedUserId,
            userName: loggedUser,
          };
          await enqueueOperation(op);
          await applyLocalOfflineCase(op, editingCase);
          setSubmitMsg('Case saved offline - will sync when reconnected.');
          notify('Case saved offline - will sync when reconnected.', 'info');
        } else if (loginRole === 'BHW' && !isDraft) {
          const op = {
            type: 'add_request',
            endpoint: '/api/cases/request-add',
            method: 'POST',
            payload: {
              ...payload, case_id: tempId,
              requested_by: loggedUserId,
              requested_by_name: loggedUser || 'Unknown BHW',
              from_barangay_name: loginBarangay,
              submitter_cho_unit: sessionContext,
              note: '',
            },
            userId: loggedUserId,
            userName: loggedUser,
          };
          await enqueueOperation(op);
          setSubmitMsg('Case submitted to CHO for approval (offline) - will sync when reconnected.');
          notify('Submitted to CHO for approval. Will sync when reconnected.', 'info');
        } else {
          const op = {
            type: 'create',
            endpoint: '/api/cases',
            method: 'POST',
            payload: { ...payload, case_id: tempId },
            userId: loggedUserId,
            userName: loggedUser,
          };
          await enqueueOperation(op);
          await applyLocalOfflineCase(op);
          setSubmitMsg(isDraft ? 'Draft saved offline - will sync when reconnected.' : 'Case saved offline - will sync when reconnected.');
          notify(isDraft ? 'Draft saved offline - will sync when reconnected.' : 'Case saved offline - will sync when reconnected.', 'info');
        }
        setOfflineMode(true);
        setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1800);
        return;
      }

      if (editingCase) {
        await axios.put(`${API_URL}/api/cases/${editingCase.case_id}`, payload);
        setSubmitMsg('Case updated successfully!');
        notify('Case updated successfully!', 'success');
      } else if (loginRole === 'BHW' && !isDraft) {
        // BHW adds now go through CHO approval (leader requirement)
        // Cross-unit: confirm when the address belongs to another CHO unit's barangay
        const ownedUnit = sessionContext || getChoUnitForBarangay(loginBarangay);
        const detectedName = detectBarangayFromAddressLocal(payload.address);
        const selectedName = barangayList.find(b => String(b.id) === String(payload.barangay_id))?.name || null;
        const targetUnit = getChoUnitForBarangay(selectedName) || getChoUnitForBarangay(detectedName) || ownedUnit;
        const routeBrgy = selectedName || detectedName;
        if (ownedUnit && targetUnit && targetUnit !== ownedUnit) {
          // In-page confirm box instead of a native alert
          setCrossUnit({ routeBrgy, targetUnit, payload });
          setSubmitLoading(false);
          return;
        }
        await axios.post(`${API_URL}/api/cases/request-add`, {
          ...payload,
          requested_by: loggedUserId,
          requested_by_name: loggedUser || 'Unknown BHW',
          submitter_cho_unit: sessionContext || null,
          from_barangay_name: loginBarangay || null,
        });
        if (pendingContactMessageId) {
          await axios.put(`${API_URL}/api/contact-messages/${pendingContactMessageId}/accept`).catch(() => {});
          setPendingContactMessageId(null);
          fetchOutbox();
        }
        const routedMsg = ownedUnit && targetUnit && targetUnit !== ownedUnit
          ? `Case submitted to ${targetUnit} for approval!`
          : 'Case submitted to your CHO for approval!';
        setSubmitMsg(routedMsg);
        notify(routedMsg, 'success');
      } else {
        const newCaseRes = await axios.post(API_URL + '/api/cases', {
          ...payload,
          submitter_cho_unit: sessionContext || null,
          submitter_role: loginRole || null,
          submitter_own_barangay: loginBarangay || null,
        });
        // If this case was created from a pending contact message, mark it accepted
        if (pendingContactMessageId) {
          await axios.put(`${API_URL}/api/contact-messages/${pendingContactMessageId}/accept`);
          setPendingContactMessageId(null);
          fetchOutbox();
        }
        setSubmitMsg(isDraft ? 'Case saved as draft!' : 'Case added successfully!');
        notify(isDraft ? 'Case saved as draft!' : 'Case added successfully!', 'success');
      }
      await fetchCases();
      const diseaseEntry = findDiseaseEntry(formData.diseaseType);
      if (diseaseEntry) { setSelectedDisease(diseaseEntry); setSelectedCategory(null); setCategoryPage(0); }
      setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1200);
    } catch (err) {
      // Network error (no response) - queue offline instead of showing error
      if (!err.response) {
        const tempId = 'temp-' + Date.now();
        try {
          if (editingCase) {
            const op = {
              type: 'edit',
              endpoint: `/api/cases/${editingCase.case_id}`,
              method: 'PUT',
              payload,
              userId: loggedUserId,
              userName: loggedUser,
            };
            await enqueueOperation(op);
            await applyLocalOfflineCase(op, editingCase);
          } else {
            const op = {
              type: 'create',
              endpoint: '/api/cases',
              method: 'POST',
              payload: { ...payload, case_id: tempId },
              userId: loggedUserId,
              userName: loggedUser,
            };
            await enqueueOperation(op);
            await applyLocalOfflineCase(op);
          }
          setSubmitMsg('Case saved offline - will sync when reconnected.');
          setOfflineMode(true);
          setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1800);
        } catch (queueErr) {
          setSubmitMsg('Error saving offline: ' + queueErr.message);
          notify('Error saving offline: ' + queueErr.message, 'error');
          setSubmitLoading(false);
        }
        return;
      }
      if (err.response?.status === 409 && err.response?.data?.crossBarangay) {
        const { detectedBarangay, message } = err.response.data;
        const confirmed = window.confirm(message);
        if (confirmed) {
          try {
            await axios.post(`${API_URL}/api/cases/route-to-barangay-inbox`, {
              ...payload,
              submitter_user_id: loggedUserId || null,
              submitter_name: loggedUser || 'Unknown',
              from_cho_unit: (loginRole === 'BHW' && loginBarangay ? getChoUnitForBarangay(loginBarangay) : sessionContext) || null,
              target_barangay_name: detectedBarangay,
            });
            setSubmitMsg('Case sent to ' + detectedBarangay + ' BHW inbox successfully!');
          notify('Case sent to ' + detectedBarangay + ' BHW inbox successfully!', 'success');
            await fetchCases();
            const diseaseEntry = findDiseaseEntry(formData.diseaseType);
            if (diseaseEntry) { setSelectedDisease(diseaseEntry); setSelectedCategory(null); setCategoryPage(0); }
            setTimeout(() => { setView('list'); setSubmitMsg(''); setSubmitLoading(false); }, 1200);
          } catch (routeErr) {
            setSubmitMsg('Error: ' + (routeErr.response?.data?.error || routeErr.message));
            notify('Error: ' + (routeErr.response?.data?.error || routeErr.message), 'error');
            setSubmitLoading(false);
          }
        } else {
          setSubmitMsg('Please select the correct assigned barangay.');
          notify('Please select the correct assigned barangay.', 'error');
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
      notify('Error: ' + (err.response?.data?.error || err.message), 'error');
      setSubmitLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    background: 'var(--input-bg)',
    color: 'var(--text-main)',
    fontSize: '15px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  // ═══════════════════════════════════
  // VIEW: DISEASE CARDS
  // ═══════════════════════════════════
  if (view === 'categories') {
    const gridCategories = DISEASE_CATEGORIES.filter(c => c.id !== 'exclusive');
    const builtinCategories = gridCategories.filter(c => !String(c.id).startsWith('custom-'));
    const totalCategoryPages = Math.ceil(builtinCategories.length / CATEGORIES_PER_PAGE);
    const currentCategories = builtinCategories.slice(categoryPage * CATEGORIES_PER_PAGE, (categoryPage + 1) * CATEGORIES_PER_PAGE);

    const category = selectedCategory ? DISEASE_CATEGORIES.find(c => c.id === selectedCategory) : null;
    const diseaseEntries = category ? category.diseases : [];
    const totalDiseasePages = Math.ceil(diseaseEntries.length / DISEASES_PER_PAGE);
    const currentDiseases = diseaseEntries.slice(diseasePage * DISEASES_PER_PAGE, (diseasePage + 1) * DISEASES_PER_PAGE);

    const showCategoryPagination = totalCategoryPages > 1;
    const showDiseasePagination = diseaseEntries.length > 6;
    const gridMode = diseaseEntries.length <= 6;

    const renderCategoryCard = (cat) => {
      const count = getCaseCount(cat);
      return (
        <div key={cat.id}
          onClick={() => { setSelectedCategory(cat.id); setDiseasePage(0); setBrowseAllCategories(false); setBrowseAllExclusive(false); }}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: compactMode ? '14px' : '24px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '28px', lineHeight: 1 }}>{cat.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-main)' }}>{cat.name}</div>
              <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '2px' }}>{count} Active case{count !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ background: cat.color, color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', flexShrink: 0 }}>
              {count}
            </div>
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.55' }}>
            {(() => { const names = cat.diseases.map(d => d.name); return names.length > 4 ? names.slice(0, 4).join(', ') + ` (+${names.length - 4} more)` : names.join(', '); })()}
          </p>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#3B82F6', fontSize: '15px', fontWeight: '600' }}>
            View Diseases <span style={{ fontSize: '16px' }}>›</span>
          </div>
        </div>
      );
    };

    const renderDiseaseCard = (entry, compact) => {
      const count = getCaseCount(entry);
      if (compact) {
        return (
          <div key={entry.dbName}
            onClick={() => {
              setSelectedDisease(entry);
              setFilterPurok('All Puroks');
              setTablePage(1);
              setSearchQuery('');
              setFilterBarangay('All Barangays');
              setFilterStatus('All Status');
              setView('list');
              setBrowseAllCategories(false);
              setBrowseAllExclusive(false);
            }}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ fontSize: '26px', marginBottom: '6px' }}>{entry.icon}</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', lineHeight: '1.25' }}>{entry.name}</div>
            <div style={{ fontSize: '15px', color: 'var(--text-main)', lineHeight: '1.3', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.desc}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: entry.color, color: '#fff', borderRadius: '50%', width: '28px', height: '28px', fontSize: '15px', fontWeight: '700' }}>
              {count}
            </div>
          </div>
        );
      }
      return (
        <div key={entry.dbName}
          onClick={() => {
            setSelectedDisease(entry);
            setFilterPurok('All Puroks');
            setTablePage(1);
            setSearchQuery('');
            setFilterBarangay('All Barangays');
            setFilterStatus('All Status');
            setView('list');
            setBrowseAllCategories(false);
            setBrowseAllExclusive(false);
          }}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: compactMode ? '14px' : '24px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '28px', lineHeight: 1 }}>{entry.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-main)' }}>{entry.name}</div>
              <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '2px' }}>{count} Active case{count !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ background: entry.color, color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', flexShrink: 0 }}>
              {count}
            </div>
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-main)', lineHeight: '1.55' }}>{entry.desc}</p>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#3B82F6', fontSize: '15px', fontWeight: '600' }}>
            View Cases <span style={{ fontSize: '16px' }}>›</span>
          </div>
        </div>
      );
    };

    if (!category && browseAllCategories) {
      return (
        <div style={{ padding: compactMode ? '24px 14px 14px' : '48px 28px 28px', color: 'var(--text-main)', fontSize: `calc(15px * ${fs})` }}>
          {offlineMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', marginBottom: '16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', fontSize: '15px', color: '#D97706' }}>
              <span style={{ fontSize: '16px' }}>⚠</span>
              Offline - showing cached data. Changes will sync when reconnected.
            </div>
          )}
          <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '6px' }}>Dashboard / Manage Cases / Other Categories</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '22px' }}>Other Categories</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px' }}>All disease categories in the system</p>
            </div>
            <BackButton onClick={() => setBrowseAllCategories(false)}>Back</BackButton>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compactMode ? '12px' : '16px' }}>
            {gridCategories.map(cat => renderCategoryCard(cat))}
          </div>
        </div>
      );
    }

    if (!category && browseAllExclusive) {
      const exclusiveCat = DISEASE_CATEGORIES.find(c => c.id === 'exclusive');
      return (
        <div style={{ padding: compactMode ? '24px 14px 14px' : '48px 28px 28px', color: 'var(--text-main)', fontSize: `calc(15px * ${fs})` }}>
          {offlineMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', marginBottom: '16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', fontSize: '15px', color: '#D97706' }}>
              <span style={{ fontSize: '16px' }}>⚠</span>
              Offline - showing cached data. Changes will sync when reconnected.
            </div>
          )}
          <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '6px' }}>Dashboard / Manage Cases / Other Exclusive Diseases</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '22px' }}>⚠️ Other Exclusive Diseases</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px' }}>{exclusiveCat?.desc}</p>
            </div>
            <BackButton onClick={() => setBrowseAllExclusive(false)}>Back</BackButton>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compactMode ? '12px' : '16px' }}>
            {(exclusiveCat?.diseases || []).map(d => renderDiseaseCard(d, false))}
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: compactMode ? '24px 14px 14px' : '48px 28px 28px', color: 'var(--text-main)', fontSize: `calc(15px * ${fs})` }}>
        {offlineMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', marginBottom: '16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', fontSize: '15px', color: '#D97706' }}>
            <span style={{ fontSize: '16px' }}>⚠</span>
            Offline - showing cached data. Changes will sync when reconnected.
          </div>
        )}
        <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '6px' }}>
          Dashboard / Manage Cases {category ? `/ ${category.name}` : ''}
        </div>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          {category ? (
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '22px' }}>{category.icon} {category.name}</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px' }}>
                Select a disease to view, add, or manage cases
              </p>
            </div>
          ) : (
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '22px' }}>Select a Disease to Manage</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px' }}>
                Choose a category then a disease program
              </p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div onClick={() => { setView('inbox'); setInboxSubTab('referrals'); }}
                style={{ padding: '6px 14px', borderRadius: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '15px', fontWeight: '500', color: 'var(--text-main)', whiteSpace: 'nowrap', textAlign: 'center', minWidth: '70px' }}>
                Inbox
              </div>
              <div onClick={() => { setView('outbox'); }}
                style={{ padding: '6px 14px', borderRadius: '20px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '15px', fontWeight: '500', color: 'var(--text-main)', whiteSpace: 'nowrap', textAlign: 'center', minWidth: '70px' }}>
                Outbox
              </div>
            </div>
            {category && (
              <BackButton style={{ alignSelf: 'flex-end' }} onClick={() => { setSelectedCategory(null); setCategoryPage(0); setDiseasePage(0); setCarouselIndex(0); setBrowseAllCategories(false); setBrowseAllExclusive(false); }}>Back to Categories</BackButton>
            )}
            {category && showDiseasePagination && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Page {diseasePage + 1} / {totalDiseasePages}</span>
                <button onClick={() => setDiseasePage(Math.max(0, diseasePage - 1))} disabled={diseasePage === 0}
                  style={{ padding: '7px 16px', background: diseasePage === 0 ? 'var(--input-bg)' : '#121358', color: diseasePage === 0 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: diseasePage === 0 ? 'not-allowed' : 'pointer', fontSize: '15px' }}>
                  ← Prev
                </button>
                <button onClick={() => setDiseasePage(Math.min(totalDiseasePages - 1, diseasePage + 1))} disabled={diseasePage >= totalDiseasePages - 1}
                  style={{ padding: '7px 16px', background: diseasePage >= totalDiseasePages - 1 ? 'var(--input-bg)' : '#121358', color: diseasePage >= totalDiseasePages - 1 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: diseasePage >= totalDiseasePages - 1 ? 'not-allowed' : 'pointer', fontSize: '15px' }}>
                  Next →
                </button>
              </div>
            )}
        {!category && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {keyboardShortcuts && (
                  <div style={{ position: 'relative' }} ref={shortcutsRef}>
                    <button onClick={() => setShowShortcutsGuide(!showShortcutsGuide)}
                      style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ?
                    </button>
                    {showShortcutsGuide && (
                      <div style={{ position: 'absolute', top: '110%', right: 0, width: '240px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: '14px', fontSize: '15px' }}>
                        <div style={{ fontWeight: '700', marginBottom: '10px', color: 'var(--text-main)' }}>Keyboard Shortcuts</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>New Case</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '15px', border: '1px solid var(--border-color)' }}>N</kbd></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>Save Form</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '15px', border: '1px solid var(--border-color)' }}>Ctrl+S</kbd></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>Close / Back</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '15px', border: '1px solid var(--border-color)' }}>Esc</kbd></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!category && (
        <div style={{ position: 'relative', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0px', minHeight: '220px' }}>
          {/* LEFT faded peek */}
          <div className="cdms-carousel-peek" style={{
            width: '80px', height: '180px', background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)', borderRadius: '12px 0 0 12px',
            opacity: 0.35, flexShrink: 0, clipPath: 'polygon(0 0, 100% 10%, 100% 90%, 0 100%)',
          }} />

          {/* CENTER active card */}
          <div style={{
            flex: '0 1 980px', width: 'min(100%, 980px)', minHeight: '260px',
            background: 'var(--bg-surface)', border: '2px solid var(--border-color)',
            borderRadius: '14px', padding: '24px', position: 'relative',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}>
            <div key={carouselIndex} className="cdms-carousel-slide" style={{ textAlign: 'center' }}>
              {carouselIndex === 0 && (
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', color: 'var(--text-main)' }}>📋 All Diseases & Categories</h3>
                  <p style={{ margin: '0 0 14px 0', fontSize: '15px', color: 'var(--text-muted)' }}>
                    Browse all disease categories below, or use the ◀ ▶ arrows for exclusive diseases and to add a new one.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compactMode ? '12px' : '16px', textAlign: 'left', maxWidth: '900px', margin: '0 auto' }}>
                    {currentCategories.map(cat => renderCategoryCard(cat))}
                  </div>
                  {showCategoryPagination && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                      {Array.from({ length: totalCategoryPages }).map((_, i) => (
                        <div key={i} onClick={() => setCategoryPage(i)}
                          style={{ width: '10px', height: '10px', borderRadius: '50%', background: categoryPage === i ? '#121358' : 'var(--border-color)', transition: 'background 0.2s', cursor: 'pointer' }} />
                      ))}
                    </div>
                  )}
                  {builtinCategories.length >= 6 && (
                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                      <button onClick={() => setBrowseAllCategories(true)}
                        style={{ padding: '10px 20px', background: '#121358', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
                        More Categories
                      </button>
                    </div>
                  )}
                </div>
              )}
              {carouselIndex === 1 && (() => {
                const exclusiveCat = DISEASE_CATEGORIES.find(c => c.id === 'exclusive');
                return (
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--text-main)' }}>⚠️ Exclusive Diseases</h3>
                    <p style={{ margin: '0 0 14px 0', fontSize: '15px', color: 'var(--text-muted)' }}>{exclusiveCat?.desc}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'left', maxWidth: '760px', margin: '0 auto' }}>
                      {(exclusiveCat?.diseases || []).slice(0, 6).map(d => (
                        <div key={d.name}
                          onClick={() => {
                            setSelectedDisease(d);
                            setFilterPurok('All Puroks');
                            setTablePage(1);
                            setSearchQuery('');
                            setFilterBarangay('All Barangays');
                            setFilterStatus('All Status');
                            setView('list');
                          }}
                          style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.15s, box-shadow 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                          <div style={{ fontSize: '28px', lineHeight: 1, marginBottom: '8px' }}>{d.icon}</div>
                          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>{d.name}</div>
                          <div style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.35', marginBottom: '10px' }}>{d.desc}</div>
                          <div style={{ background: d.color, color: '#fff', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', margin: '0 auto' }}>
                            {getCaseCount(d)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {(exclusiveCat?.diseases || []).length >= 6 && (
                      <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <button onClick={() => { setBrowseAllExclusive(true); }}
                          style={{ padding: '10px 20px', background: '#121358', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
                          Other Exclusive Diseases
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
              {carouselIndex === 2 && (
                <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '22px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '17px', color: 'var(--text-main)', textAlign: 'center' }}>➕ Add New Disease</h3>
                  {addDiseaseMsg && (
                    <div style={{ padding: '8px 12px', marginBottom: '10px', borderRadius: '6px', fontSize: '15px', background: addDiseaseMsg.startsWith('Error') ? '#fee2e2' : '#d1f5e9', color: addDiseaseMsg.startsWith('Error') ? '#991b1b' : '#0a5e42' }}>
                      {addDiseaseMsg}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <input type="text" placeholder="Disease name" value={newDiseaseName}
                      onChange={e => setNewDiseaseName(e.target.value)}
                      style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '15px' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)' }}>
                      <label style={{ fontSize: '15px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Color</label>
                      <input type="color" value={newDiseaseColor}
                        onChange={e => setNewDiseaseColor(e.target.value)}
                        style={{ width: '100%', height: '32px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }} />
                    </div>
                  </div>
                  <label style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Icon</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '132px', overflowY: 'auto', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', marginBottom: '12px' }}>
                    {DISEASE_ICON_CHOICES.map(c => {
                      const active = newDiseaseIcon === c.key;
                      return (
                        <div key={'d_' + c.key} title={c.label} onClick={() => setNewDiseaseIcon(c.key)}
                          style={{ width: '34px', height: '34px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', cursor: 'pointer', fontSize: '17px', border: active ? '2px solid #3B82F6' : '1px solid var(--border-color)', background: active ? 'rgba(59,130,246,0.12)' : 'var(--bg-surface)' }}>
                          {c.icon}
                        </div>
                      );
                    })}
                    {EXTRA_ICON_CHOICES.map(ic => {
                      const active = newDiseaseIcon === ic;
                      return (
                        <div key={'x_' + ic} title={ic} onClick={() => setNewDiseaseIcon(ic)}
                          style={{ width: '34px', height: '34px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', cursor: 'pointer', fontSize: '17px', border: active ? '2px solid #3B82F6' : '1px solid var(--border-color)', background: active ? 'rgba(59,130,246,0.12)' : 'var(--bg-surface)' }}>
                          {ic}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ position: 'relative' }} ref={categoryRef}>
                      <button className="mc-custom-dropdown-btn" style={{ width: '100%' }} onClick={() => setCategoryOpen(!categoryOpen)}>
                        <span>
                          {newDiseaseCategory === '__new__' ? '➕ Add new category...'
                            : newDiseaseCategory === 'all' ? 'All Diseases'
                            : (DISEASE_CATEGORIES.find(c => c.id === newDiseaseCategory)?.name || 'All Diseases')}
                        </span>
                        <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', transform: categoryOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                      </button>
                      {categoryOpen && (
                        <div className="mc-custom-dropdown-panel">
                          <div
                            className={`mc-custom-dropdown-item ${newDiseaseCategory === 'all' ? 'mc-custom-dropdown-item--active' : ''}`}
                            onClick={() => { setNewDiseaseCategory('all'); setCategoryOpen(false); }}
                          >
                            All Diseases
                          </div>
                          {DISEASE_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                            <div
                              key={c.id}
                              className={`mc-custom-dropdown-item ${newDiseaseCategory === c.id ? 'mc-custom-dropdown-item--active' : ''}`}
                              onClick={() => { setNewDiseaseCategory(c.id); setCategoryOpen(false); }}
                            >
                              {c.name}
                            </div>
                          ))}
                          <div
                            className={`mc-custom-dropdown-item ${newDiseaseCategory === '__new__' ? 'mc-custom-dropdown-item--active' : ''}`}
                            onClick={() => { setNewDiseaseCategory('__new__'); setCategoryOpen(false); }}
                          >
                            ➕ Add new category...
                          </div>
                        </div>
                      )}
                    </div>
                    <textarea placeholder="Short description" value={newDiseaseDesc} rows={1}
                      onChange={e => setNewDiseaseDesc(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '15px', boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>
                  {newDiseaseCategory === '__new__' && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>New category name</label>
                      <input type="text" placeholder="e.g. Rare Diseases" value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '15px' }} />
                    </div>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={handleAddNewDisease}
                      style={{ padding: '10px 24px', background: '#129968', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
                      Save Disease
                    </button>
                  </div>
                  </div>

                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '22px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', color: 'var(--text-main)', textAlign: 'center' }}>➕ Add / Edit Prevention Tips</h3>
                    <p style={{ margin: '0 0 14px 0', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>Select a disease, then add or edit its prevention tips, symptom-checker questions, and video.</p>
                    {box2Msg && (
                      <div style={{ padding: '8px 12px', marginBottom: '10px', borderRadius: '6px', fontSize: '15px', background: box2Msg.startsWith('Error') ? '#fee2e2' : '#d1f5e9', color: box2Msg.startsWith('Error') ? '#991b1b' : '#0a5e42' }}>
                        {box2Msg}
                      </div>
                    )}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Disease</label>
                      <div style={{ position: 'relative' }} ref={box2DiseaseRef}>
                        <button className="mc-custom-dropdown-btn" style={{ width: '100%' }} onClick={() => setBox2DiseaseOpen(!box2DiseaseOpen)}>
                          <span>
                            {box2DiseaseId
                              ? (allDiseases.find(d => String(d.id) === String(box2DiseaseId))?.name || 'Select a disease...')
                              : 'Select a disease...'}
                          </span>
                          <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', transform: box2DiseaseOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                        </button>
                        {box2DiseaseOpen && (
                          <div className="mc-custom-dropdown-panel" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                            {allDiseases.length === 0 && (
                              <div className="mc-custom-dropdown-item mc-custom-dropdown-item--active">No diseases</div>
                            )}
                            {allDiseases.map(d => (
                              <div
                                key={d.id}
                                className={`mc-custom-dropdown-item ${String(d.id) === String(box2DiseaseId) ? 'mc-custom-dropdown-item--active' : ''}`}
                                onClick={() => { loadBox2(d.id); setBox2DiseaseOpen(false); }}
                              >
                                {d.name}{d.active ? '' : ' (hidden)'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Prevention Tips <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>(one per line)</span></label>
                        <textarea value={box2Tips} onChange={e => setBox2Tips(e.target.value)} rows={5}
                          placeholder="Type prevention tips here, one per line..."
                          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontFamily: 'var(--sans)', fontSize: '15px', resize: 'vertical' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Symptom Checker Questions <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>(one per line)</span></label>
                        <textarea value={box2Symptoms} onChange={e => setBox2Symptoms(e.target.value)} rows={3}
                          placeholder="Type symptom-checker questions here, one per line..."
                          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontFamily: 'var(--sans)', fontSize: '15px', resize: 'vertical' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>External Video URL <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>(optional)</span></label>
                        <input type="url" value={box2Video} onChange={e => setBox2Video(e.target.value)}
                          placeholder="https://..."
                          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '15px', outline: 'none' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0', marginTop: '16px' }}>
                      <button onClick={saveBox2Tips} disabled={box2Saving}
                        style={{ flex: 1, padding: '12px', background: '#129968', border: 'none', borderRight: '1px solid var(--bg-main)', cursor: box2Saving ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: '600', color: '#fff', borderRadius: '8px 0 0 8px' }}>
                        {box2Saving ? 'Saving...' : '💾 Save Prevention Tips'}
                      </button>
                      <button onClick={openTipsManager}
                        style={{ flex: 1, padding: '12px', background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)', borderLeft: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: '600', borderRadius: '0 8px 8px 0' }}>
                        ✏️ Manage Prevention Tips
                      </button>
                    </div>
                  </div>

                  {addTipsPrompt && createPortal(
                    (() => {
                      const el = document.querySelector('.content-scroller');
                      const r = el ? el.getBoundingClientRect() : null;
                      return (
                        <div style={{ position: 'fixed', left: r ? r.left : 0, top: r ? r.top : 0, width: r ? r.width : '100%', height: r ? r.height : '100%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050 }}>
                          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '26px 28px', maxWidth: '440px', width: '92%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center' }}>
                            <div style={{ fontSize: '34px', marginBottom: '10px' }}>🦠</div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: 'var(--text-main)' }}>Add prevention tips for &quot;{addTipsPrompt.name}&quot;?</h3>
                            <p style={{ margin: '0 0 18px 0', color: 'var(--text-muted)', fontSize: '15px' }}>You can add prevention tips now, or later from the &quot;Add / Edit Prevention Tips&quot; box below.</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={() => { if (addTipsPrompt.id) { setBox2DiseaseId(String(addTipsPrompt.id)); loadBox2(addTipsPrompt.id); } setAddTipsPrompt(null); }}
                                style={{ flex: 1, padding: '12px', background: '#129968', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
                                Yes, add tips
                              </button>
                              <button onClick={() => setAddTipsPrompt(null)}
                                style={{ flex: 1, padding: '12px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
                                Not now
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })(),
                    document.body
                  )}
                </div>
              )}
            </div>

            {/* Left / Right carousel controls */}
            <button onClick={() => changeCarousel(-1)} title="Previous" className="cdms-carousel-arrow"
              style={{
                position: 'absolute', top: '50%', left: '-18px', transform: 'translateY(-50%)',
                width: '36px', height: '36px', borderRadius: '50%', background: '#121358',
                border: '2px solid var(--bg-main)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 2,
              }}>
              ◀
            </button>
            <button onClick={() => changeCarousel(1)} title="Next" className="cdms-carousel-arrow"
              style={{
                position: 'absolute', top: '50%', right: '-18px', transform: 'translateY(-50%)',
                width: '36px', height: '36px', borderRadius: '50%', background: '#121358',
                border: '2px solid var(--bg-main)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 2,
              }}>
              ▶
            </button>
          </div>

          {/* RIGHT faded peek */}
          <div className="cdms-carousel-peek" style={{
            width: '80px', height: '180px', background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)', borderRadius: '0 12px 12px 0',
            opacity: 0.35, flexShrink: 0, clipPath: 'polygon(0 10%, 100% 0, 100% 100%, 0 90%)',
          }} />
        </div>
        )}

        {category && (
          <div key={`disease-grid-${selectedCategory}`} className="cdms-view-in" style={{ display: 'grid', gridTemplateColumns: gridMode ? '1fr 1fr' : '1fr 1fr 1fr', gap: gridMode ? (compactMode ? '12px' : '16px') : '24px', marginTop: gridMode ? '16px' : '24px' }}>
            {currentDiseases.map(entry => renderDiseaseCard(entry, !gridMode))}
          </div>
        )}

        {tipsOpen && (() => {
          if (tipsEditor) {
            return createPortal(
              <div className="cdms-modal-backdrop" onClick={closeTipsManager} style={tipsBackdrop}>
                <div className="cdms-modal-card" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '28px 28px', width: '560px', maxHeight: '82vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <span style={{ fontSize: '26px' }}>{tipsEditor.icon}</span>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>Edit Prevention - {tipsEditor.name}</h3>
                  </div>
                  {tipsMsg && (
                    <div style={{ padding: '10px 12px', marginBottom: '14px', borderRadius: '6px', fontSize: '15px', background: tipsMsg.startsWith('Error') ? 'var(--error-bg, #fee2e2)' : '#d1f5e9', color: tipsMsg.startsWith('Error') ? '#991b1b' : '#0a5e42' }}>{tipsMsg}</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Prevention Tips <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>(one per line)</span></label>
                      <textarea
                        value={tipsEditor.preventionTips}
                        onChange={e => setTipsEditor({ ...tipsEditor, preventionTips: e.target.value })}
                        rows={6}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontFamily: 'var(--sans)', fontSize: '15px', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>Symptom Checker Questions <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>(one per line)</span></label>
                      <textarea
                        value={tipsEditor.symptoms}
                        onChange={e => setTipsEditor({ ...tipsEditor, symptoms: e.target.value })}
                        rows={4}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontFamily: 'var(--sans)', fontSize: '15px', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>External Video URL <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>(optional)</span></label>
                      <input
                        type="url"
                        value={tipsEditor.videoUrl}
                        onChange={e => setTipsEditor({ ...tipsEditor, videoUrl: e.target.value })}
                        placeholder="https://..."
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px', gap: '0' }}>
                    <button onClick={() => { setTipsEditor(null); setTipsMsg(''); }}
                      style={{ flex: 1, padding: '13px', background: 'var(--input-bg)', border: 'none', borderRight: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '16px', fontWeight: '500', color: 'var(--text-main)', borderRadius: '6px 0 0 6px' }}>
                      Back to list
                    </button>
                    <button onClick={saveTips} disabled={tipsSaving}
                      style={{ flex: 2, padding: '13px', background: '#129968', border: 'none', cursor: tipsSaving ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: '600', color: '#fff', borderRadius: '0 6px 6px 0' }}>
                      {tipsSaving ? 'Saving...' : 'Save Prevention Tips'}
                    </button>
                  </div>
                </div>
              </div>
            , document.body);
          }
          return createPortal(
            <div className="cdms-modal-backdrop" onClick={closeTipsManager} style={tipsBackdrop}>
              <div className="cdms-modal-card" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '24px 24px', width: '620px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>✏️ Manage Prevention Tips</h3>
                  <button onClick={closeTipsManager} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}>✕</button>
                </div>
                <p style={{ margin: '0 0 6px 0', color: 'var(--text-muted)', fontSize: '14px' }}>Select a disease to edit its prevention tips, symptom-checker questions, and video.</p>
                {tipsMsg && (
                  <div style={{ padding: '10px 12px', marginBottom: '10px', borderRadius: '6px', fontSize: '15px', background: '#fee2e2', color: '#991b1b' }}>{tipsMsg}</div>
                )}
                <div style={{ overflowY: 'auto', flex: 1, marginTop: '8px' }}>
                  {tipsList.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0', fontSize: '15px' }}>Loading diseases…</div>}
                  {tipsList.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border-color)', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span style={{ fontSize: '22px' }}>{d.icon || '🦠'}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}{d.active === 0 ? ' (hidden)' : ''}</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{(() => { const hard = DEFAULT_DISEASES.find(h => h.name === d.name); if (d.prevention_tips) return `${d.prevention_tips.split('\n').filter(Boolean).length} tips`; return hard ? `Default tips (${(hard.tips || []).length}) - will save to DB on Edit` : 'No tips set'; })()}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button onClick={() => { if (window.confirm(d.active === 0 ? `Un-hide "${d.name}" so it shows again on the Resident portal?` : `Hide "${d.name}" from the Resident portal? Its prevention tips and data will be kept and can be restored anytime.`)) toggleDiseaseActive(d); }}
                          style={{ padding: '7px 12px', background: d.active === 0 ? 'var(--success-bg)' : 'transparent', color: d.active === 0 ? 'var(--success-text)' : '#D97706', border: '1px solid ' + (d.active === 0 ? 'var(--success-border)' : '#D97706'), borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                          {d.active === 0 ? 'Un-hide' : 'Hide'}
                        </button>
                        <button onClick={() => openTipsEditor(d)}
                          style={{ padding: '7px 14px', background: '#121358', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          , document.body);
        })()}
      </div>
    );
  }

  // ═══════════════════════════════════
  // VIEW: INBOX (Gmail-style)
  // ═══════════════════════════════════
  if (view === 'inbox') {
    return (
      <div style={{ padding: compactMode ? '14px' : '28px', color: 'var(--text-main)', fontSize: `calc(15px * ${fs})` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '4px' }}>Dashboard / Manage Cases / Inbox</div>
            <h2 style={{ margin: 0, fontSize: '22px' }}> Inbox</h2>
          </div>
          <BackButton onClick={() => setView('categories')}>Back</BackButton>
        </div>
        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <div onClick={() => setInboxSubTab('referrals')}
            style={{
              padding: '8px 20px', cursor: 'pointer', fontSize: '15px', fontWeight: inboxSubTab === 'referrals' ? '700' : '500',
              color: inboxSubTab === 'referrals' ? 'var(--text-main)' : 'var(--text-muted)',
              borderBottom: inboxSubTab === 'referrals' ? '2px solid #129968' : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
            {loginRole === 'BHW' ? 'My Requests' : 'Referrals'} ({loginRole === 'BHW' ? myEditRequests.length + myAddRequests.length : inboxItems.length})
          </div>
          {loginRole === 'BHW' && (
            <div onClick={() => setInboxSubTab('messages')}
              style={{
                padding: '8px 20px', cursor: 'pointer', fontSize: '15px', fontWeight: inboxSubTab === 'messages' ? '700' : '500',
                color: inboxSubTab === 'messages' ? 'var(--text-main)' : 'var(--text-muted)',
                borderBottom: inboxSubTab === 'messages' ? '2px solid #129968' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              Messages ({contactMessages.filter(m => m.status === 'new' || m.status === 'pending').length})
            </div>
          )}
          {loginRole === 'CHO' && (
            <div onClick={() => setInboxSubTab('edit-requests')}
              style={{
                padding: '8px 20px', cursor: 'pointer', fontSize: '15px', fontWeight: inboxSubTab === 'edit-requests' ? '700' : '500',
                color: inboxSubTab === 'edit-requests' ? 'var(--text-main)' : 'var(--text-muted)',
                borderBottom: inboxSubTab === 'edit-requests' ? '2px solid #8B5CF6' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              Edit Requests ({editRequests.length + passwordRequests.length})
            </div>
          )}
          {loginRole === 'CHO' && (
            <div onClick={() => setInboxSubTab('add-requests')}
              style={{
                padding: '8px 20px', cursor: 'pointer', fontSize: '15px', fontWeight: inboxSubTab === 'add-requests' ? '700' : '500',
                color: inboxSubTab === 'add-requests' ? 'var(--text-main)' : 'var(--text-muted)',
                borderBottom: inboxSubTab === 'add-requests' ? '2px solid #3B82F6' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              Add Requests ({addRequests.length})
            </div>
          )}
          {loginRole === 'CHO' && (
            <div onClick={() => setInboxSubTab('registrations')}
              style={{
                padding: '8px 20px', cursor: 'pointer', fontSize: '15px', fontWeight: inboxSubTab === 'registrations' ? '700' : '500',
                color: inboxSubTab === 'registrations' ? 'var(--text-main)' : 'var(--text-muted)',
                borderBottom: inboxSubTab === 'registrations' ? '2px solid #D97706' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              Registrations ({pendingRegistrations.length})
            </div>
          )}
        </div>

        {inboxSubTab === 'referrals' && loginRole === 'BHW' && (() => {
          const merged = [
            ...myEditRequests.map(r => ({ ...r, _kind: 'edit' })),
            ...myAddRequests.map(r => ({ ...r, _kind: 'add' })),
          ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          return (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              {(myEditRequestsLoading || myAddRequestsLoading) ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading requests...</div>
              ) : merged.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No requests yet.</div>
              ) : (
                merged.map((req, idx) => (
                  <div key={`${req._kind}-${req.id}`} className="cdms-row-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', animationDelay: `${Math.min(idx, 10) * 45}ms` }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: req.status === 'accepted' ? '#129968' : req.status === 'rejected' ? '#ef4444' : '#D97706', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '15px', flexShrink: 0 }}>
                      {req.status === 'accepted' ? '✓' : req.status === 'rejected' ? '✕' : '…'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                        {req.patient_name || 'Unknown'} · {req.disease_name || req.disease_name_full || 'Unknown'}
                      </div>
                      <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {req._kind === 'edit' ? 'Edit request from ' : 'Case submitted to '}{req.from_barangay_name || 'your CHO'} · <span style={{ textTransform: 'capitalize', fontWeight: '600', color: req.status === 'accepted' ? '#129968' : req.status === 'rejected' ? '#ef4444' : '#D97706' }}>{req.status}</span>
                        {req._kind === 'add' && req.status === 'accepted' && req.case_id ? ` · Case ID #${req.case_id}` : ''}
                      </div>
                      {req.note && (
                        <div style={{ fontSize: '15px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>"{req.note}"</div>
                      )}
                      {req.reject_reason && (
                        <div style={{ fontSize: '15px', color: '#ef4444', marginTop: '2px' }}>Reason: {req.reject_reason}</div>
                      )}
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {new Date(req.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </div>
                    <button onClick={() => {
                      if (req._kind === 'edit') axios.put(`${API_URL}/api/case-edit-requests/${req.id}/read`);
                      else axios.put(`${API_URL}/api/case-add-requests/${req.id}/read`);
                      if (req._kind === 'edit') setMyEditRequests(prev => prev.filter(r => r.id !== req.id));
                      else setMyAddRequests(prev => prev.filter(r => r.id !== req.id));
                      setView('outbox');
                    }} title="View in Outbox"
                      style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #3B82F6', background: 'rgba(96,165,250,0.15)', color: '#3B82F6', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}>
                      →
                    </button>
                  </div>
                ))
              )}
            </div>
          );
        })()}

        {inboxSubTab === 'referrals' && loginRole !== 'BHW' && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
            {inboxLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading inbox...</div>
            ) : inboxItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Inbox is empty.</div>
            ) : (
              inboxItems.map((item, idx) => (
                <div key={item.id} className="cdms-row-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', animationDelay: `${Math.min(idx, 10) * 45}ms` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1, textAlign: 'left' }}>
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
                        <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                          {item.patient_name} · {item.disease_name} ({item.severity})
                        </div>
                        <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.address}
                        </div>
                        {item.notes && (
                          <div style={{ fontSize: '15px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            "{item.notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {new Date(item.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => handleAcceptInboxItem(item)} title="Accept"
                      style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #129968', background: 'rgba(18,153,104,0.1)', color: '#129968', cursor: 'pointer', fontSize: '16px' }}>
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
        )}

        {inboxSubTab === 'edit-requests' && loginRole === 'CHO' && (() => {
          const loading = editRequestsLoading || passwordRequestsLoading;
          const allRequests = [
            ...editRequests.map(r => ({ ...r, _type: 'case-edit' })),
            ...passwordRequests.map(r => ({ ...r, _type: 'password-change', from_barangay_name: 'N/A', patient_name: r.user_name || 'Unknown', note: 'Password change request' })),
          ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          return (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading requests...</div>
              ) : allRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No pending requests from BHWs.</div>
              ) : (
                allRequests.map((req, idx) => (
                  <div key={`${req._type}-${req.id}`} className="cdms-row-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', animationDelay: `${Math.min(idx, 10) * 45}ms` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1, textAlign: 'left' }}>
                        {req._type === 'password-change' ? (
                          <span>🔑 Password Change Request</span>
                        ) : (
                          <span>From BHW ({req.from_barangay_name || 'Unknown Barangay'})</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                        <div className="inbox-avatar-circle" style={{ background: req._type === 'password-change' ? '#D97706' : '#8B5CF6' }}>
                          {req._type === 'password-change' ? '🔑' : (req.from_barangay_name || 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {req._type === 'password-change' ? (
                            <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                              {req.user_name || 'Unknown BHW'} - requesting password change
                            </div>
                          ) : (
                            <>
                              <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                                {req.patient_name || 'Unknown'} · {req.disease_name || req.disease_name_full || 'Unknown Disease'}
                              </div>
                              {req.note && (
                                <div style={{ fontSize: '15px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  "{req.note}"
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {new Date(req.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button onClick={() => req._type === 'password-change' ? handleAcceptPasswordRequest(req) : handleAcceptEditRequest(req)} title="Accept"
                        style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #129968', background: 'rgba(18,153,104,0.1)', color: '#129968', cursor: 'pointer', fontSize: '16px' }}>
                        ✓
                      </button>
                      <button onClick={() => req._type === 'password-change' ? handleRejectPasswordRequest(req) : handleRejectEditRequest(req)} title="Reject"
                        style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })()}

        {inboxSubTab === 'add-requests' && loginRole === 'CHO' && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
            {addRequestsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading add requests...</div>
            ) : addRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No cases awaiting approval.</div>
            ) : (
              addRequests.map((req, idx) => (
                <div key={req.id} className="cdms-row-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', animationDelay: `${Math.min(idx, 10) * 45}ms` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1, textAlign: 'left' }}>
                      <span>New case from BHW ({req.from_barangay_name || 'Unknown Barangay'})</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                      <div className="inbox-avatar-circle" style={{ background: '#3B82F6' }}>
                        {(req.from_barangay_name || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                          {req.patient_name || 'Unknown'} · {req.disease_name || 'Unknown Disease'} ({req.severity || 'Moderate'})
                        </div>
                        <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.address || 'No address'} · {req.barangay_name || ''}
                        </div>
                        <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Submitted by {req.requested_by_name || 'BHW'} · {new Date(req.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => openApprovalReview(req)} title="Review & Approve"
                      style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #129968', background: 'rgba(18,153,104,0.1)', color: '#129968', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
                      ✓ Review
                    </button>
                    <button onClick={() => handleRejectAddRequest(req)} title="Reject"
                      style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {inboxSubTab === 'registrations' && loginRole === 'CHO' && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
            {pendingRegistrationsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading registrations...</div>
            ) : pendingRegistrations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No pending BHW registrations.</div>
            ) : (
              pendingRegistrations.map((reg, idx) => (
                <div key={reg.user_id} className="cdms-row-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', animationDelay: `${Math.min(idx, 10) * 45}ms` }}>
                  <div className="inbox-avatar-circle" style={{ background: '#D97706' }}>
                    {(reg.full_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: 600 }}>
                      {reg.full_name}
                    </div>
                    <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {reg.email} · {reg.barangay_name || 'No barangay'}
                    </div>
                    {reg.mobile_number && (
                      <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {reg.mobile_number}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '15px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {new Date(reg.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => handleApproveRegistration(reg)} title="Approve"
                      style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #129968', background: 'rgba(18,153,104,0.1)', color: '#129968', cursor: 'pointer', fontSize: '16px' }}>
                      ✓
                    </button>
                    <button onClick={() => handleRejectRegistration(reg)} title="Reject"
                      style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {loginRole === 'BHW' && inboxSubTab === 'messages' && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
            {contactMessagesLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading messages...</div>
            ) : contactMessages.filter(m => m.status === 'new' || m.status === 'pending').length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No messages from residents.</div>
            ) : (
              contactMessages.filter(m => m.status === 'new' || m.status === 'pending').map((msg, idx) => (
                <div key={msg.id} className="cdms-row-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', background: msg.status === 'pending' ? 'rgba(245,158,11,0.06)' : 'rgba(13,148,136,0.04)', animationDelay: `${Math.min(idx, 10) * 45}ms` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1, textAlign: 'left' }}>
                      From Resident{msg.barangay ? ` (${msg.barangay})` : msg.target_cho_unit ? ` (${msg.target_cho_unit})` : ''}
                      {msg.status === 'pending' && <span style={{ marginLeft: '8px', color: '#D97706', fontWeight: '600' }}>· Pending review</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                      <div className="inbox-avatar-circle" style={{ background: '#129968' }}>
                        {msg.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                          {msg.name}{msg.disease_name ? ` (${msg.disease_name})` : ''}
                        </div>
                        <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {new Date(msg.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </div>
                  {msg.status === 'new' ? (
                    <>
                      <button onClick={() => handlePendingContactMessage(msg)} title="Review"
                        style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #129968', background: 'rgba(18,153,104,0.1)', color: '#129968', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}>
                        ✓
                      </button>
                      <button onClick={() => handleRejectContactMessage(msg)} title="Reject"
                        style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}>
                        ✕
                      </button>
                    </>
                  ) : (
                    <button onClick={() => {
                      setPendingContactMessageId(msg.id);
                      setFormData({
                        patientName: msg.name,
                        diseaseType: msg.disease_name || '',
                        age: msg.age || '',
                        severity: 'Mild',
                        gender: msg.gender || 'Male',
                        contact: msg.contact_no || '',
                        onsetDate: '',
                        address: msg.address || '',
                        barangayId: '',
                        barangayName: '',
                        symptoms: msg.message || '',
                        physician: '',
                        lat: '',
                        lng: '',
                        purok: '',
                        status: 'Active',
                      });
                      setView('add');
                    }} title="Complete Case"
                      style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #D97706', background: 'rgba(245,158,11,0.1)', color: '#D97706', cursor: 'pointer', fontSize: '15px', fontWeight: '600', flexShrink: 0 }}>
                      Complete →
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════
  // VIEW: OUTBOX (Gmail-style)
  // ═══════════════════════════════════
  if (view === 'outbox') {
    return (
      <div style={{ padding: compactMode ? '14px' : '28px', color: 'var(--text-main)', fontSize: `calc(15px * ${fs})` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '4px' }}>Dashboard / Manage Cases / Outbox</div>
            <h2 style={{ margin: 0, fontSize: '22px' }}> Outbox</h2>
          </div>
          <BackButton onClick={() => setView('categories')}>Back</BackButton>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
          {outboxItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Outbox is empty.</div>
          ) : (
            outboxItems.map((item, idx) => (
              <div key={item.id} className="cdms-row-in" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: '1px solid var(--border-color)', animationDelay: `${Math.min(idx, 10) * 45}ms` }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: item.status === 'accepted' ? '#129968' : item.status === 'rejected' ? '#ef4444' : '#D97706', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '15px', flexShrink: 0 }}>
                  {item.status === 'accepted' ? '✓' : item.status === 'rejected' ? '✕' : '…'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600' }}>
                    {item.patient_name || 'Unknown'} · {item.disease_name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginTop: '10px' }}>
                    {item.item_type === 'referral' ? (
                      <>
                        {item.direction === 'sent' ? 'Sent to' : 'Received from'} {item.direction === 'sent' ? (item.to_cho_unit || item.to_barangay_name || '-') : (item.from_barangay_name ? `BHW (${item.from_barangay_name})` : item.from_cho_unit || '-')}
                      </>
                    ) : item.item_type === 'resident' ? (
                      <>Resident message from {item.barangay_name || '-'} · {item.to_cho_unit || '-'}</>
                    ) : item.item_type === 'add_request' ? (
                      <>Submitted to CHO for approval{item.to_cho_unit ? ` → ${item.to_cho_unit}` : ''}</>
                    ) : item.item_type === 'edit_request' ? (
                      <>Edit request from BHW ({item.from_barangay_name || '-'})</>
                    ) : (
                      <>{item.direction === 'sent' ? 'Sent to' : 'Received from'} {item.direction === 'sent' ? (item.to_cho_unit || item.to_barangay_name || '-') : (item.from_barangay_name ? `BHW (${item.from_barangay_name})` : item.from_cho_unit || '-')}</>
                    )}
                    <span> · Status: <span style={{ textTransform: 'capitalize', fontWeight: '600', color: item.status === 'accepted' ? '#129968' : item.status === 'rejected' ? '#ef4444' : '#D97706' }}>{item.status}</span></span>
                    {item.barangay_name && <span> · {item.item_type === 'edit_request' ? 'Barangay' : 'Assigned to'} {item.barangay_name}</span>}
                  </div>
                </div>
                <div style={{ fontSize: '15px', color: 'var(--text-muted)', flexShrink: 0 }}>
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
    return (
      <div key={`list-view-${selectedDisease?.dbName || 'all'}`} className="cdms-view-in" style={{ padding: compactMode ? '14px' : '28px', color: 'var(--text-main)', fontSize: `calc(15px * ${fs})` }}>
        {/* DELETE MODAL */}
        {deleteTarget && (
          <div className="cdms-modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="cdms-modal-card" style={{ background: 'var(--bg-surface)', borderRadius: '16px', padding: '40px 32px', width: '420px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '700', color: 'var(--text-main)' }}>Are you sure?</h3>
              <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6' }}>
                This action cannot be undone.<br />This will permanently delete the case record of:
              </p>
              <div style={{ background: 'var(--input-bg)', border: 'none', borderLeft: '4px solid #ef4444', borderRadius: '6px', padding: '14px 18px', marginBottom: '20px', textAlign: 'left' }}>
                <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '15px', marginBottom: '4px' }}>
                  Case ID: D-{String(deleteTarget.case_id).padStart(4, '0')}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
                  {deleteTarget.patient_name || 'Unknown'} – {deleteTarget.barangay_name || 'Unknown Barangay'}.
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: '0 0 28px 0' }}>
                All associated case records will remain but show as "System" for audit purposes.
              </p>
              <div style={{ display: 'flex', borderTop: '1px solid var(--border-color)', paddingTop: '20px', gap: '0' }}>
                <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
                  style={{ flex: 1, padding: '14px', background: 'var(--input-bg)', border: 'none', borderRight: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '16px', fontWeight: '500', color: 'var(--text-main)', borderRadius: '0 0 0 16px' }}>
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
            <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Dashboard / Manage Cases / {selectedDisease?.name || 'All Cases'}
            </div>
            <h2 style={{ margin: 0, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {selectedDisease ? <span>{selectedDisease.icon}</span> : <span>📋</span>} {selectedDisease?.name || 'All Cases'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {keyboardShortcuts && (
              <div style={{ position: 'relative' }} ref={shortcutsRef}>
                <button onClick={() => setShowShortcutsGuide(!showShortcutsGuide)}
                  style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ?
                </button>
                {showShortcutsGuide && (
                  <div style={{ position: 'absolute', top: '110%', right: 0, width: '240px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: '14px', fontSize: '15px' }}>
                    <div style={{ fontWeight: '700', marginBottom: '10px', color: 'var(--text-main)' }}>Keyboard Shortcuts</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>New Case</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '15px', border: '1px solid var(--border-color)' }}>N</kbd></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>Save Form</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '15px', border: '1px solid var(--border-color)' }}>Ctrl+S</kbd></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)' }}>Close / Back</span><kbd style={{ background: 'var(--input-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '15px', border: '1px solid var(--border-color)' }}>Esc</kbd></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* EXPORT DROPDOWN */}
            <div style={{ position: 'relative' }} ref={exportRef}>
              <button onClick={() => setShowExportMenu(!showExportMenu)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: showExportMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </button>
              {showExportMenu && (
                <div style={{ position: 'absolute', top: '110%', right: 0, width: '180px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  {[
                    { label: '📄 Word (.doc)', action: handleExportWord },
                    { label: '📊 Excel (.xls)', action: handleExportExcel },
                    { label: '📋 CSV (.csv)', action: handleExportCSV },
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', fontSize: '15px', borderBottom: '1px solid var(--border-color)' }}
                      onMouseEnter={e => e.target.style.background = 'var(--input-bg)'}
                      onMouseLeave={e => e.target.style.background = 'transparent'}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <BackButton onClick={() => { setView('categories'); setSelectedDisease(null); setSearchQuery(''); }}>Back</BackButton>
            {loginRole !== 'CHO' && (
              <button onClick={openAdd}
                style={{ padding: '8px 18px', background: '#129968', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
                + Add Case
              </button>
            )}
          </div>
        </div>

        <div style={{ fontSize: '15px', color: 'var(--text-muted)', textAlign: 'right', marginBottom: '6px' }}>
          {lastUpdated ? `Updated ${Math.round((now - lastUpdated) / 1000)}s ago` : 'Refreshing...'}
        </div>

        {/* Table card */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: compactMode ? '12px' : '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <input type="text" placeholder="Search Cases..."
              value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setTablePage(1); }}
              style={{ padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '15px', width: '180px' }} />

            {/* Barangay filter - hidden for BHW */}
            {loginRole !== 'BHW' && (
              <div style={{ position: 'relative' }} ref={barangayRef}>
                <button className="mc-custom-dropdown-btn" onClick={() => setBarangayOpen(!barangayOpen)}>
                  <span>{filterBarangay}</span>
                  <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', transform: barangayOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>
                {barangayOpen && (
                  <div className="mc-custom-dropdown-panel">
                    <div
                      className={`mc-custom-dropdown-item ${filterBarangay === 'All Barangays' ? 'mc-custom-dropdown-item--active' : ''}`}
                      onClick={() => { setFilterBarangay('All Barangays'); setTablePage(1); setBarangayOpen(false); }}
                    >
                      All Barangays
                    </div>
                    {[...scopedBarangayOptions].sort().map(b => (
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

            {/* Purok/Blk/Phase filter - only for BHW */}
            {loginRole === 'BHW' && (
              <div style={{ position: 'relative' }} ref={purokRef}>
                <button className="mc-custom-dropdown-btn" onClick={() => setPurokOpen(!purokOpen)}>
                  <span>{filterPurok}</span>
                  <span style={{ marginLeft: '6px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', transform: purokOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>
                {purokOpen && (
                  <div className="mc-custom-dropdown-panel">
                    {['All Puroks', ...dynamicPurokOptions].map(p => (
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
            <div style={{ position: 'relative' }} ref={statusRef}>
              <button type="button" onClick={() => setStatusOpen(!statusOpen)}
                style={{ padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                {filterStatus}
                <span style={{ fontSize: '15px', opacity: 0.6, transition: 'transform 0.2s', transform: statusOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </button>
              {statusOpen && (
                <div className="cdms-dropdown-panel" style={{ position: 'absolute', top: '105%', left: 0, minWidth: '180px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 100, overflow: 'hidden' }}>
                  {['All Status', ...['Active', 'Pending', 'Under Treatment', 'Recovered', 'Deceased', 'Draft'].sort()].map(s => (
                    <button key={s} type="button"
                      onClick={() => { setFilterStatus(s); setStatusOpen(false); setTablePage(1); }}
                      style={{ display: 'block', width: '100%', padding: '10px 14px', background: filterStatus === s ? 'var(--input-bg)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: filterStatus === s ? '600' : '400' }}
                      onMouseEnter={e => { if (filterStatus !== s) e.target.style.background = 'var(--input-bg)'; }}
                      onMouseLeave={e => { if (filterStatus !== s) e.target.style.background = 'transparent'; }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '15px' }}>
              {filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''} found
            </span>
          </div>

          {loadingCases ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[0, 1, 2, 3, 4].map(r => (
                  <tr key={r} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(c => (
                      <td key={c} style={{ padding: compactMode ? '7px 8px' : '12px', textAlign: 'center' }}>
                        <div className="cdms-skeleton" style={{ width: c === 1 ? '55%' : '70%', height: '16px', margin: '0 auto' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Case ID', 'Patient Name', 'Age', 'Barangay', 'Date Reported', 'Severity', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'center', padding: compactMode ? '6px 8px' : '10px 12px', color: 'var(--text-muted)', fontSize: '15px', fontWeight: '600', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody key={`rows-${selectedDisease?.dbName || 'all'}-${tablePage}-${searchQuery}-${filterBarangay}-${filterStatus}-${filterPurok}`}>
                {paginatedCases.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '15px' }}>
                      No cases found for <strong>{selectedDisease?.name}</strong>
                      {(searchQuery || filterBarangay !== 'All Barangays' || filterStatus !== 'All Status')
                        ? ' with current filters.' : '.'}
                    </td>
                  </tr>
                ) : (
                  paginatedCases.map((c, rowIdx) => (
                    <tr key={c.case_id} className="cdms-row-in" style={{ borderBottom: '1px solid var(--border-color)', opacity: c.status === 'Draft' ? 0.6 : 1, animationDelay: `${Math.min(rowIdx, 10) * 45}ms` }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '15px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        #{String(c.case_id).padStart(3, '0')}
                        {c._pendingSync && (
                          <span title="Pending sync - will upload when reconnected" style={{ marginLeft: '6px', fontSize: '15px', fontWeight: '600', color: '#D97706' }}>⏳</span>
                        )}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '15px', fontWeight: '500', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.patient_name || 'Unknown'}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '15px', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.age || '--'}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '15px', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.barangay_name || '--'}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '15px', color: 'var(--text-main)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {formatDateStr(c.date_reported, dateFormat)}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', fontSize: '15px', color: 'var(--text-main)', textAlign: 'center' }}>
                        {c.severity || 'N/A'}
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', textAlign: 'center' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '15px', fontWeight: '500', ...getStatusStyle(c.status) }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: compactMode ? '7px 8px' : '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => openEdit(c)} title="Edit case"
                            style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-main)', fontSize: '15px' }}>
                            ✏️
                          </button>
                          <button onClick={() => {
                              if (confirmDelete) {
                                setDeleteTarget(c);
                              } else {
                                if (!isOnline() || !appOnlineRef.current) {
                                  handleOfflineDelete(c.case_id);
                                  return;
                                }
                                axios.delete(`${API_URL}/api/cases/${c.case_id}`)
                                  .then(() => fetchCases())
                                  .catch(err => notify('Delete failed: ' + (err.response?.data?.error || err.message), 'error'));
                              }
                            }} title="Delete case"
                            style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '15px' }}>
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
              <span style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
                Showing {(tablePage - 1) * CASES_PER_PAGE + 1}–{Math.min(tablePage * CASES_PER_PAGE, filteredCases.length)} of {filteredCases.length}
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => setTablePage(1)} disabled={tablePage === 1}
                  style={{ padding: '5px 8px', background: tablePage === 1 ? 'var(--input-bg)' : '#121358', color: tablePage === 1 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: tablePage === 1 ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: '700' }}>
                  {'<<'}
                </button>
                <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={tablePage === 1}
                  style={{ padding: '5px 12px', background: tablePage === 1 ? 'var(--input-bg)' : '#121358', color: tablePage === 1 ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: tablePage === 1 ? 'not-allowed' : 'pointer', fontSize: '15px' }}>
                  ← Prev
                </button>
                {getVisiblePages(tablePage, totalTablePages).map((p, i) =>
                  p === '...' ? (
                    <div key={`te${i}`} ref={tableEllipsisRef} style={{ position: 'relative', display: 'inline-flex' }}>
                      <button onClick={() => setTableEllipsisOpen(o => !o)}
                        style={{ padding: '5px 8px', background: tableEllipsisOpen ? 'rgba(18,19,88,0.15)' : 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '700', letterSpacing: '2px' }}>...</button>
                      {tableEllipsisOpen && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', width: '160px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 100 }}>
                          <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '6px' }}>Go to page (1–{totalTablePages})</div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input type="number" min="1" max={totalTablePages} value={tableEllipsisInput} placeholder="#"
                              onChange={e => setTableEllipsisInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { const v = parseInt(tableEllipsisInput); if (v >= 1 && v <= totalTablePages) { setTablePage(v); setTableEllipsisOpen(false); setTableEllipsisInput(''); } } }}
                              style={{ flex: 1, padding: '5px 6px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '15px', outline: 'none', width: '100%' }} />
                            <button onClick={() => { const v = parseInt(tableEllipsisInput); if (v >= 1 && v <= totalTablePages) { setTablePage(v); setTableEllipsisOpen(false); setTableEllipsisInput(''); } }}
                              style={{ padding: '5px 8px', border: '1px solid #121358', borderRadius: '4px', background: '#121358', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>Go</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button key={p} onClick={() => setTablePage(p)}
                      style={{ padding: '5px 10px', background: p === tablePage ? '#121358' : 'transparent', color: p === tablePage ? 'white' : 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', minWidth: '32px' }}>
                      {p}
                    </button>
                  )
                )}
                <button onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))} disabled={tablePage === totalTablePages}
                  style={{ padding: '5px 12px', background: tablePage === totalTablePages ? 'var(--input-bg)' : '#121358', color: tablePage === totalTablePages ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: tablePage === totalTablePages ? 'not-allowed' : 'pointer', fontSize: '15px' }}>
                  Next →
                </button>
                <button onClick={() => setTablePage(totalTablePages)} disabled={tablePage === totalTablePages}
                  style={{ padding: '5px 8px', background: tablePage === totalTablePages ? 'var(--input-bg)' : '#121358', color: tablePage === totalTablePages ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: tablePage === totalTablePages ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: '700' }}>
                  {'>>'}
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
    const latVal = String(formData.lat || '').trim();
    const lngVal = String(formData.lng || '').trim();
    const hasCoords = latVal !== '' && lngVal !== '' && !isNaN(parseFloat(latVal)) && !isNaN(parseFloat(lngVal));
    const mapSrc = hasCoords
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lngVal)-0.01},${parseFloat(latVal)-0.01},${parseFloat(lngVal)+0.01},${parseFloat(latVal)+0.01}&layer=mapnik&marker=${latVal},${lngVal}`
      : null;

    return (
      <div style={{ padding: compactMode ? '14px' : '28px', fontSize: `calc(15px * ${fs})` }}>
        <BackButton onClick={() => { if (approvalRequest) { closeApprovalReview(); return; } setView('list'); setFilterPurok('All Puroks'); }} style={{ marginBottom: '20px' }}>{approvalRequest ? 'Back to Add Requests' : `Back to ${selectedDisease?.name} Cases`}</BackButton>

        <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '40px', color: 'var(--text-main)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '24px', color: 'var(--text-main)' }}>
              {approvalRequest ? 'Review Add Request' : (isEdit ? 'Edit Case Report' : 'New Case Report')}
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px' }}>
              {approvalRequest
                ? `Submitted by ${approvalRequest.requested_by_name || 'BHW'} (${approvalRequest.from_barangay_name || 'no barangay'}) - ${approvalRequest.patient_name}`
                : isEdit
                  ? `Editing: Case #${String(editingCase?.case_id).padStart(3,'0')} - ${editingCase?.patient_name}`
                  : `Encoding new case under: ${selectedDisease?.name}`}
            </p>
          </div>

          {approvalRequest && (
            <div className="cdms-msg-in" style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '15px', fontWeight: '500' }}>
              📋 Review and adjust the details below, then click <strong>✓ Approve Case</strong> to add it to the records. Rejected requests return to the BHW with your reason.
            </div>
          )}

          {submitMsg && (
            <div className={`cdms-msg-in ${submitMsg.startsWith('Error') ? 'cdms-msg-shake' : ''}`} style={{ background: submitMsg.startsWith('Error') ? '#fee2e2' : '#d1f5e9', color: submitMsg.startsWith('Error') ? '#991b1b' : '#0a5e42', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '15px', fontWeight: '500' }}>
              {submitMsg.startsWith('Error') ? '❌' : '✅'} {submitMsg}
            </div>
          )}

          {autoSaveToast && (
            <div className="cdms-msg-in" style={{ background: '#fef3c7', color: '#92400e', padding: '8px 16px', borderRadius: '8px', marginBottom: '12px', textAlign: 'center', fontSize: '15px', fontWeight: '500' }}>
              💾 {autoSaveToast}
            </div>
          )}

          {editRequestSuccess && (
            <div className="cdms-msg-in" style={{ background: 'rgba(18,153,104,0.1)', color: '#3cb882', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '15px', fontWeight: '500' }}>
              ✅ {editRequestSuccess} - It has been sent to the CHO for editing
            </div>
          )}

          <form onSubmit={(e) => handleSave(e, false)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '24px' }}>

              {/* LEFT: Patient Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '15px', fontWeight: '700', paddingBottom: '8px' }}>
                  Patient Information
                </h4>
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>
                    Patient Full Name
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '15px', marginLeft: '6px' }}>
                      (Type surname to auto-fill past records)
                    </span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" required placeholder="e.g. Juan Dela Cruz" style={{ ...inputStyle, border: formErrors.patientName ? '2px solid #ef4444' : '1px solid var(--border-color)', background: formErrors.patientName ? 'rgba(239,68,68,0.1)' : 'var(--input-bg)' }}
                      value={formData.patientName} onChange={e => { setFormData({ ...formData, patientName: e.target.value }); setFormErrors(prev => ({ ...prev, patientName: false })); }}
                      onFocus={() => { if (patientLookupResults.length > 0) setShowLookupDropdown(true); }}
                      readOnly={isBhwReadOnly} />
                    {lookupLoading && (
                      <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '15px' }}>⌛</span>
                    )}
                  </div>
                  {showLookupDropdown && patientLookupResults.length > 0 && (
                    <div ref={lookupDropdownRef} style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
                      maxHeight: '220px', overflowY: 'auto', marginTop: '2px',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                      borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      padding: '4px',
                    }}>
                      <div style={{ padding: '6px 12px', fontSize: '15px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>
                        Multiple matching records - click to select
                      </div>
                      {patientLookupResults.map((p, i) => (
                        <div key={i}
                          onClick={() => applyPatientAutoFill(p)}
                          style={{
                            padding: '8px 12px', cursor: 'pointer', fontSize: '15px',
                            borderRadius: '6px', color: 'var(--text-main)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span><strong>{p.patient_name}</strong> <span style={{ color: 'var(--text-muted)' }}>- {p.barangay_name || 'N/A'}</span></span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
                            {p.age || '?'}y
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Age </label>
                    <input type="number" min="0" max="120" placeholder="25" style={{ ...inputStyle, border: formErrors.age ? '2px solid #ef4444' : '1px solid var(--border-color)', background: formErrors.age ? 'rgba(239,68,68,0.1)' : 'var(--input-bg)' }}
                      value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })}
                      readOnly={isBhwReadOnly} />
                    {formErrors.age && <span style={{ fontSize: '13px', color: '#ef4444', marginTop: '3px', display: 'block' }}>Age must be between 0 and 120</span>}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Gender</label>
                    {isBhwReadOnly ? (
                      <div style={{ padding: '8px 12px', background: 'var(--input-bg, #f1f5f9)', borderRadius: '6px', fontSize: '15px', color: 'var(--text-main)' }}>
                        {formData.gender || 'Not set'}
                      </div>
                    ) : (
                    <div style={{ position: 'relative' }} ref={genderRef}>
                      <button type="button" onClick={() => setGenderOpen(!genderOpen)}
                        style={{ ...inputStyle, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
                        <span>{formData.gender}</span>
                        <span style={{ fontSize: '15px', opacity: 0.6, transition: 'transform 0.2s', transform: genderOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                      </button>
                      {genderOpen && (
                        <div style={{ position: 'absolute', top: '105%', left: 0, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
                          {['Male', 'Female'].map(g => (
                            <button key={g} type="button"
                              onClick={() => { setFormData({ ...formData, gender: g }); setGenderOpen(false); }}
                              style={{ display: 'block', width: '100%', padding: '10px 14px', background: formData.gender === g ? 'rgba(18,153,104,0.12)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: formData.gender === g ? '600' : '400' }}
                              onMouseEnter={e => { if (formData.gender !== g) e.target.style.background = 'var(--input-bg)'; }}
                              onMouseLeave={e => { if (formData.gender !== g) e.target.style.background = 'transparent'; }}>
                              {g}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Contact No.</label>
                  <input type="text" placeholder="0918-234-2331" style={{ ...inputStyle, border: formErrors.contact ? '2px solid #ef4444' : '1px solid var(--border-color)', background: formErrors.contact ? 'rgba(239,68,68,0.1)' : 'var(--input-bg)' }}
                    value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })}
                    readOnly={isBhwReadOnly} />
                  {formErrors.contact && <span style={{ fontSize: '13px', color: '#ef4444', marginTop: '3px', display: 'block' }}>Enter a valid PH number (e.g., 09123456789)</span>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Address </label>
                  <input type="text" placeholder="123 Rizal St, San Isidro Cabuyao" style={inputStyle}
                    value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                    readOnly={isBhwReadOnly}
                    onBlur={async (e) => {
                      const addr = e.target.value.trim();
                      if (!addr) return;

                      const addrLower = addr.toLowerCase().replace(/[\-\s]/g, '');
                      let matchedBarangay = barangayList.find(b => {
                        const bNorm = b.name.replace(/\(.*?\)/g, '').toLowerCase().replace(/[\-\s().]/g, '').trim();
                        return addrLower.includes(bNorm);
                      });
                      if (!matchedBarangay) {
                        const BARANGAY_ALIASES = { 'bugtong': 'Butong', 'pitland': 'Pittland', 'poblacion1': 'Barangay Uno (Poblacion)', 'poblacion 1': 'Barangay Uno (Poblacion)', 'poblacion2': 'Barangay Dos (Poblacion)', 'poblacion 2': 'Barangay Dos (Poblacion)', 'poblacion3': 'Barangay Tres (Poblacion)', 'poblacion 3': 'Barangay Tres (Poblacion)' };
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

                      // Prefer polygon-boundary-snapped point
                      const purokCoords = unit && barangayName
                        ? (() => {
                            const feature = cabuyaoBoundaries.features.find(f => {
                              const mapped = GEOJSON_TO_DB_NAME[f.properties.ADM4_EN] || f.properties.ADM4_EN;
                              return norm(mapped) === norm(barangayName);
                            });
                            return getPointInBarangay(feature, `${barangayName}|${unit}`);
                          })()
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
                        const BARANGAY_ALIASES = { 'bugtong': 'Butong', 'pitland': 'Pittland', 'poblacion1': 'Barangay Uno (Poblacion)', 'poblacion 1': 'Barangay Uno (Poblacion)', 'poblacion2': 'Barangay Dos (Poblacion)', 'poblacion 2': 'Barangay Dos (Poblacion)', 'poblacion3': 'Barangay Tres (Poblacion)', 'poblacion 3': 'Barangay Tres (Poblacion)' };
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

                      // Prefer polygon-boundary-snapped point
                      const purokCoords = unit && barangayName
                        ? (() => {
                            const feature = cabuyaoBoundaries.features.find(f => {
                              const mapped = GEOJSON_TO_DB_NAME[f.properties.ADM4_EN] || f.properties.ADM4_EN;
                              return norm(mapped) === norm(barangayName);
                            });
                            return getPointInBarangay(feature, `${barangayName}|${unit}`);
                          })()
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
                    <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Assigned Purok / Blk / Phase / Lot</label>
                    {isBhwReadOnly ? (
                      <div style={{ padding: '8px 12px', background: 'var(--input-bg, #f1f5f9)', borderRadius: '6px', fontSize: '15px', color: 'var(--text-main)' }}>
                        {formData.purok || 'Not set'}
                      </div>
                    ) : (
                    <div style={{ position: 'relative' }} ref={purokRef}>
                      <button
                        type="button"
                        onClick={() => setPurokOpen(!purokOpen)}
                        style={{
                          ...inputStyle,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', textAlign: 'left',
                          border: `1px solid ${purokOpen ? '#3B82F6' : 'var(--border-color)'}`,
                        }}
                      >
                          <span>{formData.purok || '- Select Location -'}</span>
                        <span style={{
                          fontSize: '15px', opacity: 0.6, marginLeft: '8px',
                          transition: 'transform 0.2s', display: 'inline-block',
                          transform: purokOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}>▼</span>
                      </button>
                      {purokOpen && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                          maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                          borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          padding: '4px',
                        }}>
                          <div
                            onClick={() => { setFormData({ ...formData, purok: '' }); setPurokOpen(false); }}
                            style={{
                              padding: '8px 12px', cursor: 'pointer', fontSize: '15px',
                              borderRadius: '6px', color: 'var(--text-muted)',
                              background: !formData.purok ? 'rgba(37,99,235,0.12)' : 'transparent',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                            onMouseLeave={e => { e.currentTarget.style.background = !formData.purok ? 'rgba(37,99,235,0.12)' : 'transparent'; }}
                          >
                            -  Select Location -
                          </div>
                          {dynamicPurokOptions.map(p => (
                            <div
                              key={p}
                              onClick={() => { setFormData({ ...formData, purok: p }); setPurokOpen(false); }}
                              style={{
                                padding: '8px 12px', cursor: 'pointer', fontSize: '15px',
                                borderRadius: '6px',
                                background: formData.purok === p ? 'rgba(37,99,235,0.12)' : 'transparent',
                                color: formData.purok === p ? '#3B82F6' : 'var(--text-main)',
                                fontWeight: formData.purok === p ? '600' : '400',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                              onMouseLeave={e => { e.currentTarget.style.background = formData.purok === p ? 'rgba(37,99,235,0.12)' : 'transparent'; }}
                            >
                              {p}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Assigned Barangay</label>
                    {isBhwReadOnly ? (
                      <div style={{ padding: '8px 12px', background: 'var(--input-bg, #f1f5f9)', borderRadius: '6px', fontSize: '15px', color: 'var(--text-main)' }}>
                        {scopedBarangayList.find(b => String(b.id) === String(formData.barangayId))?.name || 'Not set'}
                      </div>
                    ) : (
                    <div style={{ position: 'relative' }} ref={barangayFormRef}>
                      <button
                        type="button"
                        onClick={() => setBarangayFormOpen(!barangayFormOpen)}
                        style={{
                          ...inputStyle,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', textAlign: 'left',
                          border: formErrors.barangayId ? '2px solid #ef4444' : `1px solid ${barangayFormOpen ? '#3B82F6' : 'var(--border-color)'}`,
                          background: formErrors.barangayId ? 'rgba(239,68,68,0.1)' : 'var(--input-bg)',
                        }}
                      >
                        <span>{scopedBarangayList.find(b => String(b.id) === String(formData.barangayId))?.name || '- Select Barangay -'}</span>
                        <span style={{
                          fontSize: '15px', opacity: 0.6, marginLeft: '8px',
                          transition: 'transform 0.2s', display: 'inline-block',
                          transform: barangayFormOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}>▼</span>
                      </button>
                      {barangayFormOpen && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                          maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                          borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          padding: '4px',
                        }}>
                          <div
                            onClick={() => { setFormData({ ...formData, barangayId: '' }); setBarangayFormOpen(false); setFormErrors(prev => ({ ...prev, barangayId: false })); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '15px', borderRadius: '6px', color: 'var(--text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            - Select Barangay -
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
                                padding: '8px 12px', cursor: 'pointer', fontSize: '15px', borderRadius: '6px',
                                background: String(formData.barangayId) === String(b.id) ? 'rgba(37,99,235,0.12)' : 'transparent',
                                color: String(formData.barangayId) === String(b.id) ? '#3B82F6' : 'var(--text-main)',
                                fontWeight: String(formData.barangayId) === String(b.id) ? '600' : '400',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                              onMouseLeave={e => { e.currentTarget.style.background = String(formData.barangayId) === String(b.id) ? 'rgba(37,99,235,0.12)' : 'transparent'; }}
                            >
                              {b.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT: Clinical Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '15px', fontWeight: '700', paddingBottom: '8px' }}>
                  Clinical Information
                </h4>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Disease Type</label>
                  {isBhwReadOnly ? (
                    <div style={{ padding: '8px 12px', background: 'var(--input-bg, #f1f5f9)', borderRadius: '6px', fontSize: '15px', color: 'var(--text-main)' }}>
                      {formData.diseaseType || 'Not set'}
                    </div>
                  ) : (
                  <div style={{ position: 'relative', outline: formErrors.diseaseType ? '2px solid #ef4444' : 'none', borderRadius: '6px' }} ref={diseaseFormRef}>
                    <button
                      type="button"
                      onClick={() => setDiseaseOpen(!diseaseOpen)}
                      style={{
                        ...inputStyle,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer', textAlign: 'left',
                          border: `1px solid ${diseaseOpen ? '#3B82F6' : 'var(--border-color)'}`,
                      }}
                    >
                      <span>{formData.diseaseType || '- Select Disease -'}</span>
                      <span style={{
                        fontSize: '15px', opacity: 0.6, marginLeft: '8px',
                        transition: 'transform 0.2s', display: 'inline-block',
                        transform: diseaseOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}>▼</span>
                    </button>
                    {diseaseOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                        maxHeight: '200px', overflowY: 'auto', marginTop: '4px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                          borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          padding: '4px',
                        }}>
                        <div
                          onClick={() => { setFormData({ ...formData, diseaseType: '' }); setDiseaseOpen(false); setFormErrors(prev => ({ ...prev, diseaseType: false })); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '15px', borderRadius: '6px', color: 'var(--text-muted)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          - Select Disease -
                        </div>
                        {ALL_DISEASE_OPTIONS.map(d => (
                          <div
                            key={d}
                            onClick={() => { setFormData({ ...formData, diseaseType: d }); setDiseaseOpen(false); setFormErrors(prev => ({ ...prev, diseaseType: false })); }}
                            style={{
                              padding: '8px 12px', cursor: 'pointer', fontSize: '15px', borderRadius: '6px',
                              background: formData.diseaseType === d ? 'rgba(37,99,235,0.12)' : 'transparent',
                              color: formData.diseaseType === d ? '#3B82F6' : 'var(--text-main)',
                              fontWeight: formData.diseaseType === d ? '600' : '400',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                            onMouseLeave={e => { e.currentTarget.style.background = formData.diseaseType === d ? 'rgba(37,99,235,0.12)' : 'transparent'; }}
                          >
                            {d}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Severity Level</label>
                  {isBhwReadOnly ? (
                    <div style={{ padding: '8px 12px', background: 'var(--input-bg, #f1f5f9)', borderRadius: '6px', fontSize: '15px', color: 'var(--text-main)' }}>
                      {formData.severity || 'Not set'}
                    </div>
                  ) : (
                  <div style={{ position: 'relative' }} ref={severityRef}>
                    <button type="button" onClick={() => setSeverityOpen(!severityOpen)}
                      style={{ ...inputStyle, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
                      <span>{formData.severity}</span>
                      <span style={{ fontSize: '15px', opacity: 0.6, transition: 'transform 0.2s', transform: severityOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </button>
                    {severityOpen && (
                      <div style={{ position: 'absolute', top: '105%', left: 0, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
                        {['Mild', 'Moderate', 'Severe', 'Asymptomatic'].sort().map(s => (
                          <button key={s} type="button"
                            onClick={() => { setFormData({ ...formData, severity: s }); setSeverityOpen(false); }}
                            style={{ display: 'block', width: '100%', padding: '10px 14px', background: formData.severity === s ? 'rgba(18,153,104,0.12)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: formData.severity === s ? '600' : '400' }}
                            onMouseEnter={e => { if (formData.severity !== s) e.target.style.background = 'var(--input-bg)'; }}
                            onMouseLeave={e => { if (formData.severity !== s) e.target.style.background = 'transparent'; }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Patient Status</label>
                  {isBhwReadOnly ? (
                    <div style={{ padding: '8px 12px', background: 'var(--input-bg, #f1f5f9)', borderRadius: '6px', fontSize: '15px', color: 'var(--text-main)' }}>
                      {formData.status || 'Not set'}
                    </div>
                  ) : (
                  <div style={{ position: 'relative' }} ref={patientStatusRef}>
                    <button type="button" onClick={() => setPatientStatusOpen(!patientStatusOpen)}
                      style={{ ...inputStyle, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}>
                      <span>{formData.status}</span>
                      <span style={{ fontSize: '15px', opacity: 0.6, transition: 'transform 0.2s', transform: patientStatusOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </button>
                    {patientStatusOpen && (
                      <div style={{ position: 'absolute', top: '105%', left: 0, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
                        {['Active', 'Pending', 'Under Treatment', 'Recovered', 'Deceased'].sort().map(s => (
                          <button key={s} type="button"
                            onClick={() => { setFormData({ ...formData, status: s }); setPatientStatusOpen(false); }}
                            style={{ display: 'block', width: '100%', padding: '10px 14px', background: formData.status === s ? 'rgba(18,153,104,0.12)' : 'transparent', border: 'none', textAlign: 'left', fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', fontWeight: formData.status === s ? '600' : '400' }}
                            onMouseEnter={e => { if (formData.status !== s) e.target.style.background = 'var(--input-bg)'; }}
                            onMouseLeave={e => { if (formData.status !== s) e.target.style.background = 'transparent'; }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                </div>

                {/* Status Transition Log */}
                {editingCase && statusHistory.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', marginTop: '4px', marginBottom: '4px' }}>
                    <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' }}>Status History</label>
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      {statusHistory.map((entry, idx) => (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderBottom: idx < statusHistory.length - 1 ? '1px solid var(--border-color)' : 'none', fontSize: '15px' }}>
                          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: idx === statusHistory.length - 1 ? '#129968' : '#94a3b8', flexShrink: 0, marginTop: '6px' }}></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{entry.old_status || 'Initial'} → </span>
                              <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{entry.new_status}</span>
                              {entry.changed_by_role && (
                                <span style={{ fontSize: '12px', padding: '1px 8px', borderRadius: '10px', background: entry.changed_by_role === 'CHO' ? 'rgba(37,99,235,0.15)' : 'rgba(18,153,104,0.15)', color: entry.changed_by_role === 'CHO' ? 'var(--text-main)' : 'var(--text-main)', fontWeight: '600' }}>{entry.changed_by_role}</span>
                              )}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                              {entry.changed_by_name && <span>by {entry.changed_by_name}</span>}
                              {entry.changed_at && <span>{entry.changed_by_name ? ' · ' : ''}{new Date(entry.changed_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                            </div>
                            {entry.notes && <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic', marginTop: '2px' }}>{entry.notes}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Date of Onset</label>
                  <div style={{ position: 'relative' }}>
                    <input id="onset-date-input" type="date" style={{ ...inputStyle, paddingRight: '36px', border: formErrors.onsetDate ? '2px solid #ef4444' : '1px solid var(--border-color)', background: formErrors.onsetDate ? 'rgba(239,68,68,0.1)' : 'var(--input-bg)' }} value={formData.onsetDate}
                      onChange={e => { setFormData({ ...formData, onsetDate: e.target.value }); setFormErrors(prev => ({ ...prev, onsetDate: false })); }}
                      readOnly={isBhwReadOnly} />
                    <span title="Open date picker" onClick={() => {
                      if (isBhwReadOnly) return;
                      const el = document.getElementById('onset-date-input');
                      if (el) {
                        if (typeof el.showPicker === 'function') {
                          el.showPicker();
                        } else {
                          el.focus();
                        }
                      }
                    }}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px',
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
                  <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Attending Physician</label>
                  <input type="text" placeholder="Dr. Jose Reyes, MD" style={{ ...inputStyle, border: formErrors.physician ? '2px solid #ef4444' : '1px solid var(--border-color)', background: formErrors.physician ? 'rgba(239,68,68,0.1)' : 'var(--input-bg)' }}
                    value={formData.physician} onChange={e => setFormData({ ...formData, physician: e.target.value })}
                    readOnly={isBhwReadOnly} />
                </div>
              </div>
            </div>

            {/* Symptoms full width */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px', fontWeight: '500' }}>Symptoms & Observations</label>
              <textarea placeholder="e.g. Fever (39.5°C), Severe Headache, Muscle and Joint Pain..." rows="3"
                style={{ ...inputStyle, resize: 'vertical', border: formErrors.symptoms ? '2px solid #ef4444' : '1px solid var(--border-color)', background: formErrors.symptoms ? 'rgba(239,68,68,0.1)' : 'var(--input-bg)' }}
                value={formData.symptoms} onChange={e => setFormData({ ...formData, symptoms: e.target.value })}
                readOnly={isBhwReadOnly} />
            </div>

            {/* Location & Coordinates + map preview */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: '600' }}>
                Location & Coordinates
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                <div>
                  {hasCoords && (
                    <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontSize: '15px', color: 'var(--text-main)', fontWeight: '500' }}>
                      {parseFloat(latVal).toFixed(4)}° N, {parseFloat(lngVal).toFixed(4)}° E
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px' }}>Latitude (N)</label>
                      <input type="text" placeholder="e.g. 14.2253" style={{ ...inputStyle, border: formErrors.location ? '2px solid #ef4444' : '1px solid var(--border-color)', background: formErrors.location ? 'rgba(239,68,68,0.1)' : 'var(--input-bg)' }}
                        value={formData.lat} onChange={e => setFormData({ ...formData, lat: e.target.value })}
                        readOnly={isBhwReadOnly} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '15px', color: 'var(--text-h)', marginBottom: '5px' }}>Longitude (E)</label>
                      <input type="text" placeholder="e.g. 121.3025" style={{ ...inputStyle, border: formErrors.location ? '2px solid #ef4444' : '1px solid var(--border-color)', background: formErrors.location ? 'rgba(239,68,68,0.1)' : 'var(--input-bg)' }}
                        value={formData.lng} onChange={e => setFormData({ ...formData, lng: e.target.value })}
                        readOnly={isBhwReadOnly} />
                    </div>
                  </div>
                </div>

                <div style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <iframe title="location-preview" src={mapSrc} width="100%" height="100%"
                    style={{ border: 'none', display: 'block' }} loading="lazy" />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" onClick={() => { setView('list'); setFilterPurok('All Puroks'); setIsBhwReadOnly(false); }}
                style={{ padding: '10px 32px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: '500' }}>
                Cancel
              </button>
              {isBhwReadOnly ? (
                <>
                  {!showEditRequestForm ? (
                    <button type="button" onClick={() => setShowEditRequestForm(true)}
                      style={{ padding: '10px 28px', borderRadius: '6px', border: '1px solid #0d9488', background: 'rgba(13,148,136,0.1)', color: '#0d9488', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
                      Edit Case to CHO
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <textarea
                        placeholder="Describe what needs to be changed..."
                        value={editRequestNote}
                        onChange={e => setEditRequestNote(e.target.value)}
                        rows={2}
                        style={{ width: '300px', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '15px', resize: 'vertical' }}
                      />
                      <button type="button" onClick={() => handleSendEditRequest()}
                        disabled={!editRequestNote.trim()}
                        style={{ padding: '10px 28px', borderRadius: '6px', border: 'none', background: editRequestNote.trim() ? '#0d9488' : '#64748b', color: 'white', cursor: editRequestNote.trim() ? 'pointer' : 'not-allowed', fontWeight: '600', fontSize: '15px' }}>
                        Send
                      </button>
                      <BackButton onClick={() => setShowEditRequestForm(false)}>Back</BackButton>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!isEdit && !approvalRequest && (
                    <button type="button" onClick={(e) => handleSave(e, true)} disabled={submitLoading}
                      style={{ padding: '10px 28px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', cursor: submitLoading ? 'not-allowed' : 'pointer', fontWeight: '500' }}>
                      Save As Draft
                    </button>
                  )}
                  <button type="submit" disabled={submitLoading}
                    style={{ padding: '10px 40px', borderRadius: '6px', border: 'none', background: submitLoading ? '#6fd4a2' : approvalRequest ? '#2563EB' : '#129968', color: 'white', cursor: submitLoading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '15px' }}>
                    {submitLoading ? 'Saving...' : (approvalRequest ? '✓ Approve Case' : (isEdit ? 'Update Case' : (loginRole === 'BHW' ? 'Submit to CHO' : 'Save Case')))}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        {/* Routing modal */}
        {routingStep && (
          <div className="cdms-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
            <div className="cdms-modal-card" style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              {routingStep === 'confirm' && (
                <>
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-main)' }}>
                    This address is not within our covered barangays, do you want to give it to {routingData?.targetUnit}?
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button onClick={handleRoutingDelete}
                      style={{ padding: '10px 24px', borderRadius: '6px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: '500', fontSize: '15px' }}>
                      ✕ Delete
                    </button>
                    {loginRole === 'BHW' ? (
                      <>
                        <button onClick={handleRoutingSendToDescription}
                          style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#121358', color: '#fff', cursor: 'pointer', fontWeight: '500', fontSize: '15px' }}>
                          → Send to {routingData?.targetUnit || 'CHO'}
                        </button>
                      </>
                    ) : (
                      <button onClick={handleRoutingSendToDescription}
                        style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#121358', color: '#fff', cursor: 'pointer', fontWeight: '500', fontSize: '15px' }}>
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
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '15px', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                    <button onClick={handleRoutingCancelDescription}
                      style={{ padding: '10px 24px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500', fontSize: '15px' }}>
                      ← Cancel
                    </button>
                    <button onClick={handleRoutingSend}
                      style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#121358', color: '#fff', cursor: 'pointer', fontWeight: '500', fontSize: '15px' }}>
                      Send
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Cross-unit submit confirm modal */}
        {crossUnit && (
          <div className="cdms-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
            <div className="cdms-modal-card" style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-main)' }}>
                Submit to another CHO unit?
              </div>
              <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
                {crossUnit.routeBrgy ? (
                  <>This case is located in <strong style={{ color: 'var(--text-main)' }}>Brgy. {crossUnit.routeBrgy}</strong> - under <strong style={{ color: 'var(--text-main)' }}>{crossUnit.targetUnit}</strong>.</>
                ) : (
                  <>This case appears to belong to a different CHO unit (<strong style={{ color: 'var(--text-main)' }}>{crossUnit.targetUnit}</strong>).</>
                )}{' '}
                Submit to that unit's CHO for approval?
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button onClick={() => setCrossUnit(null)}
                  style={{ padding: '10px 24px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500', fontSize: '15px' }}>
                  Cancel
                </button>
                <button onClick={() => performAddRequestSubmit(crossUnit.payload)}
                  style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#129968', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>
                  ✓ Submit to {crossUnit.targetUnit}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
