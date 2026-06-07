import React from 'react';

export default function UserManagement() {
  const userAccounts = [
    { id: 'JS01', name: 'Juan D.', barangay: 'Brgy. Uno', role: 'BHW', status: 'Active', lastLogin: 'Today, 9:00 AM' },
    { id: 'JS02', name: 'Maria K.', barangay: 'Brgy. Dos', role: 'BHW', status: 'Active', lastLogin: 'Today, 12:00 PM' },
    { id: 'JS03', name: 'Pedro S.', barangay: 'Brgy. Tres', role: 'BHW', status: 'Inactive', lastLogin: 'Mar 20, 2024' }
  ];

  // REAL BROWSER EXPORT METHOD USING YOUR DATA ARRAY
  const handleExportUsers = () => {
    const csvHeaders = 'User ID,Full Name,Barangay,System Role,Account Status,Last Session Timestamp\n';
    const csvRows = userAccounts.map(u => 
      `"${u.id}","${u.name}","${u.barangay}","${u.role}","${u.status}","${u.lastLogin}"`
    ).join('\n');

    const blob = new Blob([csvHeaders + csvRows], { type: 'text/csv;charset=utf-8;' });
    const blobURL = URL.createObjectURL(blob);
    
    const tempDownloadLink = document.createElement('a');
    tempDownloadLink.href = blobURL;
    tempDownloadLink.setAttribute('download', 'Cabuyao_CDMS_User_Registry.csv');
    document.body.appendChild(tempDownloadLink);
    tempDownloadLink.click();
    document.body.removeChild(tempDownloadLink);
  };

  return (
    <div style={{ padding: '20px', color: '#1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', color: '#f8fafc' }}>User Accounts</h2>
        
        {/* HOOKED EXPORT CLICK HANDLER HERE */}
        <button 
          onClick={handleExportUsers}
          style={{ 
            background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', 
            padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' 
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          Export Accounts List
        </button>
      </div>

      {/* Keep your table rendering code exactly the same as you had it below... */}
      <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
         {/* ... Rest of your filtering layouts and <table> code remains untouched ... */}
         <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
           <thead>
             <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '14px' }}>
               <th style={{ padding: '15px 10px' }}><input type="checkbox" /></th>
               <th style={{ padding: '15px 10px', fontWeight: '600' }}>User ID</th>
               <th style={{ padding: '15px 10px', fontWeight: '600' }}>Name</th>
               <th style={{ padding: '15px 10px', fontWeight: '600' }}>Barangay</th>
               <th style={{ padding: '15px 10px', fontWeight: '600' }}>Role</th>
               <th style={{ padding: '15px 10px', fontWeight: '600' }}>Status</th>
               <th style={{ padding: '15px 10px', fontWeight: '600' }}>Last Login</th>
               <th style={{ padding: '15px 10px', fontWeight: '600', textAlign: 'center' }}>Actions</th>
             </tr>
           </thead>
           <tbody>
             {userAccounts.map((user, index) => (
               <tr key={index} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '14px', color: '#334155' }}>
                 <td style={{ padding: '15px 10px' }}><input type="checkbox" /></td>
                 <td style={{ padding: '15px 10px' }}>{user.id}</td>
                 <td style={{ padding: '15px 10px' }}>{user.name}</td>
                 <td style={{ padding: '15px 10px' }}>{user.barangay}</td>
                 <td style={{ padding: '15px 10px' }}>{user.role}</td>
                 <td style={{ padding: '15px 10px' }}>
                   <span style={{ 
                     padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
                     background: user.status === 'Active' ? '#dcfce7' : '#e2e8f0',
                     color: user.status === 'Active' ? '#16a34a' : '#64748b'
                   }}>
                     {user.status}
                   </span>
                 </td>
                 <td style={{ padding: '15px 10px', color: '#64748b' }}>{user.lastLogin}</td>
                 <td style={{ padding: '15px 10px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                   <button style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>📝</button>
                   <button style={{ padding: '6px 12px', border: '1px solid #fca5a5', borderRadius: '4px', background: '#fee2e2', cursor: 'pointer' }}>🗑️</button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
      </div>
    </div>
  );
}