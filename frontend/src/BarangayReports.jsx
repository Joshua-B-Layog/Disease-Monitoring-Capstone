import React, { useState } from 'react';
import './BarangayReports.css';

export default function BarangayReports() {
  const [auditLogs] = useState([
    { id: 1, timestamp: 'Jun 07, 2026 02:15 PM', user: 'Dr. Santos (CHO)', action: 'Created', entity: 'Case Record', details: 'Added Dengue entry for Patient DG-901 (Niugan)' },
    { id: 2, timestamp: 'Jun 07, 2026 01:40 PM', user: 'Nurse Cruz (BHW)', action: 'Updated', entity: 'Case Record', details: 'Changed COVID-19 status to Recovered for CV-1102' },
    { id: 3, timestamp: 'Jun 07, 2026 11:15 AM', user: 'Admin Reyes (CHO)', action: 'Deleted', entity: 'Case Record', details: 'Removed duplicate Influenza A log item #FL-043' },
    { id: 4, timestamp: 'Jun 06, 2026 04:10 PM', user: 'SuperAdmin (System)', action: 'Created', entity: 'New User Account', details: 'Provisioned BHW account credentials for Sector Pulo' }
  ]);

  const [generatedFiles] = useState([
    { id: 1, title: 'Daily Summary Report - Jun 07.pdf', timestamp: 'Generated Today, 02:15 PM' },
    { id: 2, title: 'Weekly Barangay Heath Review - Wk 23.pdf', timestamp: 'Generated Yesterday, 05:00 PM' },
    { id: 3, title: 'Consolidated System Audit Logs - May.xlsx', timestamp: 'Generated Jun 01, 2026' }
  ]);

  return (
    <div className="reports-page-wrapper">
      <h2 className="reports-main-title">Audit Reports</h2>

      <div className="top-filter-bar">
        <select className="filter-dropdown">
          <option>Report Period</option>
          <option>Daily</option>
          <option>Weekly</option>
          <option>Monthly</option>
          <option>Yearly</option>
        </select>
        
        <input type="date" className="filter-date-input" />
        <input type="date" className="filter-date-input" />
        
        <select className="filter-dropdown">
          <option>Report Type</option>
          <option>Cases Summary</option>
          <option>User Activity</option>
          <option>System Audit</option>
          <option>Risk Analysis</option>
        </select>
        
        <button className="btn-primary-generate">Generate Report</button>
      </div>

      <div className="middle-split-container">
        <div className="left-reports-box">
          <h3 className="section-box-title">Generated Reports Logs</h3>
          {generatedFiles.map(file => (
            <div key={file.id} className="report-log-item">
              <div className="report-item-meta">
                <p>{file.title}</p>
                <small>{file.timestamp}</small>
              </div>
              <div className="action-btn-group">
                <button className="btn-action-outline">Download</button>
                <button className="btn-action-outline">View</button>
              </div>
            </div>
          ))}
        </div>

        <div className="right-stats-box">
          <h3 className="section-box-title">Quick Stats</h3>
          <div className="quick-stats-2x2">
            <div className="stat-square-card">
              <h4>156</h4>
              <p>Cases Added</p>
            </div>
            <div className="stat-square-card">
              <h4>43</h4>
              <p>Cases Updated</p>
            </div>
            <div className="stat-square-card">
              <h4>2</h4>
              <p>Cases Deleted</p>
            </div>
            <div className="stat-square-card">
              <h4>3</h4>
              <p>Accounts Created</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-table-card">
        <div className="table-top-header">
          <h3>Generated System Logs</h3>
          <div className="header-action-utilities">
            <button className="btn-action-outline">Export</button>
            <button className="btn-action-outline">Filter</button>
          </div>
        </div>

        <div className="sub-toolbar-row">
          <input placeholder="Search Logs..." className="table-search-input" />
          <select className="sm-toolbar-select"><option>All Actions</option></select>
          <select className="sm-toolbar-select"><option>All Users</option></select>
          <button className="btn-action-outline">📅 Date Range</button>
        </div>

        <table className="audit-log-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>CHO / BHW Name</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.timestamp}</td>
                <td>{log.user}</td>
                <td>
                  <span className={`status-badge ${
                    log.action === 'Created' ? 'badge-created' : 
                    log.action === 'Updated' ? 'badge-updated' : 'badge-deleted'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td>{log.entity}</td>
                <td>{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}