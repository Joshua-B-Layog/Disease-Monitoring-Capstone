import React from 'react';

const translations = {
  en: { 'Dashboard':'Dashboard','Manage Cases':'Manage Cases','Audit Reports':'Audit Reports','Map View':'Map View','User Accounts':'User Accounts','Settings':'Settings' },
  fil: { 'Dashboard':'Dashboard','Manage Cases':'Pamahalaan ang mga Kaso','Audit Reports':'Mga Ulat ng Pag-audit','Map View':'Pananaw ng Mapa','User Accounts':'Mga Account ng User','Settings':'Mga Setting' },
  id: { 'Dashboard':'Dasbor','Manage Cases':'Kelola Kasus','Audit Reports':'Laporan Audit','Map View':'Tampilan Peta','User Accounts':'Akun Pengguna','Settings':'Pengaturan' },
  vi: { 'Dashboard':'Bảng điều khiển','Manage Cases':'Quản lý ca bệnh','Audit Reports':'Báo cáo kiểm toán','Map View':'Xem bản đồ','User Accounts':'Tài khoản người dùng','Settings':'Cài đặt' },
  th: { 'Dashboard':'แดชบอร์ด','Manage Cases':'จัดการเคส','Audit Reports':'รายงานการตรวจสอบ','Map View':'มุมมองแผนที่','User Accounts':'บัญชีผู้ใช้','Settings':'การตั้งค่า' },
};

const Sidebar = ({ role, activeTab, setActiveTab, language }) => {
  const t = (key) => translations[language]?.[key] || key;
  // Define menu configurations
  const menuConfig = {
    CHO: [
      { name: 'Dashboard', icon: '📊' },
      { name: 'Manage Cases', icon: '📁' },
      { name: 'Audit Reports', icon: '🏘️' },
      { name: 'Map View', icon: '📍' },
      { name: 'User Accounts', icon: '👤' },
      { name: 'Settings', icon: '⚙️' }
    ],
    BHW: [
      { name: 'Dashboard', icon: '📊' },
      { name: 'Manage Cases', icon: '📋' },
      { name: 'Audit Reports', icon: '📁' },
      { name: 'Map View', icon: '🗺️' },
      { name: 'Settings', icon: '⚙️' },
    ]
  };

  const menuItems = menuConfig[role] || [];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h3>{role === 'CHO' ? 'CHO Admin' : 'BHW Portal'}</h3>
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