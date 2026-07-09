import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { API_URL } from '../config';
import cabuyaoBoundaries from '../data/cabuyao_barangays.geojson.json';
import cabuyaoGeoJSON from '../data/cabuyao_barangays.geojson';

const CABUYAO_CENTER = [14.2253, 121.1254];
const CABUYAO_BOUNDS = [
  [14.16, 120.98],
  [14.29, 121.18],
];

const ALL_BARANGAYS = [
  'Baclaran', 'Banay-Banay', 'Banlic',
  'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)', 'Barangay Uno (Poblacion)',
  'Bigaa', 'Butong', 'Casile', 'Diezmo', 'Gulod',
  'Mamatid', 'Marinig', 'Niugan', 'Pittland', 'Pulo', 'Sala', 'San Isidro',
];

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
  'Barangay Uno (Poblacion)': 'Barangay Uno (Poblacion)',
  'Barangay Dos (Poblacion)': 'Barangay Dos (Poblacion)',
  'Barangay Tres (Poblacion)': 'Barangay Tres (Poblacion)',
};

const NORM_OVERRIDE = {
  'niugan': 'Niugan',
  'pulo': 'Pulo',
  'sala': 'Sala',
  'bigaa': 'Bigaa',
  'banlic': 'Banlic',
  'butong': 'Butong',
  'casile': 'Casile',
  'gulod': 'Gulod',
  'mamatid': 'Mamatid',
  'marinig': 'Marinig',
  'baclaran': 'Baclaran',
  'diezmo': 'Diezmo',
  'pitland': 'Pittland',
  'pittland': 'Pittland',
  'sanisidro': 'San Isidro',
  'banaybanay': 'Banay-Banay',
  'poblacionuno': 'Barangay Uno (Poblacion)',
  'poblacion1': 'Barangay Uno (Poblacion)',
  'poblacion 1': 'Barangay Uno (Poblacion)',
  'poblaciondos': 'Barangay Dos (Poblacion)',
  'poblacion2': 'Barangay Dos (Poblacion)',
  'poblacion 2': 'Barangay Dos (Poblacion)',
  'poblacontres': 'Barangay Tres (Poblacion)',
  'poblacion3': 'Barangay Tres (Poblacion)',
  'poblacion 3': 'Barangay Tres (Poblacion)',
};

const normalize = (s) => {
  if (!s) return '';
  return s.replace(/\(.*?\)/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
};

const getDbName = (geoName) => {
  if (GEOJSON_TO_DB_NAME[geoName]) return GEOJSON_TO_DB_NAME[geoName];
  const normed = normalize(geoName);
  return NORM_OVERRIDE[normed] || geoName;
};

function getBarangayStyle(count) {
  if (!count || count === 0) return { fillColor: '#22c55e', weight: 1.5, opacity: 0.8, color: '#166534', fillOpacity: 0.35 };
  if (count <= 5) return { fillColor: '#eab308', weight: 1.5, opacity: 0.8, color: '#854d0e', fillOpacity: 0.4 };
  if (count <= 20) return { fillColor: '#f97316', weight: 1.5, opacity: 0.8, color: '#9a3412', fillOpacity: 0.45 };
  return { fillColor: '#ef4444', weight: 1.5, opacity: 0.8, color: '#991b1b', fillOpacity: 0.5 };
}

function BoundsSetter() {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(CABUYAO_BOUNDS);
  }, [map]);
  return null;
}

export default function ResidentMap() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrgy, setSelectedBrgy] = useState(null);
  const [brgyCases, setBrgyCases] = useState(0);
  const geoRef = useRef(null);

  useEffect(() => {
    axios.get(`${API_URL}/api/disease_cases`)
      .then(res => {
        setCases(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const caseCountByBrgy = {};
  cases.forEach(c => {
    const name = c.barangay_name || c.address || 'Unknown';
    caseCountByBrgy[name] = (caseCountByBrgy[name] || 0) + 1;
  });

  const geoJsonData = cabuyaoBoundaries || cabuyaoGeoJSON;

  const onEachFeature = (feature, layer) => {
    const dbName = getDbName(feature.properties?.ADM4_EN || feature.properties?.name || '');
    const count = caseCountByBrgy[dbName] || 0;

    layer.on('click', () => {
      setSelectedBrgy(dbName);
      setBrgyCases(count);
    });

    layer.bindTooltip(`${dbName}: ${count} case${count !== 1 ? 's' : ''}`, {
      sticky: true,
      direction: 'top',
    });

    const style = getBarangayStyle(count);
    layer.setStyle(style);
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: '24px', fontWeight: '700' }}>
        Disease Map
      </h2>
      <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '14px' }}>
        Click a barangay to see case counts. Color intensity indicates outbreak severity.
      </p>

      {selectedBrgy && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px',
          padding: '14px 18px', marginBottom: '16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <strong style={{ fontSize: '16px' }}>{selectedBrgy}</strong>
            <span style={{ marginLeft: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>
              {brgyCases} active case{brgyCases !== 1 ? 's' : ''}
            </span>
          </div>
          <button onClick={() => setSelectedBrgy(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>
            ✕
          </button>
        </div>
      )}

      <div style={{
        height: '550px', borderRadius: '12px', overflow: 'hidden',
        border: '1px solid var(--border-color)',
      }}>
        <MapContainer
          center={CABUYAO_CENTER}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <BoundsSetter />
          {geoJsonData && (
            <GeoJSON
              ref={geoRef}
              data={geoJsonData}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <LegendItem color="#22c55e" label="No cases" />
        <LegendItem color="#eab308" label="1-5 cases" />
        <LegendItem color="#f97316" label="6-20 cases" />
        <LegendItem color="#ef4444" label="20+ cases" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
      <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: color, opacity: 0.6 }} />
      {label}
    </div>
  );
}
