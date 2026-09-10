import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';

interface LandingPageProps {
  onOpenEmergencyModal: () => void;
}

// Full-bleed hero background carousel (served from /public/hero-bg)
const HERO_BG_IMAGES = [
  '/hero-bg/image1.png',
  '/hero-bg/image2.png',
  '/hero-bg/image3.png',
  '/hero-bg/image4.png',
  '/hero-bg/image5.png',
];

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenEmergencyModal }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Hero carousel state — crossfade every 3s
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    // Preload all hero images upfront to prevent flickering
    HERO_BG_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_BG_IMAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Search input state
  const [searchInput, setSearchInput] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isCheckingRisk, setIsCheckingRisk] = useState(false);

  // Weather, AQI, Alerts telemetry state
  const [currentLocation, setCurrentLocation] = useState('Mumbai');
  const [weatherData, setWeatherData] = useState<any>(null);
  const [aqiData, setAqiData] = useState<any>(null);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [statusSummary, setStatusSummary] = useState<any>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(true);

  // Region Selector State
  const [selectedState, setSelectedState] = useState('Maharashtra');
  const [selectedDistrict, setSelectedDistrict] = useState('Mumbai Suburban');
  const [regionData, setRegionData] = useState({
    hazards: ['Urban Inundation', 'Coastal Surge', 'Cyclonic Winds'],
    seismic: 'Zone III Seismic Activity',
    vulnerability: 'Low to Moderate',
    vulnerabilityDesc: 'Normal baseline seasonal readiness. No red warnings active.',
    sheltersCount: 14,
    nearestUnit: 'NDRF Regional Response Hub',
    nearestUnitLocation: 'Andheri East Battalion Hub',
    nearestUnitPhone: '022-26840000',
  });

  // Carousel ref
  const carouselRef = useRef<HTMLDivElement>(null);

  // Fetch telemetry from backend
  useEffect(() => {
    async function loadTelemetry() {
      setTelemetryLoading(true);
      try {
        const [weatherRes, aqiRes, alertsRes] = await Promise.all([
          apiFetch(`/weather?location=${encodeURIComponent(currentLocation)}`),
          apiFetch(`/aqi?location=${encodeURIComponent(currentLocation)}`),
          apiFetch('/alerts'),
        ]);
        setWeatherData(weatherRes.weather);
        setAqiData(aqiRes.aqi);
        setActiveAlerts(alertsRes.alerts || []);
        setStatusSummary(alertsRes.summary || null);
      } catch (err) {
        console.warn('Telemetry load error, using fallbacks:', err);
      } finally {
        setTelemetryLoading(false);
      }
    }
    loadTelemetry();
  }, [currentLocation]);

  // Handle GPS location detection
  const handleDetectGPS = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In India demo, map coordinates or provide realistic district
          setSearchInput('Bandra West, Mumbai Suburban (400050)');
          setCurrentLocation('Mumbai');
          setIsLocating(false);
        },
        (error) => {
          // Graceful fallback if user denies or in testing environment
          setSearchInput('Bandra West, Mumbai Suburban (400050)');
          setCurrentLocation('Mumbai');
          setIsLocating(false);
        },
        { timeout: 5000 }
      );
    } else {
      setSearchInput('Bandra West, Mumbai Suburban (400050)');
      setIsLocating(false);
    }
  };

  // Handle Check Risk
  const handleCheckRisk = () => {
    if (!searchInput.trim()) {
      setSearchInput('Mumbai, Maharashtra');
      setIsCheckingRisk(true);
      setTimeout(() => {
        navigate(`/risk/Mumbai`);
      }, 400);
      return;
    }
    setIsCheckingRisk(true);
    setTimeout(() => {
      navigate(`/risk/${encodeURIComponent(searchInput.trim())}`);
    }, 400);
  };

  // Scroll hazard carousel
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const offset = direction === 'left' ? -320 : 320;
      carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Handle region select change
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = e.target.value;
    setSelectedState(s);
    if (s === 'Maharashtra') {
      setSelectedDistrict('Mumbai Suburban');
      setRegionData({
        hazards: ['Urban Inundation', 'Coastal Surge', 'Cyclonic Winds'],
        seismic: 'Zone III Seismic Activity',
        vulnerability: 'Low to Moderate',
        vulnerabilityDesc: 'Normal baseline seasonal readiness. No red warnings active.',
        sheltersCount: 14,
        nearestUnit: 'NDRF Regional Response Hub',
        nearestUnitLocation: 'Andheri East Battalion Hub',
        nearestUnitPhone: '022-26840000',
      });
    } else if (s === 'Assam') {
      setSelectedDistrict('Kamrup Metropolitan');
      setRegionData({
        hazards: ['Riverine Flooding', 'Flash Inundation', 'Hill Soil Creep'],
        seismic: 'Zone V High Seismic Activity',
        vulnerability: 'High (Warning)',
        vulnerabilityDesc: 'Brahmaputra staging alert. Flood evacuation teams staged.',
        sheltersCount: 22,
        nearestUnit: '1st Battalion NDRF Patgaon',
        nearestUnitLocation: 'Guwahati Airbase Hub',
        nearestUnitPhone: '0361-2840000',
      });
    } else if (s === 'Himachal Pradesh') {
      setSelectedDistrict('Shimla');
      setRegionData({
        hazards: ['Mountain Landslide', 'Debris Torrent', 'Cloudburst'],
        seismic: 'Zone IV Seismic Active Belt',
        vulnerability: 'Moderate',
        vulnerabilityDesc: 'NH-5 monitoring active. Highway heavy traffic restricted.',
        sheltersCount: 9,
        nearestUnit: 'SDRF Hill Rescue Battalion',
        nearestUnitLocation: 'Jutogh Cantonment, Shimla',
        nearestUnitPhone: '0177-2628990',
      });
    } else if (s === 'Odisha') {
      setSelectedDistrict('Jagatsinghpur');
      setRegionData({
        hazards: ['Tropical Cyclonic Surge', 'Coastal Wind Gale', 'Saline Inundation'],
        seismic: 'Zone II Low Seismic Activity',
        vulnerability: 'Advisory Watch',
        vulnerabilityDesc: 'Depression monitored in Bay of Bengal. Multi-purpose shelters open.',
        sheltersCount: 38,
        nearestUnit: 'ODRAF & 3rd Bn NDRF',
        nearestUnitLocation: 'Paradip Port Staging Base',
        nearestUnitPhone: '06722-222100',
      });
    } else {
      setSelectedDistrict('Central District');
      setRegionData({
        hazards: ['Heatwave Index', 'Seismic Vulnerability', 'Urban Waterlogging'],
        seismic: 'Zone IV Seismic Classification',
        vulnerability: 'Moderate',
        vulnerabilityDesc: 'Standard monitoring protocol active across administrative wards.',
        sheltersCount: 18,
        nearestUnit: '8th Battalion NDRF Hub',
        nearestUnitLocation: 'District Control Center',
        nearestUnitPhone: '011-23438091',
      });
    }
  };

  // Hazard catalogue data
  const hazardCatalogue = [
    {
      slug: 'earthquake',
      title: 'Earthquake',
      category: 'Seismic Hazard',
      desc: 'Drop, Cover, Hold On rules & structural safety checklists.',
      guidelines: 12,
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAC9huUXb35yEIVX_0rakf-AXk2HMm68lLjPVasHuavJX1wp4SnaA3138Kqg-exTcJLq7pzF-h3ADaYygI8rnsQv8aJBIhoyGd3gSnR4qTNN9oZMa-1YD2Dk6C1xcxDDWw15Fy5unNYGo8ibICQBPCY2yIi3cBfPe-KyVv429Yt1OzCPhHdCoAvPNM9UGdCS1My2lnTuy9auoZtlWwXRPVthIgL3bKXpibX_IaI6K9IGe5OKtGVeDuC',
    },
    {
      slug: 'flood',
      title: 'Flood & Surge',
      category: 'Hydrological Hazard',
      desc: 'Staged basin levels, waterborne diseases & vertical evacuation.',
      guidelines: 18,
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCSPPcGcBJa0epDaWYFFvyg9y713IMo3NFHA9dVypMpa40varswrCGIs0leYI1u9a6fiQf6rbSCKzgmN0uMrAf8pOah29SxVbLpT_EPwVwjDLd5LYttQjc5m4LUK7y_w5OL5bhoeeQmG8S6g9znlg1I9zfRdO8bmLdKiEAK-5J6ZwxWx_BLDw1PsGVC-zLVn9lu3q3quRg7Vs-yneHK5zDT9sFKDc9fdxsrOQGGoni4UtdTNFAOABwm',
    },
    {
      slug: 'cyclone',
      title: 'Cyclone',
      category: 'Meteorological',
      desc: 'Wind categorization, storm shelters & post-landfall hazards.',
      guidelines: 14,
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA376oGGGArcFKvEHw0SI9fl9POEW8Xd0F_RSCNESqmBQ18hmmwy2r-I31z--oRaCA7WmMTfwDvVtSeBFZia3wqqgMJ1xUH9u2FZ5F9S75myVeVuv5J20G7yc7YHuhf76gCZxk_AdLLoX9ased0WNvpYW1kGWAGEafxzTxggatdn5k3q06A7ZKpTPKvW-XlI_SOhUomu-hBjrRiszgWqKQqc7OflZDbTZYvwFr0YUs73flnGfvH_kl8',
    },
    {
      slug: 'heatwave',
      title: 'Heatwave',
      category: 'Climatic Extreme',
      desc: 'Wet-bulb warnings, electrolytic rehydration & elderly care.',
      guidelines: 9,
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3jdnz-x5p6Pg3PWRoW5IQlA2St5HJhQAG4EdAmfFngmTAnHTBQzgAG9VJSeIL2dC8pQGGBRSsnSHjhdQfacPbYhkEuY4euK6tpoGXi3LCnlW54_MVS6gPUgdF1E9Q5V39iijqmZ7fC5gqayoZmC-47VtrA7nF7x8QRW_6Ee_d6x4z-khWT_uJSFb_nZh6V5JTPcS6siAPfXPWEL_xxdrKH9rcLzqdOY12Q9uIl8ltSYKOX0rZ40b_',
    },
    {
      slug: 'landslide',
      title: 'Landslide',
      category: 'Geological Peril',
      desc: 'Hill slope warning cues, mudflow velocity & safe detours.',
      guidelines: 11,
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGAmQBTMud1gpQCvzq19Ad3Ocpnudq4SluCj73DOri-m_A9SAatY6RI4yNDWc-VWQeLQ4W_091NC6la1lSTi20Z3Eg-GnOIr21NJfO3WsKtanSpxnsoHsBl_lT4OPtWJxF0YCUyuDj-hQwQlyX_nPTSau2_jeoY61y-XiJU5-L5SFK7dEd285m9bGRtseEVGG-qoVG-gfGUw3U58FzMq7bNJ16O5UAmYvkvwQs_Als1gMq9r7ST6oh',
    },
    {
      slug: 'lightning',
      title: 'Lightning',
      category: 'Thunderstorm',
      desc: 'The 30-30 rule, rural farm safety, and lightning surge protection.',
      guidelines: 8,
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_pdgF2-fx4gGEGP-y6bxZvlD7V1Z_S5IFPrhWSUjT0mZbIdNAp_pTc_G7gHvjdjGqbVeSkYYi5WZy_s3aQATTBi7KiP1aysUfOTrgCMP7zdjfL4tjIDNRHoBdX4epsMKX8maxM7PQaqlcLRm29RNBTCkxPP4G-VRn4GOBEsAaC77yJRx8ateufqYyboQtGycvEnAsmyiYXYTxD5vAyCngndQ4xu9bKN45YmZTuCmo2qe8oNvjbpwU',
    },
    {
      slug: 'forest-fire',
      title: 'Forest Fire',
      category: 'Ecological Fire',
      desc: 'Creating defensible perimeter space and smoke inhalation filters.',
      guidelines: 10,
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBzoWipfoeJgjCorB-thNA9GIR1EcVYDUMLKrBYHCn24k0r04gxkHeLSA4l6njUb6MLxxHUmbvS-svdgunuXRKnYNFdcPPSICT8bdIuoFSlsaoOuVoTtmj_jS60GhhJ-Sl1uu8VkLpjtpjbtLp3WlgnwFfvwXi_gyhBfV_bZ0AR87-qPfRJGnxPajxvz5Ymi2ZfxEMt32A2-nqm3szUk46ET7Wp1jvnO36j06P4jWvhSmuVAAGcF3xq',
    },
    {
      slug: 'drought',
      title: 'Drought',
      category: 'Chronic Hazard',
      desc: 'Groundwater conservation, rationing protocols & livestock security.',
      guidelines: 15,
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUQVklikJjMOEA5sAjaWShlJH4MOofxj2v2-xRHbyUjE14eWVJXsAWNYZCqeU8XHMKwgFUC-PFY7rQRIWINUWS37wBIctCgh4iG0GuaoulD4_7k-A2cWx-tJf0IFo_tZuRYQJ5hXAbjQgNzPmvboXpUuXAbLOxosiiPMmC-SN1XvLY9oOjnc09934wYa-VrraGRgYIs7p9bqxsGZrGK5NaHfrkWJsfr1fLekT0jrc3skYPvQEdxtc7',
    },
  ];

  return (
    <main className="w-full bg-surface">
      <div className="flex flex-col w-full">
        {/* ========================================================================= */}
        {/* SECTION 1: HERO & PRIMARY DUAL CITIZEN ACTION AREA */}
        {/* ========================================================================= */}
        <section className="relative w-full overflow-hidden">
          {/* Hero Background Carousel — full-bleed disaster imagery behind entire hero */}
          <div
            className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
            aria-hidden="true"
          >
            {HERO_BG_IMAGES.map((src, i) => (
              <div
                key={src}
                className={`hero-bg-layer absolute inset-0 transition-opacity duration-[1500ms] ease-in-out ${
                  i === heroIndex ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <img
                  src={src}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className={`h-full w-full object-cover ${
                    i === heroIndex ? 'hero-kenburns' : ''
                  }`}
                  style={{ filter: 'brightness(0.94) saturate(0.95)' }}
                />
              </div>
            ))}
            {/* Soft white gradient overlays so foreground text stays highly readable */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/25 to-surface/80"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-white/25 via-white/10 to-transparent"></div>
          </div>

          <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop pt-32 lg:pt-40 pb-space-2xl">
            {/* Eyebrow & Hero Header */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-3xl flex flex-col gap-space-sm mb-space-2xl"
            >
              <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-white/60 backdrop-blur-md border border-white/50 w-fit">
                <span className="w-2 h-2 rounded-full bg-surface-tint animate-pulse"></span>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">
                  {t('hero.eyebrow')}
                </span>
              </div>
              <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight leading-tight">
                {t('hero.titleA')}<br />
                <span className="text-primary-container">{t('hero.titleB')}</span>
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
                {t('hero.subtitle')}
              </p>
            </motion.div>

            {/* DUAL ACTION CARDS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
              {/* CARD 1: Check Disaster Forecast */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="lg:col-span-6 bg-white/50 backdrop-blur-lg rounded-xl p-space-lg lg:p-space-xl shadow-xl border border-white/50 flex flex-col justify-between"
              >
                <div className="flex flex-col gap-space-xs mb-space-md">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm uppercase tracking-wide text-secondary font-bold">
                      {t('hero.forecastEyebrow')}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-surface-tint">verified</span>
                      <span>{t('hero.forecastSource')}</span>
                    </span>
                  </div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold">
                    {t('hero.forecastTitle')}
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('hero.forecastSub')}
                  </p>
                </div>

                <div className="flex flex-col gap-space-sm">
                  <div className="flex flex-col sm:flex-row gap-space-xs">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                        location_on
                      </span>
                      <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCheckRisk()}
                        className="w-full h-12 pl-10 pr-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:bg-surface-container-lowest transition-colors outline-none border border-transparent focus:border-primary"
                        placeholder={t('hero.searchPlaceholder')}
                        aria-label={t('hero.forecastTitle')}
                        type="text"
                      />
                    </div>
                    <button
                      onClick={handleCheckRisk}
                      disabled={isCheckingRisk}
                      className="h-12 px-space-lg rounded-lg bg-primary-container text-on-primary font-label-lg text-label-lg hover:bg-primary transition-all flex items-center justify-center gap-space-xs disabled:opacity-75"
                    >
                      <span>{isCheckingRisk ? t('hero.analyzing') : t('hero.checkRisk')}</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-space-xs">
                    <button
                      onClick={handleDetectGPS}
                      disabled={isLocating}
                      className="inline-flex items-center gap-1.5 font-label-md text-label-md text-secondary hover:text-on-secondary-container transition-colors disabled:opacity-50"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px]">my_location</span>
                      <span>{isLocating ? t('hero.locating') : t('hero.detectGps')}</span>
                    </button>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {t('hero.telemetryNote')}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* CARD 2: Emergency Response Triage */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="lg:col-span-6 bg-white/50 backdrop-blur-lg rounded-xl p-space-lg lg:p-space-xl shadow-xl border border-white/50 flex flex-col justify-between relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-error"></div>
                <div className="flex flex-col gap-space-xs mb-space-md">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm uppercase tracking-wide text-error font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span> {t('hero.triageEyebrow')}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                      {t('hero.triageNote')}
                    </span>
                  </div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-semibold">
                    {t('hero.triageTitle')}
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {t('hero.triageSub')}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
                  {/* Triage Option 1: AI Assistant */}
                  <Link
                    to="/assistant"
                    className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col gap-space-xs text-left group border border-outline-variant/20"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                    </div>
                    <span className="font-headline-sm text-sm text-on-surface group-hover:text-primary transition-colors font-bold">
                      {t('hero.aiTitle')}
                    </span>
                    <span className="font-label-sm text-[11px] text-on-surface-variant leading-tight">
                      {t('hero.aiSub')}
                    </span>
                  </Link>

                  {/* Triage Option 2: Report Emergency */}
                  <Link
                    to="/report-emergency"
                    className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col gap-space-xs text-left group border border-outline-variant/20"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">emergency_share</span>
                    </div>
                    <span className="font-headline-sm text-sm text-on-surface group-hover:text-secondary transition-colors font-bold">
                      {t('hero.reportTitle')}
                    </span>
                    <span className="font-label-sm text-[11px] text-on-surface-variant leading-tight">
                      {t('hero.reportSub')}
                    </span>
                  </Link>

                  {/* Triage Option 3: Call 112 / 1078 */}
                  <button
                    onClick={onOpenEmergencyModal}
                    className="p-space-sm rounded-lg bg-error-container hover:bg-error/20 transition-colors flex flex-col gap-space-xs text-left group border border-error/30"
                  >
                    <div className="w-8 h-8 rounded-lg bg-error text-on-error flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">call</span>
                    </div>
                    <span className="font-headline-sm text-sm text-on-error-container font-bold">
                      {t('hero.callTitle')}
                    </span>
                    <span className="font-label-sm text-[11px] text-on-error-container leading-tight">
                      {t('hero.callSub')}
                    </span>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: LIVE CIVIC STATUS STRIP */}
        {/* ========================================================================= */}
        <section className="w-full bg-surface-container-low py-space-sm border-y border-outline-variant/30">
          <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop flex flex-wrap items-center justify-between gap-space-md">
            <div className="flex flex-wrap items-center gap-space-md">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
                <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">
                  {t('status.grid')}
                </span>
              </div>
              <div className="h-4 w-px bg-outline-variant hidden sm:block"></div>
              <div className="flex items-center gap-space-xs">
                <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-bold">
                  {t('status.activeAlerts')}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                  {t('status.regionsAtRisk')}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm hidden md:inline-flex">
                  {t('status.advisories')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-md">
              <div className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-surface-tint">sync</span>
                <span>{t('status.telemetry')}</span>
              </div>
              <Link
                to="/alerts"
                className="font-label-md text-label-md text-primary hover:text-primary-container font-bold flex items-center gap-1 transition-colors"
              >
                <span>{t('status.viewAll')}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: LIVE CITIZEN INFORMATION DASHBOARD (3-COLUMN API-READY GRID) */}
        {/* ========================================================================= */}
        <section className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop py-space-3xl w-full">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-sm mb-space-xl">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
                {t('dash.eyebrow')}
              </span>
              <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
                {t('dash.title')}
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
              {t('dash.sub')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
            {/* Column 1: Current Weather */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between">
              <div className="flex flex-col gap-space-md">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      {t('dash.weather')}
                    </span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      {weatherData?.location || 'Mumbai, Maharashtra'}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      const locs = ['Mumbai', 'Delhi', 'Guwahati', 'Shimla', 'Patna', 'Pune'];
                      const next = locs[(locs.indexOf(currentLocation) + 1) % locs.length];
                      setCurrentLocation(next);
                    }}
                    className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm transition-colors border border-outline-variant/30"
                  >
                    {t('dash.change')}
                  </button>
                </div>

                <div className="flex items-baseline justify-between pt-space-xs">
                  <div className="flex items-baseline gap-space-xs">
                    <span className="font-display-lg text-display-lg text-primary font-bold">
                      {weatherData?.temperature ?? 28}°C
                    </span>
                    <span className="font-body-md text-body-md text-on-surface-variant">
                      {weatherData?.condition || 'Partly Cloudy'}
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[28px]">
                      {weatherData?.condition?.toLowerCase().includes('rain') ? 'rainy' : 'partly_cloudy_day'}
                    </span>
                  </div>
                </div>

                {/* Micro Sensor Data Bar */}
                <div className="grid grid-cols-3 gap-space-xs py-space-sm rounded-lg bg-surface-container-low px-space-sm">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{t('dash.humidity')}</span>
                    <span className="font-code-num text-code-num text-on-surface font-semibold">
                      {weatherData?.humidity ?? 78}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{t('dash.wind')}</span>
                    <span className="font-code-num text-code-num text-on-surface font-semibold">
                      {weatherData?.windSpeed ?? 12} km/h
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{t('dash.rainChance')}</span>
                    <span className="font-code-num text-code-num text-on-surface font-semibold">
                      {weatherData?.rainProbability ?? 20}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-space-md p-space-sm rounded-lg bg-surface-container-low flex items-center gap-space-xs text-primary">
                <span className="material-symbols-outlined text-[20px] text-surface-tint">check_circle</span>
                <span className="font-label-md text-label-md text-on-surface text-xs">
                  {weatherData?.severeWarning || 'No severe storm alerts in coastal Konkan belt.'}
                </span>
              </div>
            </div>

            {/* Column 2: Active Alerts Feed */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      {t('dash.alertsEyebrow')}
                    </span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      {t('dash.alertsTitle')}
                    </h3>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                </div>

                <div className="flex flex-col gap-space-xs">
                  {/* Alert 1 */}
                  <Link
                    to="/alerts"
                    className="p-space-xs rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-error text-[20px]">rainy</span>
                      <div className="flex flex-col text-left">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">Heavy Rainfall</span>
                        <span className="font-label-sm text-[11px] text-on-surface-variant">Assam, Meghalaya</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                      Warning
                    </span>
                  </Link>

                  {/* Alert 2 */}
                  <Link
                    to="/alerts"
                    className="p-space-xs rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-secondary text-[20px]">flood</span>
                      <div className="flex flex-col text-left">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">Flood Watch</span>
                        <span className="font-label-sm text-[11px] text-on-surface-variant">North Bihar &amp; East UP</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-tertiary-container font-label-sm text-label-sm font-semibold">
                      Watch
                    </span>
                  </Link>

                  {/* Alert 3 */}
                  <Link
                    to="/alerts"
                    className="p-space-xs rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-outline text-[20px]">thermostat</span>
                      <div className="flex flex-col text-left">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">Heatwave Index</span>
                        <span className="font-label-sm text-[11px] text-on-surface-variant">Central MP &amp; Vidarbha</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
                      Advisory
                    </span>
                  </Link>

                  {/* Alert 4 */}
                  <Link
                    to="/alerts"
                    className="p-space-xs rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-tertiary text-[20px]">cyclone</span>
                      <div className="flex flex-col text-left">
                        <span className="font-label-md text-label-md text-on-surface font-semibold">Cyclone Low Pressure</span>
                        <span className="font-label-sm text-[11px] text-on-surface-variant">East Central Bay of Bengal</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                      Monitoring
                    </span>
                  </Link>
                </div>
              </div>

              <div className="mt-space-md text-right">
                <Link
                  to="/alerts"
                  className="font-label-sm text-label-sm text-primary hover:text-primary-container font-semibold inline-flex items-center gap-1"
                >
                  <span>{t('dash.viewMap')}</span>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </Link>
              </div>
            </div>

            {/* Column 3: Air Quality (AQI) */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-space-md">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      {t('dash.aqi')}
                    </span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      {aqiData?.location || 'Mumbai, Bandra West'}
                    </h3>
                  </div>
                  <span className="material-symbols-outlined text-secondary text-[24px]">air</span>
                </div>

                <div className="flex items-baseline gap-space-md my-space-xs">
                  <span className="font-display-lg text-display-lg text-secondary font-bold">
                    {aqiData?.aqi ?? 68}
                  </span>
                  <div className="flex flex-col">
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold w-fit">
                      {aqiData?.status || 'Satisfactory'}
                    </span>
                    <span className="font-label-sm text-[11px] text-on-surface-variant">
                      CPCB Standard Station
                    </span>
                  </div>
                </div>

                <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-sm text-xs">
                  {aqiData?.advisory || 'Air quality is satisfactory for most people. Outdoor sports and routine morning exercises remain safe.'}
                </p>

                {/* SVG AQI Gauge Bar */}
                <div className="w-full mt-space-md">
                  <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden flex">
                    <div className="w-1/5 h-full bg-surface-tint"></div>
                    <div className="w-1/5 h-full bg-secondary-container"></div>
                    <div className="w-1/5 h-full bg-surface-container-highest"></div>
                    <div className="w-1/5 h-full bg-outline-variant"></div>
                    <div className="w-1/5 h-full bg-error"></div>
                  </div>
                  <div className="flex justify-between font-label-sm text-[10px] text-on-surface-variant mt-1">
                    <span>0 (Good)</span>
                    <span>50</span>
                    <span>100</span>
                    <span>200+</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate(`/risk/${encodeURIComponent(currentLocation)}`)}
                className="mt-space-md font-label-sm text-label-sm text-secondary hover:text-on-secondary-container font-semibold inline-flex items-center gap-1 text-left"
              >
                <span>{t('dash.viewTrend')}</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: "KNOW BEFORE IT HAPPENS" (HORIZONTAL DISASTER CATALOGUE) */}
        {/* ========================================================================= */}
        <section className="w-full bg-surface-container-low py-space-3xl border-y border-outline-variant/30">
          <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-md mb-space-xl">
              <div className="max-w-xl">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
                  {t('hazards.eyebrow')}
                </span>
                <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
                  {t('hazards.title')}
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-space-xxs">
                  {t('hazards.sub')}
                </p>
              </div>
              <div className="flex items-center gap-space-xs">
                <button
                  onClick={() => scrollCarousel('left')}
                  aria-label={t('hazards.prev')}
                  className="w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors flex items-center justify-center shadow-sm border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <button
                  onClick={() => scrollCarousel('right')}
                  aria-label={t('hazards.next')}
                  className="w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors flex items-center justify-center shadow-sm border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Scrollable Grid Container */}
            <div
              ref={carouselRef}
              className="flex gap-space-md overflow-x-auto pb-space-sm scroll-smooth snap-x no-scrollbar"
            >
              {hazardCatalogue.map((item) => (
                <Link
                  key={item.slug}
                  to={`/guides/${item.slug}`}
                  className="min-w-[260px] md:min-w-[280px] bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col snap-start group border border-outline-variant/30"
                >
                  <div
                    className="h-36 w-full bg-surface-container-high bg-cover bg-center"
                    style={{ backgroundImage: `url('${item.img}')` }}
                  ></div>
                  <div className="p-space-md flex flex-col justify-between flex-1">
                    <div>
                      <span className="font-label-sm text-[11px] text-secondary uppercase font-bold">
                        {item.category}
                      </span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors mt-0.5 font-bold">
                        {item.title}
                      </h3>
                      <p className="font-body-sm text-xs text-on-surface-variant mt-1 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                    <div className="mt-space-md flex items-center justify-between text-primary pt-2 border-t border-outline-variant/20">
                      <span className="font-label-sm text-xs font-semibold">{item.guidelines} {t('hazards.guidelines')}</span>
                      <span className="w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: "BE READY BEFORE IT HAPPENS" (CHRONOLOGICAL PREPAREDNESS PHASES) */}
        {/* ========================================================================= */}
        <section className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop py-space-3xl w-full">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-sm mb-space-xl">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
                {t('prep.eyebrow')}
              </span>
              <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
                {t('prep.title')}
              </h2>
            </div>
            <Link
              to="/guides"
              className="font-label-md text-label-md text-primary font-bold hover:text-primary-container inline-flex items-center gap-1 transition-colors"
            >
              <span>{t('prep.explore')}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
            {/* Phase 1: BEFORE */}
            <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between mb-space-md">
                  <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-bold uppercase tracking-wider">
                    Phase 01 • BEFORE
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Preventive</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-space-xs font-bold">
                  Build a 72-Hour Family Kit
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                  When standard supply chains and power grids snap, having vital supplies pre-packed prevents immediate desperation.
                </p>
                <ul className="flex flex-col gap-space-xs text-on-surface font-body-sm text-body-sm">
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-surface-tint text-[18px] mt-0.5">check_circle</span>
                    <span>4 liters potable water per person/day</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-surface-tint text-[18px] mt-0.5">check_circle</span>
                    <span>Non-perishable high-protein food &amp; dry dates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-surface-tint text-[18px] mt-0.5">check_circle</span>
                    <span>Prescription medicines &amp; waterproof ID copies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-surface-tint text-[18px] mt-0.5">check_circle</span>
                    <span>Crank/solar radio &amp; external power bank</span>
                  </li>
                </ul>
              </div>
              <div className="mt-space-lg pt-space-md bg-surface-container-low rounded-lg p-space-sm flex items-center justify-between border border-outline-variant/20">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Family Readiness Index</span>
                <span className="font-code-num text-code-num text-primary font-bold">Step 1 of 3</span>
              </div>
            </div>

            {/* Phase 2: DURING */}
            <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between mb-space-md">
                  <span className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold uppercase tracking-wider">
                    Phase 02 • DURING
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Active Danger</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-space-xs font-bold">
                  Execute Survival Postures
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                  Knowing split-second reactions reduces injuries by up to 80%. Stay calm and adhere to official advisories.
                </p>
                <ul className="flex flex-col gap-space-xs text-on-surface font-body-sm text-body-sm">
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
                    <span>Disconnect main gas valves &amp; electric trip switches</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
                    <span>Move away from unreinforced masonry &amp; glass panes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
                    <span>Do NOT cross inundated bridges or fast culverts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
                    <span>Follow designated evacuation routes from collectors</span>
                  </li>
                </ul>
              </div>
              <div className="mt-space-lg pt-space-md bg-surface-container-low rounded-lg p-space-sm flex items-center justify-between border border-outline-variant/20">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Shelter &amp; Egress Plan</span>
                <span className="font-code-num text-code-num text-secondary font-bold">Step 2 of 3</span>
              </div>
            </div>

            {/* Phase 3: AFTER */}
            <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between mb-space-md">
                  <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm font-bold uppercase tracking-wider">
                    Phase 03 • AFTER
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">Recovery</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-space-xs font-bold">
                  Safe Recovery &amp; Hygiene
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                  Secondary hazards like contaminated water and hanging live cables often present greater risks post-event.
                </p>
                <ul className="flex flex-col gap-space-xs text-on-surface font-body-sm text-body-sm">
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-outline text-[18px] mt-0.5">check_circle</span>
                    <span>Boil all tap water or use chlorine purification</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-outline text-[18px] mt-0.5">check_circle</span>
                    <span>Photograph structural damages for claim filings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-outline text-[18px] mt-0.5">check_circle</span>
                    <span>Signal stranded elders or pets with bright fabric</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-outline text-[18px] mt-0.5">check_circle</span>
                    <span>Rely strictly on official bulletins; reject rumors</span>
                  </li>
                </ul>
              </div>
              <div className="mt-space-lg pt-space-md bg-surface-container-low rounded-lg p-space-sm flex items-center justify-between border border-outline-variant/20">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Civic Reintegration</span>
                <span className="font-code-num text-code-num text-on-surface font-bold">Step 3 of 3</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 6: ESSENTIAL CIVIC RESOURCES (5 CARDS) */}
        {/* ========================================================================= */}
        <section className="w-full bg-surface-container-low py-space-3xl border-y border-outline-variant/30">
          <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop">
            <div className="max-w-2xl mb-space-xl">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
                Civic Infrastructure
              </span>
              <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
                Essential Public Resources
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-space-xxs">
                Vetted public services, direct contact registries, and downloadable emergency assets maintained under National Disaster Management frameworks.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md">
              {/* Resource 1 */}
              <button
                onClick={onOpenEmergencyModal}
                className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-outline-variant/30 text-left"
              >
                <div className="flex flex-col gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
                    <span className="material-symbols-outlined text-[22px]">contact_phone</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Emergency Helplines</h3>
                    <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                      Verified nationwide lines: NDRF (1078), Police (112), Ambulance (108).
                    </p>
                  </div>
                </div>
                <span className="font-label-sm text-label-sm text-primary font-bold mt-space-md inline-flex items-center gap-1">
                  Access directory →
                </span>
              </button>

              {/* Resource 2 */}
              <Link
                to="/resources"
                className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-outline-variant/30"
              >
                <div className="flex flex-col gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary group-hover:bg-secondary-container group-hover:text-on-secondary-container transition-colors">
                    <span className="material-symbols-outlined text-[22px]">domain</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">State Portals</h3>
                    <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                      Direct links to 36 State Disaster Management Authorities (SDMAs).
                    </p>
                  </div>
                </div>
                <span className="font-label-sm text-label-sm text-secondary font-bold mt-space-md inline-flex items-center gap-1">
                  Browse portals →
                </span>
              </Link>

              {/* Resource 3 */}
              <Link
                to="/guides"
                className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-outline-variant/30"
              >
                <div className="flex flex-col gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface group-hover:bg-surface-tint group-hover:text-surface-bright transition-colors">
                    <span className="material-symbols-outlined text-[22px]">rule</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Safety Guidelines</h3>
                    <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                      Official standardized do's and don'ts issued by NDMA and MHA.
                    </p>
                  </div>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface font-bold mt-space-md inline-flex items-center gap-1">
                  View standards →
                </span>
              </Link>

              {/* Resource 4 */}
              <Link
                to="/risk/Mumbai"
                className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-outline-variant/30"
              >
                <div className="flex flex-col gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
                    <span className="material-symbols-outlined text-[22px]">checklist_rtl</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Preparedness Check</h3>
                    <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                      Interactive readiness auditor for residential housing societies.
                    </p>
                  </div>
                </div>
                <span className="font-label-sm text-label-sm text-primary font-bold mt-space-md inline-flex items-center gap-1">
                  Start auditor →
                </span>
              </Link>

              {/* Resource 5 */}
              <Link
                to="/resources"
                className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between group border border-outline-variant/30"
              >
                <div className="flex flex-col gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-tertiary group-hover:bg-tertiary-container group-hover:text-surface-bright transition-colors">
                    <span className="material-symbols-outlined text-[22px]">download_for_offline</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Offline Manuals</h3>
                    <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                      Printable PDFs &amp; multi-lingual regional emergency guides.
                    </p>
                  </div>
                </div>
                <span className="font-label-sm text-label-sm text-tertiary font-bold mt-space-md inline-flex items-center gap-1">
                  Download PDFs →
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 7: "KNOW YOUR REGION" (INTERACTIVE REGIONAL RISK EXPLORER) */}
        {/* ========================================================================= */}
        <section className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop py-space-3xl w-full">
          <div className="bg-surface-container-lowest rounded-xl p-space-lg lg:p-space-2xl shadow-sm border border-outline-variant/30">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-lg pb-space-lg border-b border-outline-variant/20">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
                  Hyperlocal Telemetry
                </span>
                <h2 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-bold">
                  Know Your Region
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Examine the institutional safety status and designated disaster relief headquarters for your administrative jurisdiction.
                </p>
              </div>

              {/* Interactive District Selectors */}
              <div className="flex flex-wrap items-center gap-space-sm w-full lg:w-auto">
                <div className="flex flex-col gap-1 w-full sm:w-48">
                  <label className="font-label-sm text-xs text-on-surface-variant font-medium" htmlFor="state-select">
                    Select State
                  </label>
                  <select
                    value={selectedState}
                    onChange={handleStateChange}
                    className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md outline-none border border-outline-variant/30 focus:border-primary"
                    id="state-select"
                  >
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Assam">Assam</option>
                    <option value="Himachal Pradesh">Himachal Pradesh</option>
                    <option value="Odisha">Odisha</option>
                    <option value="Delhi">Delhi NCR</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 w-full sm:w-48">
                  <label className="font-label-sm text-xs text-on-surface-variant font-medium" htmlFor="district-select">
                    Select District
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md outline-none border border-outline-variant/30 focus:border-primary"
                    id="district-select"
                  >
                    <option value={selectedDistrict}>{selectedDistrict}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Regional Information Display Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md pt-space-lg">
              <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between border border-outline-variant/20">
                <div>
                  <span className="font-label-sm text-xs text-on-surface-variant">Primary Documented Hazards</span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {regionData.hazards.map((h) => (
                      <span key={h} className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface font-label-sm text-xs">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="font-label-sm text-xs text-on-surface-variant mt-space-md">
                  {regionData.seismic}
                </span>
              </div>

              <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between border border-outline-variant/20">
                <div>
                  <span className="font-label-sm text-xs text-on-surface-variant">Current Vulnerability Level</span>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="w-3 h-3 rounded-full bg-surface-tint"></span>
                    <span className="font-headline-sm text-sm text-on-surface font-bold">{regionData.vulnerability}</span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                    {regionData.vulnerabilityDesc}
                  </p>
                </div>
                <span className="font-label-sm text-xs text-surface-tint font-bold">Standard Monitoring</span>
              </div>

              <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between border border-outline-variant/20">
                <div>
                  <span className="font-label-sm text-xs text-on-surface-variant">Public Shelter Assets</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="font-display-lg text-display-lg text-primary font-bold">
                      {regionData.sheltersCount}
                    </span>
                    <span className="font-label-md text-xs text-on-surface-variant">Identified shelters &lt; 5km</span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                    Municipal schools, indoor stadiums, and civic ward halls.
                  </p>
                </div>
                <Link
                  to={`/risk/${encodeURIComponent(selectedDistrict)}`}
                  className="font-label-sm text-xs text-primary font-bold hover:underline"
                >
                  View Shelter Map →
                </Link>
              </div>

              <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between border border-outline-variant/20">
                <div>
                  <span className="font-label-sm text-xs text-on-surface-variant">Nearest Response Unit</span>
                  <h4 className="font-headline-sm text-sm text-on-surface mt-2 font-bold">{regionData.nearestUnit}</h4>
                  <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">{regionData.nearestUnitLocation}</p>
                  <p className="font-code-num text-xs text-primary font-bold mt-1">{regionData.nearestUnitPhone}</p>
                </div>
                <a
                  href={`tel:${regionData.nearestUnitPhone}`}
                  className="font-label-sm text-xs text-secondary font-bold hover:underline"
                >
                  Direct Emergency Dispatch →
                </a>
              </div>
            </div>

            <div className="mt-space-lg pt-space-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-outline-variant/20">
              <p className="font-label-sm text-[11px] text-on-surface-variant">
                Informational assessment synthesized from open telemetry published by District Disaster Management Authorities (DDMA).
              </p>
              <span className="font-label-sm text-xs text-surface-tint font-bold">Status: Synchronized</span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 8: COMMUNITY RESILIENCE & DATA TRANSPARENCY */}
        {/* ========================================================================= */}
        <section className="w-full bg-surface-container-low py-space-3xl border-t border-outline-variant/30">
          <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop">
            {/* Key Statistics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-2xl">
              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col">
                <span className="font-display-lg text-display-lg text-primary font-bold">28 + 8</span>
                <span className="font-headline-sm text-headline-sm text-on-surface mt-1 font-bold">States &amp; UTs</span>
                <span className="font-body-sm text-xs text-on-surface-variant">Continuous geographic grid across all territories.</span>
              </div>
              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col">
                <span className="font-display-lg text-display-lg text-secondary font-bold">14</span>
                <span className="font-headline-sm text-headline-sm text-on-surface mt-1 font-bold">Hazard Categories</span>
                <span className="font-body-sm text-xs text-on-surface-variant">Standardized mitigation playbooks for every crisis.</span>
              </div>
              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col">
                <span className="font-display-lg text-display-lg text-tertiary font-bold">24 / 7</span>
                <span className="font-headline-sm text-headline-sm text-on-surface mt-1 font-bold">Automated Feeds</span>
                <span className="font-body-sm text-xs text-on-surface-variant">IMD, CWC, and satellite Doppler integration.</span>
              </div>
              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col">
                <span className="font-display-lg text-display-lg text-surface-tint font-bold">100%</span>
                <span className="font-headline-sm text-headline-sm text-on-surface mt-1 font-bold">Civic Open Data</span>
                <span className="font-body-sm text-xs text-on-surface-variant">Free for all citizens, communities, and rescue volunteers.</span>
              </div>
            </div>

            {/* Institutional Partnership & Open Telemetry Accreditation */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg lg:p-space-xl shadow-sm border border-outline-variant/30 flex flex-col lg:flex-row items-center justify-between gap-space-xl">
              <div className="max-w-xl">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
                  Official Civic Data Sources
                </span>
                <h3 className="font-headline-lg text-headline-lg text-on-surface mt-1 font-bold">
                  Built Around Verified Public Telemetry
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                  JeevanGrid synthesizes alerts from the India Meteorological Department (IMD), National Disaster Management Authority (NDMA), Central Water Commission (CWC), and ISRO NRSC sensor grids to deliver timely, trusted alerts directly to Indian citizens.
                </p>
              </div>

              {/* Telemetry Source Pills Grid */}
              <div className="flex flex-wrap gap-space-xs justify-center lg:justify-end max-w-md">
                <div className="px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md flex items-center gap-2 border border-outline-variant/20">
                  <span className="material-symbols-outlined text-[18px] text-primary">satellite_alt</span>
                  <span>IMD Meteorology</span>
                </div>
                <div className="px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md flex items-center gap-2 border border-outline-variant/20">
                  <span className="material-symbols-outlined text-[18px] text-primary">security</span>
                  <span>NDMA Directives</span>
                </div>
                <div className="px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md flex items-center gap-2 border border-outline-variant/20">
                  <span className="material-symbols-outlined text-[18px] text-primary">water_drop</span>
                  <span>CWC River Basins</span>
                </div>
                <div className="px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md flex items-center gap-2 border border-outline-variant/20">
                  <span className="material-symbols-outlined text-[18px] text-primary">radar</span>
                  <span>ISRO NRSC Cartography</span>
                </div>
                <div className="px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md flex items-center gap-2 border border-outline-variant/20">
                  <span className="material-symbols-outlined text-[18px] text-primary">health_and_safety</span>
                  <span>MoHFW Public Health</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
