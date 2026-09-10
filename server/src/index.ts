import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import weatherRoutes from './routes/weatherRoutes';
import aqiRoutes from './routes/aqiRoutes';
import alertRoutes from './routes/alertRoutes';
import riskRoutes from './routes/riskRoutes';
import emergencyReportRoutes from './routes/emergencyReportRoutes';
import incidentRoutes from './routes/incidentRoutes';
import fieldReportRoutes from './routes/fieldReportRoutes';
import resourceRoutes from './routes/resourceRoutes';
import guideRoutes from './routes/guideRoutes';
import aiRoutes from './routes/aiRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import earthquakeRoutes from './routes/earthquakeRoutes';
import geoRoutes from './routes/geoRoutes';
import facilitiesRoutes from './routes/facilitiesRoutes';
import advisoriesRoutes from './routes/advisoriesRoutes';
import languageRoutes from './routes/languageRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/aqi', aqiRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/emergency-reports', emergencyReportRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/field-reports', fieldReportRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/earthquakes', earthquakeRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/advisories', advisoriesRoutes);
// Centralized language service: translate / detect (dynamic content only);
// static UI strings are bundled in the frontend and never hit these routes.
app.use('/api', languageRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'JeevanGrid Core Disaster Engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    demoMode: process.env.DEMO_MODE === 'true',
  });
});

app.listen(PORT, () => {
  console.log(`🛡️ JeevanGrid Server running at http://localhost:${PORT}`);
});
