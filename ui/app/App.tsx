import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AdminAuthProvider } from './hooks/useAdminAuth';
import { HomePage } from './pages/HomePage';
import { ServiceDashboard } from './pages/ServiceDashboard';
import { ChaosControl } from './pages/ChaosControl';
import { FixItAgent } from './pages/FixItAgent';
import { SettingsPage } from './pages/SettingsPage';

export const App = () => {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServiceDashboard />} />
        <Route path="/chaos" element={<ChaosControl />} />
        <Route path="/fixit" element={<FixItAgent />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AdminAuthProvider>
  );
};
