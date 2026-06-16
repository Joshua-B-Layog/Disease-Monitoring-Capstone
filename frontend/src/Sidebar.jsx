import React from 'react';

const Sidebar = ({ role, activeTab, setActiveTab }) => {
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
      { name: 'Dashboard', icon: '🏠' },
      { name: 'New Case Report', icon: '➕' },
      { name: 'My Barangay', icon: '📍' },
      { name: 'My Reports', icon: '📄' },
      { name: 'Profile', icon: '👤' }
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
            {item.icon} {item.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;