import React from 'react';
import ChoLogoIcon from './assets/ChoLogo';
import ChoLogoIconII from './assets/ChoLogoII';

const DashboardIcon = ({ color = '#1E3A8A', size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ verticalAlign: 'middle', marginRight: '6px' }}>
    <path fill={color} d="M19,3H5C2.239,3,0,5.239,0,8v8c0,2.761,2.239,5,5,5h14c2.761,0,5-2.239,5-5V8c0-2.761-2.239-5-5-5ZM6.802,17.359c-1.909-.449-3.404-2.058-3.729-3.992-.469-2.791,1.377-5.249,3.927-5.767v4.485c0,.53,.211,1.039,.586,1.414l3.169,3.169c-1.093,.724-2.482,1.036-3.952,.691Zm5.366-2.105l-2.876-2.876c-.188-.188-.293-.442-.293-.707V7.601c2.282,.463,4,2.48,4,4.899,0,1.019-.308,1.964-.832,2.754Zm7.832,1.746h-3c-.552,0-1-.448-1-1h0c0-.552,.448-1,1-1h3c.552,0,1,.448,1,1h0c0,.552-.448,1-1,1Zm0-4h-3c-.552,0-1-.448-1-1h0c0-.552,.448-1,1-1h3c.552,0,1,.448,1,1h0c0,.552-.448,1-1,1Zm0-4h-3c-.552,0-1-.448-1-1h0c0-.552,.448-1,1-1h3c.552,0,1,.448,1,1h0c0,.552-.448,1-1,1Z"/>
  </svg>
);

const CaseMgmtIcon = ({ color = '#f59e0b', size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ verticalAlign: 'middle', marginRight: '6px' }}>
    <path fill={color} d="m14 7v-6.54a6.977 6.977 0 0 1 2.465 1.59l3.484 3.486a6.954 6.954 0 0 1 1.591 2.464h-6.54a1 1 0 0 1 -1-1zm8 3.485v8.515a5.006 5.006 0 0 1 -5 5h-10a5.006 5.006 0 0 1 -5-5v-14a5.006 5.006 0 0 1 5-5h4.515c.163 0 .324.013.485.024v6.976a3 3 0 0 0 3 3h6.976c.011.161.024.322.024.485zm-6 6.515a1 1 0 0 0 -1-1h-2v-2a1 1 0 0 0 -2 0v2h-2a1 1 0 0 0 0 2h2v2a1 1 0 0 0 2 0v-2h2a1 1 0 0 0 1-1z"/>
  </svg>
);

const AuditIcon = ({ color = '#8b5cf6', size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ verticalAlign: 'middle', marginRight: '6px' }}>
    <path fill={color} d="m19.414,5h-4.414V.586l4.414,4.414Zm3.148,18.976l-3.089-3.089c-.981.698-2.177,1.113-3.473,1.113-3.314,0-6-2.686-6-6s2.686-6,6-6,6,2.686,6,6c0,1.296-.415,2.492-1.113,3.473l3.089,3.089-1.414,1.414Zm-5.81-5.537l3.607-3.696-1.398-1.43-3.614,3.703-2.216-2.301-1.387,1.441,2.182,2.268c.766.765,2.079.763,2.823.019l.004-.004Zm-8.163.56h-4.589v-2h4.069c-.041-.328-.069-.661-.069-1s.028-.672.069-1h-4.069v-2h4.589c.295-.726.692-1.398,1.176-2h-5.765v-2h8.136c1.147-.636,2.463-1,3.864-1,1.458,0,2.822.398,4,1.082v-2.082h-7V0H3C1.343,0,0,1.343,0,3v21h16c-3.35,0-6.221-2.072-7.411-5Z"/>
  </svg>
);

const MapIcon = ({ color = '#10b981', size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ verticalAlign: 'middle', marginRight: '6px' }}>
    <path fill={color} d="m18.279,13.447l-6.28,6.251-6.278-6.25L.057,16.846l11.943,7.166,11.943-7.166-5.665-3.399Zm-1.329-11.397c-1.321-1.322-3.079-2.05-4.949-2.05s-3.628.728-4.95,2.05c-2.729,2.729-2.729,7.17.008,9.907l4.942,4.833,4.949-4.841c1.322-1.322,2.051-3.08,2.051-4.95s-.729-3.627-2.051-4.95Zm-4.949,7.94c-1.657,0-3-1.343-3-3s1.343-3,3-3,3,1.343,3,3-1.343,3-3,3Z"/>
  </svg>
);

