import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { AssistantProvider } from './context/AssistantContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { EmergencyModal } from './components/EmergencyModal';
import { OfflineSyncManager } from './components/OfflineSyncManager';
import { MobileBottomNav } from './components/MobileBottomNav';

// Pages
import { LandingPage } from './pages/LandingPage';
import { RiskDashboardPage } from './pages/RiskDashboardPage';
import { EmergencyReportPage } from './pages/EmergencyReportPage';
import { AssistantPage } from './pages/AssistantPage';
import { AlertsPage } from './pages/AlertsPage';
import { GuidesPage } from './pages/GuidesPage';
import { GuideDetailPage } from './pages/GuideDetailPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

// Dashboards
import { DistrictDashboard } from './pages/dashboards/DistrictDashboard';
import { ResponderDashboard } from './pages/dashboards/ResponderDashboard';
import { HealthDashboard } from './pages/dashboards/HealthDashboard';
import { StateEocDashboard } from './pages/dashboards/StateEocDashboard';
import { VolunteerDashboard } from './pages/dashboards/VolunteerDashboard';

/**
 * Cross-fade between routes. A short, single transition so navigation feels
 * like the app is responding, not like the page is performing. Entrance only
 * — no exit animation, so the outgoing page never leaves a gap in the
 * layout while the next one settles.
 */
const RouteShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const reduce = useReducedMotion();

  // Every navigation starts at the top of the new page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  if (reduce) return <>{children}</>;

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

export const App: React.FC = () => {
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <AssistantProvider>
            <div className="flex min-h-[100dvh] flex-col bg-surface font-sans text-on-surface">
              <Header onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />

              <div className="flex-1">
                <RouteShell>
                  <Routes>
                    {/* Citizen Landing & Disaster Forecast */}
                    <Route path="/" element={<LandingPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />} />
                    <Route path="/risk" element={<RiskDashboardPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />} />
                    <Route path="/risk/:location" element={<RiskDashboardPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />} />

                    {/* Citizen Incident Reporting & AI Assistant */}
                    <Route path="/report-emergency" element={<EmergencyReportPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />} />
                    <Route path="/report" element={<EmergencyReportPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />} />
                    <Route path="/assistant" element={<AssistantPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />} />

                    {/* Live Alerts & Guides */}
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/guides" element={<GuidesPage />} />
                    <Route path="/guides/:slug" element={<GuideDetailPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />} />
                    <Route path="/resources" element={<ResourcesPage onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />} />

                    {/* Authentication */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Role-Based Operational Dashboards */}
                    <Route path="/dashboard/district" element={<DistrictDashboard />} />
                    <Route path="/dashboard/responder" element={<ResponderDashboard />} />
                    <Route path="/dashboard/health" element={<HealthDashboard />} />
                    <Route path="/dashboard/state" element={<StateEocDashboard />} />
                    <Route path="/dashboard/volunteer" element={<VolunteerDashboard />} />
                  </Routes>
                </RouteShell>
              </div>

              <Footer />
              <MobileBottomNav onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />
              <OfflineSyncManager />

              {/* Global Emergency Helpline Dialer */}
              <EmergencyModal
                isOpen={emergencyModalOpen}
                onClose={() => setEmergencyModalOpen(false)}
              />
            </div>
          </AssistantProvider>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};
