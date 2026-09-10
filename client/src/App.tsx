import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { EmergencyModal } from './components/EmergencyModal';

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

export const App: React.FC = () => {
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  return (
    <LanguageProvider>
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-surface font-sans text-on-surface">
          <Header onOpenEmergencyModal={() => setEmergencyModalOpen(true)} />

          <div className="flex-1">
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
          </div>

          <Footer />

          {/* Global Emergency Helpline Dialer Modal */}
          <EmergencyModal
            isOpen={emergencyModalOpen}
            onClose={() => setEmergencyModalOpen(false)}
          />
        </div>
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
  );
};