const UserIcon = ({ color = '#0ea5e9', size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ verticalAlign: 'middle', marginRight: '6px' }}>
    <path fill={color} d="m16,23.314c-1.252.444-2.598.686-4,.686s-2.748-.242-4-.686v-2.314c0-2.206,1.794-4,4-4s4,1.794,4,4v2.314ZM12,7c-1.103,0-2,.897-2,2s.897,2,2,2,2-.897,2-2-.897-2-2-2Zm12,5c0,4.433-2.416,8.311-6,10.389v-1.389c0-3.309-2.691-6-6-6s-6,2.691-6,6v1.389C2.416,20.311,0,16.433,0,12,0,5.383,5.383,0,12,0s12,5.383,12,12Zm-8-3c0-2.206-1.794-4-4-4s-4,1.794-4,4,1.794,4,4,4,4-1.794,4-4Z"/>
  </svg>
);

const SettingsIcon = ({ color = '#64748b', size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ verticalAlign: 'middle', marginRight: '6px' }}>
    <path fill={color} d="M21,12a9.143,9.143,0,0,0-.15-1.645L23.893,8.6l-3-5.2L17.849,5.159A9,9,0,0,0,15,3.513V0H9V3.513A9,9,0,0,0,6.151,5.159L3.107,3.4l-3,5.2L3.15,10.355a9.1,9.1,0,0,0,0,3.29L.107,15.4l3,5.2,3.044-1.758A9,9,0,0,0,9,20.487V24h6V20.487a9,9,0,0,0,2.849-1.646L20.893,20.6l3-5.2L20.85,13.645A9.143,9.143,0,0,0,21,12Zm-6,0a3,3,0,1,1-3-3A3,3,0,0,1,15,12Z"/>
  </svg>
);

const translations = {
  en: { 'Dashboard':'Dashboard','Manage Cases':'Manage Cases','Audit Reports':'Audit Reports','Map View':'Map View','User Accounts':'User Accounts','Settings':'Settings' },
  fil: { 'Dashboard':'Dashboard','Manage Cases':'Pamahalaan ang mga Kaso','Audit Reports':'Mga Ulat ng Pag-audit','Map View':'Pananaw ng Mapa','User Accounts':'Mga Account ng User','Settings':'Mga Setting' },
  id: { 'Dashboard':'Dasbor','Manage Cases':'Kelola Kasus','Audit Reports':'Laporan Audit','Map View':'Tampilan Peta','User Accounts':'Akun Pengguna','Settings':'Pengaturan' },
  vi: { 'Dashboard':'Bảng điều khiển','Manage Cases':'Quản lý ca bệnh','Audit Reports':'Báo cáo kiểm toán','Map View':'Xem bản đồ','User Accounts':'Tài khoản người dùng','Settings':'Cài đặt' },
  th: { 'Dashboard':'แดชบอร์ด','Manage Cases':'จัดการเคส','Audit Reports':'รายงานการตรวจสอบ','Map View':'มุมมองแผนที่','User Accounts':'บัญชีผู้ใช้','Settings':'การตั้งค่า' },
};

const Sidebar = ({ role, activeTab, setActiveTab, language, choUnit }) => {
  const t = (key) => translations[language]?.[key] || key;
  // Define menu configurations
  const menuConfig = {
    CHO: [
      { name: 'Dashboard', icon: <DashboardIcon color="#1E3A8A" /> },
      { name: 'Manage Cases', icon: <CaseMgmtIcon color="#f59e0b" /> },
      { name: 'Audit Reports', icon: <AuditIcon color="#8b5cf6" /> },
      { name: 'Map View', icon: <MapIcon color="#10b981" /> },
      { name: 'User Accounts', icon: <UserIcon color="#0ea5e9" /> },
      { name: 'Settings', icon: <SettingsIcon color="#64748b" /> }
    ],
    BHW: [
      { name: 'Dashboard', icon: <DashboardIcon color="#1E3A8A" /> },
      { name: 'Manage Cases', icon: <CaseMgmtIcon color="#f59e0b" /> },
      { name: 'Audit Reports', icon: <AuditIcon color="#8b5cf6" /> },
      { name: 'Map View', icon: <MapIcon color="#10b981" /> },
      { name: 'Settings', icon: <SettingsIcon color="#64748b" /> },
    ]
  };

  const menuItems = menuConfig[role] || [];

  return (
    <div className="sidebar">
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {choUnit === 'CHO Unit II (Pulo)' ? <ChoLogoIconII size={28} /> : <ChoLogoIcon size={28} />}
        <h3 style={{ margin: 0 }}>{role === 'CHO' ? 'CHO Admin' : 'BHW Portal'}</h3>
      </div>
      <div className="sidebar-menu">
        {menuItems.map((item) => (
          <div 
            key={item.name}
            className={`menu-item ${activeTab === item.name ? 'active' : ''}`}
            onClick={() => setActiveTab(item.name)}
          >
            {item.icon} {t(item.name)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;