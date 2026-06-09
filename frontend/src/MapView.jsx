import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

// --- LEAFLET ICON FIX ---
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const CABUYAO_CENTER = [14.2783, 121.1247];
const CABUYAO_BOUNDS = [
  [14.2100, 121.0500],
  [14.3400, 121.1700]
];

function MapView() {
  // --- RESTORED DESIGN FILTER STATES ---
  const [barangay, setBarangay] = useState('All Barangays');
  const [status, setStatus] = useState('All Status');
  const [date, setDate] = useState('');
  const [severity, setSeverity] = useState('All Severities');

  const handleApplyFilters = () => {
    console.log("Applying filters:", { barangay, status, date, severity });
    // This is where your disease sorting engine will execute later
  };

  const handleResetFilters = () => {
    setBarangay('All Barangays');
    setStatus('All Status');
    setDate('');
    setSeverity('All Severities');
  };

  return (
    <div className="map-view-container">
      
      {/* SIDEBAR FILTERS PANEL (RESTORED) */}
      <div className="map-view-filter-panel">
        <h3 className="map-view-panel-title">Filters</h3>
        
        {/* Barangay Select */}
        <div className="map-view-form-group">
          <label className="map-view-label">Barangay</label>
          <select 
            className="map-view-select" 
            value={barangay} 
            onChange={(e) => setBarangay(e.target.value)}
          >
            <option>All Barangays</option>
            <option>Bigaa</option>
            <option>Sala</option>
            <option>Pulo</option>
            <option>Mamatid</option>
            <option>Banlic</option>
          </select>
        </div>

        {/* Status Select */}
        <div className="map-view-form-group">
          <label className="map-view-label">Status</label>
          <select 
            className="map-view-select" 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>All Status</option>
            <option>Active</option>
            <option>Recovered</option>
            <option>Critical</option>
          </select>
        </div>

        {/* Date Field Input */}
        <div className="map-view-form-group">
          <label className="map-view-label">Date</label>
          <input 
            type="date" 
            className="map-view-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Severity Select */}
        <div className="map-view-form-group">
          <label className="map-view-label">Severity</label>
          <select 
            className="map-view-select" 
            value={severity} 
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option>All Severities</option>
            <option>High Risk</option>
            <option>Medium Risk</option>
            <option>Low Risk</option>
          </select>
        </div>

        {/* SIDEBAR METRIC LEGEND SYSTEM */}
        <div className="map-view-sidebar-legend">
          <span className="sidebar-legend-title">LEGEND</span>
          <div className="legend-item"><span className="dot dot-high"></span> High Risk</div>
          <div className="legend-item"><span className="dot dot-med"></span> Medium Risk</div>
          <div className="legend-item"><span className="dot dot-low"></span> Low Risk</div>
        </div>

        {/* ACTION PANEL BUTTON STACK */}
        <div className="map-view-action-buttons">
          <button className="btn-apply-filters" onClick={handleApplyFilters}>
            Apply Filters
          </button>
          <button className="btn-reset-filters" onClick={handleResetFilters}>
            Reset
          </button>
        </div>
      </div>

      {/* MAP VIEWPORT CANVA CONTEXT */}
      <div className="map-view-map-container">
        
        {/* FLOATING TOP UTILITY ACTIONS */}
        <div className="map-floating-top-actions">
          <button className="map-utility-hud-btn">Legend</button>
          <button className="map-utility-hud-btn">Layers</button>
        </div>

        <MapContainer 
          center={CABUYAO_CENTER} 
          zoom={14} 
          minZoom={13}
          maxZoom={18}
          maxBounds={CABUYAO_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          <Marker position={CABUYAO_CENTER}>
            <Popup>
              <strong>Cabuyao City Center</strong> <br /> 
              CDMS Spatial Analytics Connected.
            </Popup>
          </Marker>
        </MapContainer>

        {/* FLOATING RISK LEVEL BREAKDOWN OVERLAY CARD */}
        <div className="map-floating-risk-card">
          <span className="risk-card-title">Risk Level</span>
          <div className="risk-row"><span className="dot dot-high"></span> High (&gt;20 cases)</div>
          <div className="risk-row"><span className="dot dot-med"></span> Medium (10-20)</div>
          <div className="risk-row"><span className="dot dot-low"></span> Low (&lt;10)</div>
        </div>

      </div>

    </div>
  );
}

export default MapView;