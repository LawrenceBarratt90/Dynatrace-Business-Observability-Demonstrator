import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ServiceDashboard } from './pages/ServiceDashboard';
import { ChaosControl } from './pages/ChaosControl';
import { FixItAgent } from './pages/FixItAgent';
import { SettingsPage } from './pages/SettingsPage';
import { DemoGuide } from './pages/DemoGuide';
import { SolutionsPage } from './pages/SolutionsPage';
import { DemonstratorDashboardsPage } from './pages/DemonstratorDashboardsPage';
import { VCARBDashboard } from './pages/VCARBDashboard';
import { VCARBPreRace } from './pages/VCARBPreRace';
import { VCARBLiveRace } from './pages/VCARBLiveRace';
import { trackUiUsage } from './services/usage-audit';

const normalizeToken = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const NavigationAuditTracker = () => {
  const location = useLocation();

  React.useEffect(() => {
    const pathToken = normalizeToken(location.pathname) || 'home';
    void trackUiUsage(`view-${pathToken}`, 'navigation', {
      pagePath: location.pathname,
      pageQuery: location.search || '',
    });
  }, [location.pathname, location.search]);

  return null;
};

export const App = () => {
  return (
    <>
      <NavigationAuditTracker />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServiceDashboard />} />
        <Route path="/chaos" element={<ChaosControl />} />
        <Route path="/fixit" element={<FixItAgent />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/demo-guide" element={<DemoGuide />} />
        <Route path="/solutions" element={<SolutionsPage />} />
        <Route path="/demonstrator-dashboards" element={<DemonstratorDashboardsPage />} />
        <Route path="/vcarb" element={<VCARBDashboard />} />
        <Route path="/vcarb/pre-race" element={<VCARBPreRace />} />
        <Route path="/vcarb/race" element={<VCARBLiveRace />} />
      </Routes>
    </>
  );
};
