import React, { useState } from 'react';
import './ManageCases.css';

const ManageCases = () => {
  const [view, setView] = useState('categories'); // categories, list, add
  const [selectedDisease, setSelectedDisease] = useState(null);
  

  // Move your diseases array into a useState hook right at the top of ManageCases
const [diseases, setDiseases] = useState([
  { id: 1, name: 'Dengue Fever', count: 45, icon: '🌡️', color: '#ef4444', desc: 'A viral infection transmitted by Aedes mosquitoes.' },
  { id: 2, name: 'Influenza A', count: 23, icon: '🦠', color: '#f59e0b', desc: 'A highly contagious respiratory illness.' },
  { id: 3, name: 'Covid-19', count: 12, icon: '🛡️', color: '#3b82f6', desc: 'Respiratory disease caused by SARS-CoV-2.' },
  { id: 4, name: 'Leptospirosis', count: 8, icon: '💧', color: '#10b981', desc: 'Bacterial disease spread through contaminated water.' }
]);

const [cases, setCases] = useState([
  { id: 'D-2026-001', name: 'Juan D.', barangay: 'Brgy. Uno', date: 'Jan 21, 2026', status: 'Active', disease: 'Dengue Fever' },
  { id: 'D-2026-002', name: 'Maria K.', barangay: 'Brgy. Dos', date: 'Feb 11, 2026', status: 'Recovered', disease: 'Dengue Fever' },
  { id: 'C-2026-001', name: 'Ana Lim', barangay: 'Pulo', date: 'Mar 05, 2026', status: 'Active', disease: 'Covid-19' },
  { id: 'C-2026-002', name: 'Pedro R.', barangay: 'Niugan', date: 'Mar 12, 2026', status: 'Critical', disease: 'Covid-19' },
  { id: 'I-2026-001', name: 'Carlos M.', barangay: 'Cabuyao Proper', date: 'Apr 02, 2026', status: 'Active', disease: 'Influenza A' },
  { id: 'L-2026-001', name: 'Luz ViMinda', barangay: 'Banlic', date: 'May 15, 2026', status: 'Active', disease: 'Leptospirosis' }
]);

  // Form State
  const [formData, setFormData] = useState({
    patientName: '', diseaseType: '', age: '', severity: 'Moderate', gender: 'Male', 
    status: 'Under Treatment', contact: '', onsetDate: '', address: '', symptoms: ''
  });

  const handleAddCase = async (e) => {
    e.preventDefault();
    // Mid-fidelity backend call
    try {
        const response = await fetch('http://localhost:5000/api/cases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, diseaseType: selectedDisease || formData.diseaseType })
        });
        if (response.ok) {
            alert("Case Saved Successfully!");
            setView('list');
        }
    } catch (error) {
        console.error("Save failed", error);
    }
  };

  // --- SUB-VIEW: DISEASE SELECTION ---
  if (view === 'categories') {
    return (
      <div className="manage-cases-container">
        <div className="breadcrumb">Dashboard / Manage Cases</div>
        <h2 className="view-title">Select a Disease to Manage</h2>
        <p className="view-subtitle">Choose which disease program you want to view, add, or manage cases for</p>
        
        <div className="disease-grid">
          {diseases.map(d => (
            <div key={d.id} className="disease-card" onClick={() => { setSelectedDisease(d.name); setView('list'); }}>
              <div className="card-header">
                <span className="card-icon">{d.icon}</span>
                <div className="card-info">
                    <h3>{d.name}</h3>
                    <p>{d.count} Active cases</p>
                </div>
                <span className="count-badge" style={{backgroundColor: d.color}}>{d.count}</span>
              </div>
              <div className="card-body"><p>{d.desc}</p></div>
              <div className="card-footer">View Cases <span>→</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- SUB-VIEW: CASE LIST ---
  if (view === 'list') {
    // THIS IS THE MAGIC LINE: We filter the cases based on the card you clicked!
    const filteredCases = cases.filter((c) => c.disease === selectedDisease);

    return (
      <div className="manage-cases-container">
        {/* FIX 1: Added flex layout to the header row to push buttons to the right */}
        <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>{selectedDisease} Cases</h2>
            
            {/* FIX 2: Added 'display: flex' and 'gap: 12px' to separate the Back and Add Case buttons */}
            <div className="action-btns" style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn-secondary" 
                  onClick={() => setView('categories')}
                  style={{ padding: '8px 16px', background: '#4b5563', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Back
                </button>
                <button 
                  className="btn-primary" 
                  onClick={() => setView('add')}
                  // Styled green to match your Figma design
                  style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  + Add Case
                </button>
            </div>
        </div>

        <div className="table-card">
          <div className="table-filters" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input type="text" placeholder="Search Cases..." className="search-input" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #374151', background: '#1f2937', color: 'white' }} />
            <select className="filter-select" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #374151', background: '#1f2937', color: 'white' }}><option>All Barangays</option></select>
            <select className="filter-select" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #374151', background: '#1f2937', color: 'white' }}><option>All Status</option></select>
          </div>
          
          <table className="custom-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <th style={{ padding: '12px' }}>Case ID</th>
                <th style={{ padding: '12px' }}>Patient</th>
                <th style={{ padding: '12px' }}>Barangay</th>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length > 0 ? (
                filteredCases.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #374151' }}>
                    <td style={{ padding: '12px' }}>{c.id}</td>
                    <td style={{ padding: '12px' }}>{c.name}</td>
                    <td style={{ padding: '12px' }}>{c.barangay}</td>
                    <td style={{ padding: '12px' }}>{c.date}</td>
                    <td style={{ padding: '12px' }}><span className={`pill ${c.status.toLowerCase()}`}>{c.status}</span></td>
                    
                    <td style={{ padding: '12px' }}>
                      {/* FIX 3: Added flex and gap to separate the Edit and Delete buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="edit-btn" 
                          // Styled with an outline to match your Figma design
                          style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #64748b', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          📝
                        </button>
                        <button 
                          className="del-btn" 
                          // Styled with a red outline to match your Figma design
                          style={{ padding: '4px 8px', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                    No dummy records found for {selectedDisease} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- SUB-VIEW: ADD FORM ---
  // --- SUB-VIEW: ADD FORM ---
  if (view === 'add') {
    // Reusable style for inputs to match the clean Figma look
    const inputStyle = {
      width: '100%', padding: '10px', borderRadius: '6px', 
      border: '1px solid #d1d5db', background: '#f9fafb', color: '#1f2937', 
      fontSize: '14px', boxSizing: 'border-box'
    };

    // We check what the current selection is. 
    const currentDiseaseSelection = formData.diseaseType || selectedDisease;

    return (
      <div className="manage-cases-container">
        <button 
          onClick={() => setView('list')} 
          style={{ background: 'transparent', border: 'none', color: '#f8fafc', cursor: 'pointer', marginBottom: '20px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          ← Go Back
        </button>
        
        {/* Main Form Card - Styled like your Figma layout */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '40px', color: '#1e293b', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#0f172a' }}>New Case Report</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Barangay Health Worker: CHO Admin | Barangay: Cabuyao Proper
            </p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            
            const targetDisease = formData.diseaseType || selectedDisease;
            
            const newCase = {
              id: `${targetDisease.charAt(0)}-2026-00${cases.length + 1}`,
              name: formData.patientName || 'New Patient',
              barangay: formData.address || 'Cabuyao Proper',
              date: formData.onsetDate || 'Jun 07, 2026',
              status: formData.status || 'Active',
              disease: targetDisease, 
              specificDisease: formData.specificDisease || '' 
            };
            
            // 1. Add the new case to the table
            setCases([newCase, ...cases]);
            
            // 2. STATICAL CONTEXT: Increment the category counter immediately
            setDiseases(prevDiseases => 
              prevDiseases.map(d => 
                d.name === targetDisease ? { ...d, count: d.count + 1 } : d
              )
            );
            
            if (formData.diseaseType) {
              setSelectedDisease(formData.diseaseType);
            }
            
            alert("Case Saved Locally Successfully!");
            setView('list'); 
          }}>
                      
            {/* 2-Column Grid Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '20px' }}>
              
              {/* LEFT COLUMN: Patient Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <h4 style={{ margin: 0, color: '#334155', fontSize: '14px', fontWeight: '600', textAlign: 'left' }}>Patient Information</h4>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Patient Full Name</label>
                  <input type="text" required placeholder="e.g. Juan Dela Cruz" style={inputStyle} onChange={(e) => setFormData({...formData, patientName: e.target.value})} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Age</label>
                    <input type="number" placeholder="Insert your age" style={inputStyle} onChange={(e) => setFormData({...formData, age: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Gender</label>
                    <select style={inputStyle} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                        <option>Male</option><option>Female</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Contact No.</label>
                  <input type="text" placeholder="0918-234-2331" style={inputStyle} onChange={(e) => setFormData({...formData, contact: e.target.value})} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Address</label>
                  <input type="text" placeholder="123 Rizal St, San Isidro" style={inputStyle} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>

              {/* RIGHT COLUMN: Clinical Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <h4 style={{ margin: 0, color: '#334155', fontSize: '14px', fontWeight: '600', textAlign: 'left' }}>Clinical Information</h4>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Disease Type</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select 
                      style={{...inputStyle, flex: '1'}} 
                      defaultValue={selectedDisease} 
                      onChange={(e) => setFormData({...formData, diseaseType: e.target.value})}
                    >
                        <option value="Dengue Fever">Dengue Fever</option>
                        <option value="Influenza A">Influenza A</option>
                        <option value="Covid-19">Covid-19</option>
                        <option value="Leptospirosis">Leptospirosis</option>
                        <option value="Tuberculosis">Tuberculosis</option>
                        <option value="Other Communicable Diseases">Other Communicable Diseases</option>
                    </select>

                    {currentDiseaseSelection === 'Other Communicable Diseases' && (
                      <input 
                        type="text" 
                        placeholder="Specify disease..." 
                        style={{...inputStyle, flex: '1'}} 
                        onChange={(e) => setFormData({...formData, specificDisease: e.target.value})}
                        required
                      />
                    )}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Severity Level</label>
                  <select style={inputStyle} onChange={(e) => setFormData({...formData, severity: e.target.value})}>
                    <option>Mild</option><option>Moderate</option><option>Severe</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Patient Status</label>
                  <select style={inputStyle} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option>Active</option><option>Recovered</option><option>Critical</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Date of Onset</label>
                  <input type="date" style={inputStyle} onChange={(e) => setFormData({...formData, onsetDate: e.target.value})} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Attending Physician</label>
                  <input type="text" placeholder="Dr. Jose Reyes, MD" style={inputStyle} onChange={(e) => setFormData({...formData, physician: e.target.value})} />
                </div>
              </div>
            </div>

            {/* FULL WIDTH: Symptoms Section */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Symptoms & Observations</label>
              <textarea 
                placeholder="Fever (39.5°C), Severe Headache, Muscle and Joint Pain..." 
                rows="4" 
                style={{...inputStyle, resize: 'vertical'}} 
                onChange={(e) => setFormData({...formData, symptoms: e.target.value})}
              ></textarea>
            </div>

            {/* NEW: Map Placeholder & Coordinates (Fills the gap!) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', textAlign: 'left' }}>Location & Coordinates</label>
                <input 
                  type="text" 
                  placeholder="12.2253° N, 121.3025° E" 
                  style={inputStyle} 
                  onChange={(e) => setFormData({...formData, coordinates: e.target.value})} 
                />
              </div>
              
              {/* Dummy Map Box */}
              <div style={{
                width: '100%', height: '80px', background: '#e2e8f0', borderRadius: '6px',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                border: '1px dashed #94a3b8', color: '#64748b', fontSize: '14px', fontWeight: '500'
              }}>
                📍 Map Integration (Placeholder)
              </div>
            </div>

            {/* Figma-Matched Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '30px' }}>
              <button type="button" onClick={() => setView('list')} style={{ padding: '10px 32px', borderRadius: '6px', border: 'none', background: '#e2e8f0', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>
                Cancel
              </button>
              <button type="button" style={{ padding: '10px 32px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: '500' }}>
                Save As Draft
              </button>
              <button type="submit" style={{ padding: '10px 32px', borderRadius: '6px', border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontWeight: '500' }}>
                Save Case
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}

export default ManageCases;