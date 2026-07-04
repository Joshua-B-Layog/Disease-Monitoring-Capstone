import React from 'react';
import dashboardIcon from './assets/dashboard-panel.svg';
import caseMgmtIcon from './assets/case-management.svg';
import auditIcon from './assets/audit-reports.svg';
import mapIcon from './assets/map.svg';
import userIcon from './assets/user.svg';
import settingsIcon from './assets/settings.svg';
import choLogo from './assets/cho.svg';

const iconStyle = { width: 18, height: 18, verticalAlign: 'middle', marginRight: '6px' };
const Img = (src) => <img src={src} alt="" style={iconStyle} />;

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
      { name: 'Dashboard', icon: Img(dashboardIcon) },
      { name: 'Manage Cases', icon: Img(caseMgmtIcon) },
      { name: 'Audit Reports', icon: Img(auditIcon) },
      { name: 'Map View', icon: Img(mapIcon) },
      { name: 'User Accounts', icon: Img(userIcon) },
      { name: 'Settings', icon: Img(settingsIcon) }
    ],
    BHW: [
      { name: 'Dashboard', icon: Img(dashboardIcon) },
      { name: 'Manage Cases', icon: Img(caseMgmtIcon) },
      { name: 'Audit Reports', icon: Img(auditIcon) },
      { name: 'Map View', icon: Img(mapIcon) },
      { name: 'Settings', icon: Img(settingsIcon) },
    ]
  };

  const menuItems = menuConfig[role] || [];

  return (
    <div className="sidebar">
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src={choLogo} alt="CHO" style={{ width: '28px', height: '28px' }} />
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