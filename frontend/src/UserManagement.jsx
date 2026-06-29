import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from './config';

const CHO_BARANGAYS = {
  'CHO Unit I': [
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
  'CHO Unit II': [
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

const normalize = (s) => (s || '').toLowerCase().replace(/[\s\-().]/g, '');

const getChoUnit = (barangayName) => {
  const n = normalize(barangayName);
  for (const [unit, list] of Object.entries(CHO_BARANGAYS)) {
    if (list.some(b => normalize(b) === n)) return unit;
  }
  return 'Unassigned';
};

const USERS_PER_PAGE = 10;

const EMPTY_FORM = {
  firstName: '', lastName: '', username: '', email: '', mobile: '',
  barangayId: '', isActive: true, password: '', generateTempPassword: true,
  role: 'BHW',
};

export default function UserManagement({ confirmDelete, fontScale, compactMode, dateFormat, loggedUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [barangayList, setBarangayList] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarangay, setFilterBarangay] = useState('All Barangays');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editQueueIndex, setEditQueueIndex] = useState(0);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [barangayOpen, setBarangayOpen] = useState(false);
  const barangayRef = useRef(null);

  const formatDate = (d) => {
    if (!d) return '\u2014';
    const dt = new Date(d);
    if (isNaN(dt)) return '\u2014';
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const y = String(dt.getFullYear());
    const yy = y.slice(2);
    const h = dt.getHours();
    const min = String(dt.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    if (dateFormat === 'DD/MM/YY') return `${day}/${m}/${yy} ${h12}:${min} ${ampm}`;
    if (dateFormat === 'YYYY-MM-DD') return `${y}-${m}-${day} ${h12}:${min} ${ampm}`;
    return `${m}/${day}/${yy} ${h12}:${min} ${ampm}`;
  };

  const fetchUsers = () => {
    setLoading(true);
    axios.get(API_URL + '/api/users')
      .then(res => { setUsers(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    axios.get(API_URL + '/api/barangays')
      .then(res => setBarangayList(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (barangayRef.current && !barangayRef.current.contains(e.target)) {
        setBarangayOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      String(u.user_id).includes(q);
    const matchesBarangay = filterBarangay === 'All Barangays' || u.barangay_name === filterBarangay;
    const matchesStatus = filterStatus === 'All Status' ||
      (filterStatus === 'Active' && u.is_active === 1) ||
      (filterStatus === 'Inactive' && u.is_active === 0);
    return matchesSearch && matchesBarangay && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * USERS_PER_PAGE, currentPage * USERS_PER_PAGE);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedUsers.length) setSelectedIds([]);
    else setSelectedIds(paginatedUsers.map(u => u.user_id));
  };

  const handleExportUsers = () => {
    const headers = 'User ID,Full Name,Username,Barangay,Role,Status,Email,Mobile\n';
    const rows = filteredUsers.map(u =>
      `"U-${String(u.user_id).padStart(3, '0')}","${u.full_name || ''}","${u.username || ''}","${u.barangay_name || ''}","${u.role || ''}","${u.is_active ? 'Active' : 'Inactive'}","${u.email || ''}","${u.mobile_number || ''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Cabuyao_CDMS_User_Registry.csv'; a.click();
  };

  const openAdd = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingUser(null);
    setSubmitMsg('');
    setShowModal(true);
  };

  const openEdit = (user) => {
    const [first, ...rest] = (user.full_name || '').split(' ');
    setFormData({
      firstName: first || '',
      lastName: rest.join(' ') || '',
      username: user.username || '',
      email: user.email || '',
      mobile: user.mobile_number || '',
      barangayId: user.assigned_barangay_id || '',
      isActive: user.is_active === 1,
      password: '',
      generateTempPassword: false,
      role: user.role || 'BHW',
    });
    setEditingUser(user);
    setSubmitMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitMsg('');

    // Client-side duplicate check against already-loaded users list
    const trimmedUsername = formData.username.trim().toLowerCase();
    const trimmedEmail = formData.email.trim().toLowerCase();
    const trimmedMobile = formData.mobile.trim();

    const duplicateUsername = users.find(u =>
        u.username.toLowerCase() === trimmedUsername &&
        (!editingUser || u.user_id !== editingUser.user_id)
    );
    const duplicateEmail = users.find(u =>
        (u.email || '').toLowerCase() === trimmedEmail &&
        (!editingUser || u.user_id !== editingUser.user_id)
    );
    const duplicateMobile = trimmedMobile && users.find(u =>
        (u.mobile_number || '').trim() === trimmedMobile &&
        (!editingUser || u.user_id !== editingUser.user_id)
    );

    if (duplicateUsername) {
        setSubmitMsg('Error: A user with this username already exists.');
        setSubmitLoading(false);
        return;
    }
    if (duplicateEmail) {
        setSubmitMsg('Error: A user with this email already exists.');
        setSubmitLoading(false);
        return;
    }
    if (duplicateMobile) {
        setSubmitMsg('Error: A user with this contact number already exists.');
        setSubmitLoading(false);
        return;
    }

    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      username: formData.username,
      email: formData.email,
      mobile: formData.mobile,
      barangayId: formData.barangayId,
      isActive: formData.isActive,
      role: formData.role,
      loggedUserId: loggedUserId || null,
    };
    if (!editingUser) {
      payload.password = formData.password;
      payload.generateTempPassword = formData.generateTempPassword;
    }

    try {
      if (editingUser) {
        await axios.put(`${API_URL}/api/users/${editingUser.user_id}`, payload);
        setSubmitMsg('User updated successfully!');
      } else {
        await axios.post(API_URL + '/api/users', payload);
        setSubmitMsg('User account created successfully!');
      }
      fetchUsers();
      const nextIdx = editQueueIndex + 1;
      if (selectedIds.length > 1 && nextIdx < selectedIds.length && editingUser && selectedIds.includes(editingUser.user_id)) {
        setEditQueueIndex(nextIdx);
        const nextUser = users.find(u => u.user_id === selectedIds[nextIdx]);
        if (nextUser) {
          setSubmitMsg('');
          setSubmitLoading(false);
          setShowModal(false);
          setTimeout(() => openEdit(nextUser), 100);
          return;
        }
      }
      setTimeout(() => { setShowModal(false); setSubmitMsg(''); setSubmitLoading(false); setEditQueueIndex(0); setSelectedIds([]); }, 1200);
    } catch (err) {
      setSubmitMsg('Error: ' + (err.response?.data?.error || err.message));
      setSubmitLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (bulkDeleteMode) {
        for (const id of selectedIds) {
          await axios.delete(`${API_URL}/api/users/${id}`);
        }
        fetchUsers();
        setBulkDeleteMode(false);
        setSelectedIds([]);
        setDeleteTarget(null);
      } else {
        await axios.delete(`${API_URL}/api/users/${deleteTarget.user_id}`);
        fetchUsers();
        setDeleteTarget(null);
      }
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderBarangayOptions = () => (
    <>
      <option value="">— Select Barangay —</option>
      <optgroup label="CHO Unit I">
        {barangayList.filter(b => getChoUnit(b.name) === 'CHO Unit I').map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </optgroup>
      <optgroup label="CHO Unit II">
        {barangayList.filter(b => getChoUnit(b.name) === 'CHO Unit II').map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </optgroup>
    </>
  );

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid #d1d5db', background: '#f9fafb', color: '#1f2937',
    fontSize: '14px', boxSizing: 'border-box', outline: 'none'
  };

  return (
    <div style={{ padding: compactMode ? '14px' : '24px', color: '#1e293b' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a', fontWeight: '700' }}>User Accounts</h2>
        <button onClick={handleExportUsers}
          style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', fontWeight: '500' }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export Accounts List
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', padding: compactMode ? '12px' : '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="Search Accounts..."
            value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{ ...inputStyle, width: '220px' }} />
          <div style={{ position: 'relative', width: '180px' }} ref={barangayRef}>
            <button
              onClick={() => setBarangayOpen(!barangayOpen)}
              style={{ ...inputStyle, width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
            >
              <span>{filterBarangay}</span>
              <span style={{ marginLeft: '6px', opacity: 0.6 }}>▾</span>
            </button>
            {barangayOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                maxHeight: '250px', overflowY: 'auto', marginTop: '4px',
                background: '#fff', border: '1px solid #e2e8f0',
                borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}>
                <div
                  onClick={() => { setFilterBarangay('All Barangays'); setCurrentPage(1); setBarangayOpen(false); }}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                    background: filterBarangay === 'All Barangays' ? '#eff6ff' : 'transparent',
                    color: filterBarangay === 'All Barangays' ? '#2563eb' : '#334155',
                    fontWeight: filterBarangay === 'All Barangays' ? '600' : '400',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => { e.currentTarget.style.background = filterBarangay === 'All Barangays' ? '#eff6ff' : 'transparent'; }}
                >
                  All Barangays
                </div>
                {barangayList.map(b => (
                  <div
                    key={b.id}
                    onClick={() => { setFilterBarangay(b.name); setCurrentPage(1); setBarangayOpen(false); }}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                      background: filterBarangay === b.name ? '#eff6ff' : 'transparent',
                      color: filterBarangay === b.name ? '#2563eb' : '#334155',
                      fontWeight: filterBarangay === b.name ? '600' : '400',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => { e.currentTarget.style.background = filterBarangay === b.name ? '#eff6ff' : 'transparent'; }}
                  >
                    {b.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            style={{ ...inputStyle, width: '140px' }}>
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
          {selectedIds.length > 0 && (
            <>
              <button onClick={() => {
                setEditQueueIndex(0);
                openEdit(users.find(u => u.user_id === selectedIds[0]));
              }}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>
                Edit Selected ({selectedIds.length})
              </button>
              <button onClick={() => {
                setBulkDeleteMode(true);
                setDeleteTarget({ user_id: null, full_name: `${selectedIds.length} accounts`, barangay_name: '' });
              }}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>
                Delete Selected ({selectedIds.length})
              </button>
            </>
          )}
          <button onClick={openAdd}
            style={{ marginLeft: selectedIds.length > 0 ? '0' : 'auto', padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
            + Add User
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading accounts from database...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '13px' }}>
                <th style={{ padding: compactMode ? '7px 6px' : '12px 10px' }}>
                  <input type="checkbox"
                    checked={paginatedUsers.length > 0 && selectedIds.length === paginatedUsers.length}
                    onChange={toggleSelectAll} />
                </th>
                <th style={{ padding: compactMode ? '7px 6px' : '12px 10px', fontWeight: '600' }}>User ID</th>
                <th style={{ padding: compactMode ? '7px 6px' : '12px 10px', fontWeight: '600' }}>Name</th>
                <th style={{ padding: compactMode ? '7px 6px' : '12px 10px', fontWeight: '600' }}>Barangay</th>
                <th style={{ padding: compactMode ? '7px 6px' : '12px 10px', fontWeight: '600' }}>Role</th>
                <th style={{ padding: compactMode ? '7px 6px' : '12px 10px', fontWeight: '600' }}>Status</th>
                <th style={{ padding: compactMode ? '7px 6px' : '12px 10px', fontWeight: '600' }}>Last Login</th>
                <th style={{ padding: compactMode ? '7px 6px' : '12px 10px', fontWeight: '600', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No accounts found.</td></tr>
              ) : (
                paginatedUsers.map(user => (
                  <tr key={user.user_id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px', color: '#334155' }}>
                    <td style={{ padding: compactMode ? '8px 6px' : '15px 10px' }}>
                      <input type="checkbox" checked={selectedIds.includes(user.user_id)} onChange={() => toggleSelect(user.user_id)} />
                    </td>
                    <td style={{ padding: compactMode ? '8px 6px' : '15px 10px' }}>U-{String(user.user_id).padStart(3, '0')}</td>
                    <td style={{ padding: compactMode ? '8px 6px' : '15px 10px', fontWeight: '500' }}>{user.full_name}</td>
                    <td style={{ padding: compactMode ? '8px 6px' : '15px 10px' }}>{user.barangay_name || '—'}</td>
                    <td style={{ padding: compactMode ? '8px 6px' : '15px 10px' }}>{user.role}</td>
                    <td style={{ padding: compactMode ? '8px 6px' : '15px 10px' }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
                        background: user.is_active ? '#dcfce7' : '#e2e8f0',
                        color: user.is_active ? '#16a34a' : '#64748b'
                      }}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: compactMode ? '8px 6px' : '15px 10px', color: '#94a3b8', fontSize: '13px' }}>
                      {formatDate(user.last_login)}
                    </td>
                    <td style={{ padding: compactMode ? '8px 6px' : '15px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button onClick={() => openEdit(user)} title="Edit"
                          style={{ padding: '6px 10px', border: '1px solid #93c5fd', background: '#eff6ff', borderRadius: '6px', cursor: 'pointer' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => {
                              if (confirmDelete) {
                                setDeleteTarget(user);
                              } else {
                                axios.delete(`${API_URL}/api/users/${user.user_id}`)
                                  .then(() => fetchUsers())
                                  .catch(err => alert('Delete failed: ' + (err.response?.data?.error || err.message)));
                              }
                            }} title="Delete"
                          style={{ padding: '6px 10px', border: '1px solid #fca5a5', background: '#fee2e2', borderRadius: '6px', cursor: 'pointer' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>
            Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * USERS_PER_PAGE + 1}–{Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} Accounts
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#cbd5e1' : '#475569' }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setCurrentPage(p)}
                style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', background: p === currentPage ? '#1e3a8a' : 'white', color: p === currentPage ? 'white' : '#475569', cursor: 'pointer', fontSize: '13px' }}>{p}</button>
            ))}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              style={{ width: '32px', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#cbd5e1' : '#475569' }}>›</button>
          </div>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '36px', width: '600px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>
              {editingUser ? 'Edit User Account' : 'Add New User'}
            </h3>

            {submitMsg && (
              <div style={{ background: submitMsg.startsWith('Error') ? '#fee2e2' : '#d1fae5', color: submitMsg.startsWith('Error') ? '#991b1b' : '#065f46', padding: '10px 14px', borderRadius: '8px', marginBottom: '18px', fontSize: '13px', fontWeight: '500' }}>
                {submitMsg.startsWith('Error') ? '❌' : '✅'} {submitMsg}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>Basic Information</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>First Name *</label>
                  <input type="text" required placeholder="Enter First Name" style={inputStyle}
                    value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Last Name *</label>
                  <input type="text" required placeholder="Enter Last Name" style={inputStyle}
                    value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Username *</label>
                  <input type="text" required placeholder="Username" style={inputStyle} readOnly={!!editingUser}
                    value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Email *</label>
                  <input type="email" required placeholder="Email" style={inputStyle}
                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Role *</label>
                <select required style={inputStyle} value={formData.role}
                  onChange={e => {
                    setFormData({ ...formData, role: e.target.value, barangayId: '' });
                  }}>
                  <option value="BHW">Barangay Health Worker (BHW)</option>
                  <option value="CHO">City Health Office (CHO)</option>
                </select>
              </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Contact Number *</label>
                  <input type="text" required placeholder="Contact Number" style={inputStyle}
                    value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 11) })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '5px', fontWeight: '500' }}>Barangay Assignment *</label>
                  <select required style={inputStyle} value={formData.barangayId}
                    onChange={e => setFormData({ ...formData, barangayId: e.target.value })}>
                    {renderBarangayOptions()}
                  </select>
                </div>
              </div>

              <p style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '20px 0 12px 0' }}>Account Settings</p>

              {!editingUser && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer', marginBottom: '10px' }}>
                    <input type="checkbox" checked={formData.generateTempPassword}
                      onChange={e => setFormData({ ...formData, generateTempPassword: e.target.checked })} />
                    Generate temporary password
                  </label>
                  <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#94a3b8' }}>Password will be emailed to user</p>
                  {!formData.generateTempPassword && (
                    <input type="password" placeholder="Set a password" style={inputStyle}
                      value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  )}
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: '500' }}>Status</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
                    <input type="radio" checked={formData.isActive} onChange={() => setFormData({ ...formData, isActive: true })} /> Active
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#334155', cursor: 'pointer' }}>
                    <input type="radio" checked={!formData.isActive} onChange={() => setFormData({ ...formData, isActive: false })} /> Inactive
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => {
                  const nextIdx = editQueueIndex + 1;
                  if (selectedIds.length > 1 && nextIdx < selectedIds.length && editingUser && selectedIds.includes(editingUser.user_id)) {
                    setEditQueueIndex(nextIdx);
                    const nextUser = users.find(u => u.user_id === selectedIds[nextIdx]);
                    if (nextUser) {
                      setShowModal(false);
                      setTimeout(() => openEdit(nextUser), 100);
                      return;
                    }
                  }
                  setEditQueueIndex(0);
                  setSelectedIds([]);
                  setShowModal(false);
                }}
                  style={{ padding: '10px 24px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', color: '#475569', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitLoading}
                  style={{ padding: '10px 28px', background: submitLoading ? '#6ee7b7' : '#10b981', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: 'white', cursor: submitLoading ? 'not-allowed' : 'pointer' }}>
                  {submitLoading ? 'Saving...' : (editingUser ? 'Update User' : 'Add User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '40px 32px', width: '420px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '700', color: '#111827' }}>Are you sure?</h3>
            <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
              This action cannot be undone.<br />{bulkDeleteMode
                ? `This will permanently delete ${selectedIds.length} accounts. Are you sure?`
                : 'This will permanently delete the account of:'}
            </p>
            {!bulkDeleteMode && (
            <div style={{ background: '#f9fafb', borderLeft: '4px solid #ef4444', borderRadius: '6px', padding: '14px 18px', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ fontWeight: '700', color: '#111827', fontSize: '15px', marginBottom: '4px' }}>
                {deleteTarget.full_name} (U-{String(deleteTarget.user_id).padStart(3, '0')})
              </div>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>
                {deleteTarget.role === 'BHW' ? 'Barangay Health Worker' : 'City Health Office Admin'} — {deleteTarget.barangay_name || 'No barangay assigned'}
              </div>
            </div>
            )}
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 28px 0' }}>
              All associated case records will remain but show as "System" for audit purposes.
            </p>
            <div style={{ display: 'flex', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
              <button onClick={() => { setDeleteTarget(null); setBulkDeleteMode(false); }} disabled={deleteLoading}
                style={{ flex: 1, padding: '14px', background: 'transparent', border: 'none', borderRight: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '16px', fontWeight: '500', color: '#374151' }}>
                Cancel
              </button>
              <button onClick={executeDelete} disabled={deleteLoading}
                style={{ flex: 1, padding: '14px', background: '#ef4444', border: 'none', cursor: deleteLoading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: '600', color: '#fff' }}>
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}