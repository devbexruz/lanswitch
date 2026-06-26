import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import SettingsModal from '../components/SettingsModal';
import './MainLayout.css';

const MainLayout: React.FC = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  return (
    <div className="main-layout">
      <Sidebar 
        isExpanded={isSidebarExpanded} 
        toggleSidebar={toggleSidebar} 
        openSettings={() => setIsSettingsOpen(true)} 
      />
      <div className="main-content-wrapper">
        <Header isSidebarExpanded={isSidebarExpanded} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default MainLayout;
