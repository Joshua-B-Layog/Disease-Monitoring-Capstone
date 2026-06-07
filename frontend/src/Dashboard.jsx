import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Dashboard = () => {
  // 1. STATE MANAGERS
  const [cases, setCases] = useState([]);
  const [selectedDisease, setSelectedDisease] = useState('Dengue');
  const [loading, setLoading] = useState(true);
  const [dateRange] = useState({ start: '2026-01-01', end: '2026-05-28' });

  // 2. GET LIVE API RECORDS
  useEffect(() => {
    axios.get('http://localhost:5000/api/disease_cases')
      .then((res) => {
        // Now pulling patient_name, severity, and joined names straight from MySQL!
        setCases(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error connecting to Backend API:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ color: 'white', padding: '20px' }}>Loading Live Dashboard Data...</div>;
  }

  // 3. LIVE STAT CARD CALCULATIONS
  const totalCases = cases.length;
  // Based on your database, it looks like active cases are marked as 'Approved'
  const activeCases = cases.filter(c => c.status === 'Approved' || c.status === 'Pending').length;
  const recoveredCases = cases.filter(c => c.status === 'Recovered').length;
  const deathCases = cases.filter(c => c.status === 'Deceased').length;

  // 4. DYNAMIC PROGRESS BAR CALCULATION
  // Filter cases by the disease selected in the dropdown
  const diseaseFilteredCases = cases.filter(
    c => c.disease_name && c.disease_name.toLowerCase() === selectedDisease.toLowerCase()
  );

  // Dynamically count cases per barangay based on the real names from your database JOIN
  const barangayCounts = {};
  diseaseFilteredCases.forEach(item => {
    // If a barangay name isn't found (e.g., missing data), fallback to its ID safely
    const name = item.barangay_name || `Barangay ID ${item.barangay_id}`;
    if (barangayCounts[name] === undefined) {
        barangayCounts[name] = 0;
    }
    barangayCounts[name] += 1;
  });

  // Calculate widths for the CSS progress bars
  const highestCaseCount = Math.max(...Object.values(barangayCounts), 1);
  const dynamicallyCalculatedBars = Object.keys(barangayCounts).map(name => {
    const count = barangayCounts[name];
    return {
      label: name,
      count: count,
      percentage: (count / highestCaseCount) * 100 
    };
  });

  // 5. RENDER INTERFACE
  return (
    <div className="dashboard-grid">
      {/* Top Stat Row */}
      <div className="stat-card">
        <div className="stat-label">Total Cases</div>
        <div className="stat-value">{totalCases}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Active</div>
        <div className="stat-value">{activeCases}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Recovered</div>
        <div className="stat-value">{recoveredCases}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Deaths</div>
        <div className="stat-value">{deathCases}</div>
      </div>

      {/* MAIN CHART AREA — Dynamically Renders the Bars */}
      <div className="chart-main">
        <h4 style={{ color: 'white', marginBottom: '20px' }}>{selectedDisease} Cases by Barangay</h4>
        
        {dynamicallyCalculatedBars.length > 0 ? dynamicallyCalculatedBars.map((barangay, index) => (
          <div key={index} className="chart-bar-row" style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <span className="chart-bar-label" style={{ minWidth: '140px', color: 'white' }}>
              {barangay.label} ({barangay.count})
            </span>
            <div className="chart-bar-track" style={{ flexGrow: 1, background: '#1e293b', height: '12px', borderRadius: '6px', overflow: 'hidden', marginLeft: '10px' }}>
              <div 
                className="chart-bar-fill" 
                style={{ 
                  width: `${barangay.percentage}%`, 
                  background: '#3b82f6', 
                  height: '100%',
                  transition: 'width 0.4s ease'
                }}
              ></div>
            </div>
          </div>
        )) : (
            <div style={{ color: '#9ca3af', fontSize: '13px' }}>No tracked cases found for {selectedDisease}.</div>
        )}
      </div>

      {/* LEFT SIDE: Filter & Controls */}
      <div className="chart-side">
        <h4 style={{ color: 'white', marginBottom: '20px' }}>Filter & Controls</h4>
        <label style={{ color: '#9ca3af', fontSize: '11px' }}>Select Disease</label>
        <select 
          className="date-input" 
          style={{ marginBottom: '15px', width: '100%', padding: '8px', background: '#1f2937', color: 'white', borderRadius: '4px' }}
          onChange={(e) => setSelectedDisease(e.target.value)}
          value={selectedDisease}
        >
          <option value="Dengue">Dengue</option>
          <option value="COVID-19">COVID-19</option>
        </select>

        <label style={{ color: '#9ca3af', fontSize: '11px' }}>Date Range</label>
        <input type="date" className="date-input" value={dateRange.start} readOnly style={{ width: '100%', marginBottom: '5px' }} />
        <input type="date" className="date-input" value={dateRange.end} readOnly style={{ width: '100%' }} />

        <div className="sidebar-controls" style={{ marginTop: '15px' }}>
          <button className="btn-action btn-export">Export Data</button>
          <button className="btn-action btn-print" style={{ marginTop: '5px' }}>Print Report</button>
        </div>
      </div>

      {/* Bottom Section: Recent Table */}
      <div className="recent-records">
        <h4 style={{ color: 'white', marginBottom: '15px' }}>Recent Case Reports</h4>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Patient Name</th>
              <th>Age</th>
              <th>Barangay</th>
              <th>Severity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const isActive = c.status === 'Approved' || c.status === 'Pending';
              
              return (
                <tr key={c.case_id}>
                  <td>#{String(c.case_id).padStart(3, '0')}</td>
                  {/* Pulling the REAL patient name directly from the DB! */}
                  <td>{c.patient_name || 'Unknown Patient'}</td>
                  {/* Age is hardcoded to '--' because it doesn't exist in the DB yet */}
                  <td>{c.age || '--'}</td>
                  {/* Pulling the REAL joined barangay name directly from the DB! */}
                  <td>{c.barangay_name || `ID: ${c.barangay_id}`}</td>
                  {/* Showing the real severity from the DB */}
                  <td>{c.severity || 'N/A'}</td>
                  <td>
                    <span className={isActive ? "status-pill status-active" : "status-pill status-recovered"}>
                      {isActive ? ` ${c.status}` : ` ${c.status}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;