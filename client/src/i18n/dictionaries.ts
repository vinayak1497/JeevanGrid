/**
 * JeevanGrid global UI dictionaries (static UI content — spec §7A).
 *
 * Structured data (numbers, units, coordinates, phone numbers, warning IDs,
 * org names) is NEVER translated — components localize presentation only.
 * Official warnings keep severity/type/area/times/source verbatim; only the
 * surrounding chrome labels come from these bundles.
 *
 * Namespaces are merged into one typed dict per language for zero-dependency
 * static bundling. Add a language by adding one entry + one folder-free
 * object — no component rewrites needed (spec §2, §4).
 */
import type { AppLang } from './languages';

export interface GlobalDict {
  nav: {
    home: string; disasters: string; guides: string; resources: string;
    assistant: string; opsDashboard: string; emergencyHelp: string;
    login: string; tagline: string; demoMode: string; loggedInAs: string;
    guest: string; switchRole: string; selectRole: string;
  };
  hero: {
    eyebrow: string; titleA: string; titleB: string; subtitle: string;
    forecastEyebrow: string; forecastSource: string; forecastTitle: string;
    forecastSub: string; searchPlaceholder: string; checkRisk: string;
    analyzing: string; detectGps: string; locating: string; telemetryNote: string;
    triageEyebrow: string; triageNote: string; triageTitle: string; triageSub: string;
    aiTitle: string; aiSub: string; reportTitle: string; reportSub: string;
    callTitle: string; callSub: string;
  };
  status: {
    grid: string; activeAlerts: string; regionsAtRisk: string; advisories: string;
    telemetry: string; viewAll: string;
  };
  dash: {
    eyebrow: string; title: string; sub: string; weather: string; change: string;
    humidity: string; wind: string; rainChance: string;
    alertsEyebrow: string; alertsTitle: string; viewMap: string;
    aqi: string; viewTrend: string;
  };
  hazards: { eyebrow: string; title: string; sub: string; guidelines: string; prev: string; next: string };
  prep: { eyebrow: string; title: string; explore: string };
  emergency: {
    title: string; sub: string; close: string; reportTitle: string;
    reportSub: string; reportBtn: string; footer: string;
  };
  footer: {
    tagline: string; platform: string; preparedness: string; directory: string;
    notice: string; rights: string;
  };
  auth: {
    welcome: string; welcomeSub: string; email: string; password: string;
    signIn: string; signingIn: string; noAccount: string; createAccount: string;
    name: string; phone: string; confirmNote: string;
  };
  common: {
    loading: string; retry: string; close: string; call112: string;
    officialWarning: string; modelledEstimate: string; demoData: string;
    language: string; listen: string; stop: string;
  };
}

type D = GlobalDict;

const en: D = {
  nav: {
    home: 'Home', disasters: 'Disasters', guides: 'Safety Guides', resources: 'Resources',
    assistant: 'AI Assistant', opsDashboard: 'Ops Dashboard', emergencyHelp: 'Emergency Help',
    login: 'Citizen Portal / Login', tagline: 'Safer People. Stronger Communities.',
    demoMode: 'Demo Evaluator Mode:', loggedInAs: 'Logged in as:',
    guest: 'CITIZEN (Guest)', switchRole: 'Switch Role', selectRole: 'Select Operational Role',
  },
  hero: {
    eyebrow: 'BE PREPARED. STAY INFORMED.',
    titleA: 'In every disaster,', titleB: 'you are not alone.',
    subtitle: 'Know the real-time risks around your neighborhood, receive official multi-hazard alerts early, and access verified civic aid with one touch.',
    forecastEyebrow: 'Proactive Prevention', forecastSource: 'IMD & CWC Grid',
    forecastTitle: 'Check Disaster Forecast',
    forecastSub: 'Examine live localized hazard vulnerability, flood staging, and actionable storm alerts for your district.',
    searchPlaceholder: 'Enter city, district or PIN code (e.g. 400001 or Mumbai)',
    checkRisk: 'Check Risk', analyzing: 'Analyzing…',
    detectGps: 'Detect my current location (GPS)', locating: 'Locating via GPS…',
    telemetryNote: 'Telemetry refreshed 2m ago',
    triageEyebrow: 'Rapid Citizen Triage', triageNote: '24/7 National Dispatch',
    triageTitle: 'Do you need help right now?',
    triageSub: 'Select verified civic communication channels to alert national rescue authorities or receive emergency guidance.',
    aiTitle: 'AI Safety Assistant', aiSub: 'Instant evacuation triage & survival protocols',
    reportTitle: 'Report Emergency', reportSub: 'Broadcast live GPS coordinates to SDRF / DDMA',
    callTitle: 'Call 112 / 1078', callSub: 'National Emergency & NDRF hotlines',
  },
  status: {
    grid: 'India Disaster Grid', activeAlerts: '04 Active Alerts', regionsAtRisk: '07 Regions at Risk',
    advisories: '12 Weather Advisories', telemetry: 'Last Telemetry: Synchronized 2m ago',
    viewAll: 'View all national alerts',
  },
  dash: {
    eyebrow: 'Local Observation', title: 'Citizen Diagnostic Dashboard',
    sub: 'Synthesized meteorological telemetry, localized multi-hazard watches, and ambient air parameters updated every 15 minutes.',
    weather: 'Current Weather', change: 'Change', humidity: 'Humidity', wind: 'Wind', rainChance: 'Rain Chance',
    alertsEyebrow: 'Early Warnings', alertsTitle: 'Active Alert Bulletin', viewMap: 'View IMD Radar Map & Alerts',
    aqi: 'Air Quality (AQI)', viewTrend: 'View environmental trend & risk factors',
  },
  hazards: {
    eyebrow: 'Comprehensive Hazard Directory', title: 'Know Before It Happens',
    sub: 'Clear, life-saving guidance for the primary climate and geological perils documented across the subcontinent.',
    guidelines: 'Guidelines', prev: 'Previous hazard', next: 'Next hazard',
  },
  prep: { eyebrow: 'Resilience Framework', title: 'Be Ready Before It Happens', explore: 'Explore all verified safety guides' },
  emergency: {
    title: 'Emergency Civic Helplines', sub: 'Verified 24/7 National Dispatch Numbers', close: 'Close dialog',
    reportTitle: 'Need to report ground incident coordinates?',
    reportSub: 'Submit photo and live location directly to the District Response Unit.',
    reportBtn: 'Report Incident',
    footer: 'Emergency Response Support System (ERSS) operates toll-free across all States and Union Territories.',
  },
  footer: {
    tagline: 'A dependable civic infrastructure network engineered for disaster resilience, civic coordination, and public warning clarity across affected regions.',
    platform: 'Platform', preparedness: 'Preparedness', directory: 'Emergency Directory',
    notice: 'Public Notice & Reference: JeevanGrid is a citizen digital resilience portal designed to complement official National Disaster Management Authority (NDMA), IMD meteorology, and State Disaster Management bodies. For active red alerts, prioritize immediate directives from localized state authorities.',
    rights: '© 2026 JeevanGrid. Public Safety Infrastructure Network. Open telemetry sourced from verified government data portals.',
  },
  auth: {
    welcome: 'Welcome back', welcomeSub: 'Sign in to access your citizen portal and incident history.',
    email: 'Email address', password: 'Password', signIn: 'Sign in', signingIn: 'Signing in…',
    noAccount: 'New to JeevanGrid?', createAccount: 'Create citizen account',
    name: 'Full name', phone: 'Phone (optional)', confirmNote: 'Demo accounts use password Password123!',
  },
  common: {
    loading: 'Loading…', retry: 'Try again', close: 'Close', call112: 'Call 112 now',
    officialWarning: 'OFFICIAL WARNING', modelledEstimate: 'Modelled estimate — not an official warning',
    demoData: 'Demo data — live feed unavailable', language: 'Language', listen: 'Listen', stop: 'Stop',
  },
};

const hi: D = {
  nav: {
    home: 'होम', disasters: 'आपदाएं', guides: 'सुरक्षा मार्गदर्शिकाएं', resources: 'संसाधन',
    assistant: 'AI सहायक', opsDashboard: 'संचालन डैशबोर्ड', emergencyHelp: 'आपातकालीन सहायता',
    login: 'नागरिक पोर्टल / लॉगिन', tagline: 'सुरक्षित लोग। मज़बूत समुदाय।',
    demoMode: 'डेमो मूल्यांकन मोड:', loggedInAs: 'लॉगिन:',
    guest: 'नागरिक (अतिथि)', switchRole: 'भूमिका बदलें', selectRole: 'संचालन भूमिका चुनें',
  },
  hero: {
    eyebrow: 'तैयार रहें। सूचित रहें।',
    titleA: 'हर आपदा में,', titleB: 'आप अकेले नहीं हैं।',
    subtitle: 'अपने क्षेत्र के वास्तविक समय के जोखिम जानें, आधिकारिक बहु-आपदा चेतावनियां समय पर पाएं, और सत्यापित नागरिक सहायता एक स्पर्श में पाएं।',
    forecastEyebrow: 'सक्रिय रोकथाम', forecastSource: 'IMD व CWC ग्रिड',
    forecastTitle: 'आपदा पूर्वानुमान जांचें',
    forecastSub: 'अपने ज़िले की लाइव खतरा संवेदनशीलता, बाढ़ स्तर और कार्रवाई योग्य तूफान चेतावनियां देखें।',
    searchPlaceholder: 'शहर, ज़िला या पिन कोड लिखें (जैसे 400001 या मुंबई)',
    checkRisk: 'जोखिम जांचें', analyzing: 'विश्लेषण हो रहा है…',
    detectGps: 'मेरा वर्तमान स्थान खोजें (GPS)', locating: 'GPS से स्थान खोजा जा रहा है…',
    telemetryNote: 'टेलीमेट्री 2 मिनट पहले अपडेट हुई',
    triageEyebrow: 'त्वरित नागरिक सहायता', triageNote: '24/7 राष्ट्रीय डिस्पैच',
    triageTitle: 'क्या आपको अभी मदद चाहिए?',
    triageSub: 'राष्ट्रीय बचाव अधिकारियों को सूचित करने या आपातकालीन मार्गदर्शन पाने के लिए सत्यापित माध्यम चुनें।',
    aiTitle: 'AI सुरक्षा सहायक', aiSub: 'तत्काल निकासी सहायता व उत्तरजीविता प्रोटोकॉल',
    reportTitle: 'आपातकाल दर्ज करें', reportSub: 'SDRF / DDMA को लाइव GPS निर्देशांक भेजें',
    callTitle: '112 / 1078 पर कॉल करें', callSub: 'राष्ट्रीय आपातकाल व NDRF हॉटलाइन',
  },
  status: {
    grid: 'भारत आपदा ग्रिड', activeAlerts: '04 सक्रिय चेतावनियां', regionsAtRisk: '07 जोखिमग्रस्त क्षेत्र',
    advisories: '12 मौसम परामर्श', telemetry: 'अंतिम टेलीमेट्री: 2 मिनट पहले सिंक हुई',
    viewAll: 'सभी राष्ट्रीय चेतावनियां देखें',
  },
  dash: {
    eyebrow: 'स्थानीय अवलोकन', title: 'नागरिक निदान डैशबोर्ड',
    sub: 'संश्लेषित मौसम टेलीमेट्री, स्थानीय बहु-खतरा निगरानी और वायु गुणवत्ता हर 15 मिनट में अपडेट होती है।',
    weather: 'वर्तमान मौसम', change: 'बदलें', humidity: 'आर्द्रता', wind: 'हवा', rainChance: 'वर्षा संभावना',
    alertsEyebrow: 'पूर्व चेतावनियां', alertsTitle: 'सक्रिय चेतावनी बुलेटिन', viewMap: 'IMD रडार मानचित्र व चेतावनियां देखें',
    aqi: 'वायु गुणवत्ता (AQI)', viewTrend: 'पर्यावरण रुझान व जोखिम कारक देखें',
  },
  hazards: {
    eyebrow: 'व्यापक खतरा निर्देशिका', title: 'होने से पहले जानें',
    sub: 'उपमहाद्वीप के प्रमुख जलवायु व भूवैज्ञानिक खतरों के लिए स्पष्ट, जीवनरक्षक मार्गदर्शन।',
    guidelines: 'मार्गदर्शिकाएं', prev: 'पिछला खतरा', next: 'अगला खतरा',
  },
  prep: { eyebrow: 'लचीलापन ढांचा', title: 'होने से पहले तैयार रहें', explore: 'सभी सत्यापित सुरक्षा मार्गदर्शिकाएं देखें' },
  emergency: {
    title: 'आपातकालीन नागरिक हेल्पलाइन', sub: 'सत्यापित 24/7 राष्ट्रीय डिस्पैच नंबर', close: 'संवाद बंद करें',
    reportTitle: 'ज़मीनी घटना के निर्देशांक दर्ज करने हैं?',
    reportSub: 'फ़ोटो व लाइव स्थान सीधे ज़िला प्रतिक्रिया इकाई को भेजें।',
    reportBtn: 'घटना दर्ज करें',
    footer: 'आपातकालीन प्रतिक्रिया सहायता प्रणाली (ERSS) सभी राज्यों व केंद्र शासित प्रदेशों में टोल-फ्री संचालित है।',
  },
  footer: {
    tagline: 'आपदा लचीलेपन, नागरिक समन्वय और सार्वजनिक चेतावनी स्पष्टता के लिए निर्मित एक विश्वसनीय नागरिक बुनियादी ढांचा नेटवर्क।',
    platform: 'प्लेटफ़ॉर्म', preparedness: 'तैयारी', directory: 'आपातकालीन निर्देशिका',
    notice: 'सार्वजनिक सूचना: JeevanGrid राष्ट्रीय आपदा प्रबंधन प्राधिकरण (NDMA), IMD मौसम विज्ञान और राज्य आपदा प्रबंधन निकायों का पूरक नागरिक पोर्टल है। सक्रिय रेड अलर्ट में स्थानीय राज्य अधिकारियों के निर्देशों को प्राथमिकता दें।',
    rights: '© 2026 JeevanGrid. सार्वजनिक सुरक्षा बुनियादी ढांचा नेटवर्क। सत्यापित सरकारी डेटा पोर्टलों से खुली टेलीमेट्री।',
  },
  auth: {
    welcome: 'वापसी पर स्वागत है', welcomeSub: 'नागरिक पोर्टल व घटना इतिहास के लिए साइन इन करें।',
    email: 'ईमेल पता', password: 'पासवर्ड', signIn: 'साइन इन', signingIn: 'साइन इन हो रहा है…',
    noAccount: 'JeevanGrid पर नए हैं?', createAccount: 'नागरिक खाता बनाएं',
    name: 'पूरा नाम', phone: 'फ़ोन (वैकल्पिक)', confirmNote: 'डेमो खातों का पासवर्ड Password123! है।',
  },
  common: {
    loading: 'लोड हो रहा है…', retry: 'पुनः प्रयास करें', close: 'बंद करें', call112: 'अभी 112 पर कॉल करें',
    officialWarning: 'आधिकारिक चेतावनी', modelledEstimate: 'मॉडल अनुमान — आधिकारिक चेतावनी नहीं',
    demoData: 'डेमो डेटा — लाइव फ़ीड अनुपलब्ध', language: 'भाषा', listen: 'सुनें', stop: 'रोकें',
  },
};

const mr: D = {
  nav: {
    home: 'मुख्यपृष्ठ', disasters: 'आपत्ती', guides: 'सुरक्षा मार्गदर्शक', resources: 'संसाधने',
    assistant: 'AI सहाय्यक', opsDashboard: 'कार्य डॅशबोर्ड', emergencyHelp: 'आणीबाणी मदत',
    login: 'नागरिक पोर्टल / लॉगिन', tagline: 'सुरक्षित लोक. बळकट समुदाय.',
    demoMode: 'डेमो मूल्यांकन मोड:', loggedInAs: 'लॉगिन:',
    guest: 'नागरिक (पाहुणे)', switchRole: 'भूमिका बदला', selectRole: 'कार्य भूमिका निवडा',
  },
  hero: {
    eyebrow: 'सज्ज राहा. माहितीपूर्ण राहा.',
    titleA: 'प्रत्येक आपत्तीत,', titleB: 'तुम्ही एकटे नाही.',
    subtitle: 'तुमच्या परिसरातील रिअल-टाइम धोके जाणून घ्या, अधिकृत बहु-आपत्ती इशारे लवकर मिळवा आणि सत्यापित नागरी मदत एका स्पर्शात मिळवा.',
    forecastEyebrow: 'सक्रिय प्रतिबंध', forecastSource: 'IMD व CWC ग्रिड',
    forecastTitle: 'आपत्ती अंदाज तपासा',
    forecastSub: 'तुमच्या जिल्ह्याची लाइव्ह धोका स्थिती, पूर पातळी आणि कृतीयोग्य वादळ इशारे तपासा.',
    searchPlaceholder: 'शहर, जिल्हा किंवा पिन कोड लिहा (उदा. 400001 किंवा मुंबई)',
    checkRisk: 'धोका तपासा', analyzing: 'विश्लेषण सुरू आहे…',
    detectGps: 'माझे सध्याचे स्थान शोधा (GPS)', locating: 'GPS द्वारे स्थान शोधत आहे…',
    telemetryNote: 'टेलीमेट्री 2 मिनिटांपूर्वी अद्ययावत',
    triageEyebrow: 'जलद नागरिक सहाय्य', triageNote: '24/7 राष्ट्रीय डिस्पॅच',
    triageTitle: 'तुम्हाला आत्ताच मदत हवी आहे का?',
    triageSub: 'राष्ट्रीय बचाव यंत्रणांना कळवण्यासाठी किंवा आणीबाणी मार्गदर्शनासाठी सत्यापित माध्यम निवडा.',
    aiTitle: 'AI सुरक्षा सहाय्यक', aiSub: 'तात्काळ स्थलांतर सहाय्य व जगण्याचे प्रोटोकॉल',
    reportTitle: 'आणीबाणी नोंदवा', reportSub: 'SDRF / DDMA ला लाइव्ह GPS निर्देशांक पाठवा',
    callTitle: '112 / 1078 वर कॉल करा', callSub: 'राष्ट्रीय आणीबाणी व NDRF हॉटलाइन',
  },
  status: {
    grid: 'भारत आपत्ती ग्रिड', activeAlerts: '04 सक्रिय इशारे', regionsAtRisk: '07 धोकाग्रस्त प्रदेश',
    advisories: '12 हवामान सल्ले', telemetry: 'शेवटची टेलीमेट्री: 2 मिनिटांपूर्वी सिंक झाली',
    viewAll: 'सर्व राष्ट्रीय इशारे पहा',
  },
  dash: {
    eyebrow: 'स्थानिक निरीक्षण', title: 'नागरिक निदान डॅशबोर्ड',
    sub: 'संश्लेषित हवामान टेलीमेट्री, स्थानिक बहु-धोका निरीक्षणे आणि हवेची गुणवत्ता दर 15 मिनिटांनी अद्ययावत होते.',
    weather: 'सध्याचे हवामान', change: 'बदला', humidity: 'आर्द्रता', wind: 'वारा', rainChance: 'पावसाची शक्यता',
    alertsEyebrow: 'पूर्व इशारे', alertsTitle: 'सक्रिय इशारा बुलेटिन', viewMap: 'IMD रडार नकाशा व इशारे पहा',
    aqi: 'हवेची गुणवत्ता (AQI)', viewTrend: 'पर्यावरण कल व धोका घटक पहा',
  },
  hazards: {
    eyebrow: 'सर्वसमावेशक धोका निर्देशिका', title: 'घडण्यापूर्वी जाणून घ्या',
    sub: 'उपखंडातील प्रमुख हवामान व भूवैज्ञानिक धोक्यांसाठी स्पष्ट, जीव वाचवणारे मार्गदर्शन.',
    guidelines: 'मार्गदर्शक तत्त्वे', prev: 'मागील धोका', next: 'पुढील धोका',
  },
  prep: { eyebrow: 'लवचिकता आराखडा', title: 'घडण्यापूर्वी सज्ज राहा', explore: 'सर्व सत्यापित सुरक्षा मार्गदर्शक पहा' },
  emergency: {
    title: 'आणीबाणी नागरी हेल्पलाइन', sub: 'सत्यापित 24/7 राष्ट्रीय डिस्पॅच क्रमांक', close: 'संवाद बंद करा',
    reportTitle: 'जमिनीवरील घटनेचे निर्देशांक नोंदवायचे आहेत?',
    reportSub: 'फोटो व लाइव्ह स्थान थेट जिल्हा प्रतिसाद पथकाला पाठवा.',
    reportBtn: 'घटना नोंदवा',
    footer: 'आणीबाणी प्रतिसाद सहाय्य प्रणाली (ERSS) सर्व राज्ये व केंद्रशासित प्रदेशांत टोल-फ्री कार्यरत आहे.',
  },
  footer: {
    tagline: 'आपत्ती लवचिकता, नागरी समन्वय आणि सार्वजनिक इशारा स्पष्टतेसाठी तयार केलेले विश्वासार्ह नागरी पायाभूत नेटवर्क.',
    platform: 'मंच', preparedness: 'तयारी', directory: 'आणीबाणी निर्देशिका',
    notice: 'सार्वजनिक सूचना: JeevanGrid हे राष्ट्रीय आपत्ती व्यवस्थापन प्राधिकरण (NDMA), IMD हवामानशास्त्र आणि राज्य आपत्ती व्यवस्थापन यंत्रणांना पूरक नागरिक पोर्टल आहे. सक्रिय रेड अलर्टमध्ये स्थानिक राज्य प्राधिकरणांच्या निर्देशांना प्राधान्य द्या.',
    rights: '© 2026 JeevanGrid. सार्वजनिक सुरक्षा पायाभूत नेटवर्क. सत्यापित शासकीय डेटा पोर्टलमधून खुली टेलीमेट्री.',
  },
  auth: {
    welcome: 'परत स्वागत आहे', welcomeSub: 'नागरिक पोर्टल व घटना इतिहासासाठी साइन इन करा.',
    email: 'ईमेल पत्ता', password: 'पासवर्ड', signIn: 'साइन इन', signingIn: 'साइन इन होत आहे…',
    noAccount: 'JeevanGrid वर नवीन आहात?', createAccount: 'नागरिक खाते तयार करा',
    name: 'पूर्ण नाव', phone: 'फोन (ऐच्छिक)', confirmNote: 'डेमो खात्यांचा पासवर्ड Password123! आहे.',
  },
  common: {
    loading: 'लोड होत आहे…', retry: 'पुन्हा प्रयत्न करा', close: 'बंद करा', call112: 'आत्ताच 112 वर कॉल करा',
    officialWarning: 'अधिकृत इशारा', modelledEstimate: 'मॉडेल अंदाज — अधिकृत इशारा नाही',
    demoData: 'डेमो डेटा — लाइव्ह फीड अनुपलब्ध', language: 'भाषा', listen: 'ऐका', stop: 'थांबवा',
  },
};

const gu: D = {
  nav: {
    home: 'હોમ', disasters: 'આપત્તિઓ', guides: 'સુરક્ષા માર્ગદર્શિકા', resources: 'સંસાધનો',
    assistant: 'AI સહાયક', opsDashboard: 'ઓપ્સ ડેશબોર્ડ', emergencyHelp: 'કટોકટી મદદ',
    login: 'નાગરિક પોર્ટલ / લોગિન', tagline: 'સુરક્ષિત લોકો. મજબૂત સમુદાયો.',
    demoMode: 'ડેમો મૂલ્યાંકન મોડ:', loggedInAs: 'લોગિન:',
    guest: 'નાગરિક (મહેમાન)', switchRole: 'ભૂમિકા બદલો', selectRole: 'કાર્યકારી ભૂમિકા પસંદ કરો',
  },
  hero: {
    eyebrow: 'તૈયાર રહો. માહિતગાર રહો.',
    titleA: 'દરેક આપત્તિમાં,', titleB: 'તમે એકલા નથી.',
    subtitle: 'તમારા વિસ્તારના રિયલ-ટાઇમ જોખમો જાણો, સત્તાવાર બહુ-આપત્તિ ચેતવણીઓ વહેલી મેળવો અને ચકાસેલ નાગરિક સહાય એક સ્પર્શમાં મેળવો.',
    forecastEyebrow: 'સક્રિય નિવારણ', forecastSource: 'IMD અને CWC ગ્રિડ',
    forecastTitle: 'આપત્તિ આગાહી તપાસો',
    forecastSub: 'તમારા જિલ્લાની લાઇવ જોખમ સ્થિતિ, પૂર સ્તર અને કાર્યવાહીયોગ્ય તોફાન ચેતવણીઓ તપાસો.',
    searchPlaceholder: 'શહેર, જિલ્લો અથવા પિન કોડ લખો (દા.ત. 400001 અથવા મુંબઈ)',
    checkRisk: 'જોખમ તપાસો', analyzing: 'વિશ્લેષણ ચાલી રહ્યું છે…',
    detectGps: 'મારું વર્તમાન સ્થાન શોધો (GPS)', locating: 'GPS દ્વારા સ્થાન શોધાઈ રહ્યું છે…',
    telemetryNote: 'ટેલિમેટ્રી 2 મિનિટ પહેલા અપડેટ થઈ',
    triageEyebrow: 'ઝડપી નાગરિક સહાય', triageNote: '24/7 રાષ્ટ્રીય ડિસ્પેચ',
    triageTitle: 'શું તમને અત્યારે મદદ જોઈએ છે?',
    triageSub: 'રાષ્ટ્રીય બચાવ સત્તામંડળોને જાણ કરવા અથવા કટોકટી માર્ગદર્શન માટે ચકાસેલ માધ્યમ પસંદ કરો.',
    aiTitle: 'AI સુરક્ષા સહાયક', aiSub: 'તાત્કાલિક સ્થળાંતર સહાય અને જીવનરક્ષા પ્રોટોકોલ',
    reportTitle: 'કટોકટી નોંધાવો', reportSub: 'SDRF / DDMA ને લાઇવ GPS કોઓર્ડિનેટ્સ મોકલો',
    callTitle: '112 / 1078 પર કૉલ કરો', callSub: 'રાષ્ટ્રીય કટોકટી અને NDRF હોટલાઇન',
  },
  status: {
    grid: 'ભારત આપત્તિ ગ્રિડ', activeAlerts: '04 સક્રિય ચેતવણીઓ', regionsAtRisk: '07 જોખમગ્રસ્ત પ્રદેશો',
    advisories: '12 હવામાન સલાહો', telemetry: 'છેલ્લી ટેલિમેટ્રી: 2 મિનિટ પહેલા સિંક થઈ',
    viewAll: 'બધી રાષ્ટ્રીય ચેતવણીઓ જુઓ',
  },
  dash: {
    eyebrow: 'સ્થાનિક નિરીક્ષણ', title: 'નાગરિક નિદાન ડેશબોર્ડ',
    sub: 'સંશ્લેષિત હવામાન ટેલિમેટ્રી, સ્થાનિક બહુ-જોખમ દેખરેખ અને હવાની ગુણવત્તા દર 15 મિનિટે અપડેટ થાય છે.',
    weather: 'વર્તમાન હવામાન', change: 'બદલો', humidity: 'ભેજ', wind: 'પવન', rainChance: 'વરસાદની શક્યતા',
    alertsEyebrow: 'પૂર્વ ચેતવણીઓ', alertsTitle: 'સક્રિય ચેતવણી બુલેટિન', viewMap: 'IMD રડાર નકશો અને ચેતવણીઓ જુઓ',
    aqi: 'હવાની ગુણવત્તા (AQI)', viewTrend: 'પર્યાવરણીય વલણ અને જોખમ પરિબળો જુઓ',
  },
  hazards: {
    eyebrow: 'વ્યાપક જોખમ નિર્દેશિકા', title: 'થાય તે પહેલા જાણો',
    sub: 'ઉપખંડના મુખ્ય આબોહવા અને ભૂસ્તરીય જોખમો માટે સ્પષ્ટ, જીવનરક્ષક માર્ગદર્શન.',
    guidelines: 'માર્ગદર્શિકાઓ', prev: 'પાછલું જોખમ', next: 'આગલું જોખમ',
  },
  prep: { eyebrow: 'સ્થિતિસ્થાપકતા માળખું', title: 'થાય તે પહેલા તૈયાર રહો', explore: 'બધી ચકાસેલ સુરક્ષા માર્ગદર્શિકાઓ જુઓ' },
  emergency: {
    title: 'કટોકટી નાગરિક હેલ્પલાઇન', sub: 'ચકાસેલ 24/7 રાષ્ટ્રીય ડિસ્પેચ નંબરો', close: 'સંવાદ બંધ કરો',
    reportTitle: 'ઘટનાસ્થળના કોઓર્ડિનેટ્સ નોંધાવવા છે?',
    reportSub: 'ફોટો અને લાઇવ સ્થાન સીધું જિલ્લા પ્રતિભાવ એકમને મોકલો.',
    reportBtn: 'ઘટના નોંધાવો',
    footer: 'કટોકટી પ્રતિભાવ સહાય પ્રણાલી (ERSS) તમામ રાજ્યો અને કેન્દ્રશાસિત પ્રદેશોમાં ટોલ-ફ્રી કાર્યરત છે.',
  },
  footer: {
    tagline: 'આપત્તિ સ્થિતિસ્થાપકતા, નાગરિક સંકલન અને જાહેર ચેતવણી સ્પષ્ટતા માટે રચાયેલ વિશ્વસનીય નાગરિક માળખું નેટવર્ક.',
    platform: 'પ્લેટફોર્મ', preparedness: 'તૈયારી', directory: 'કટોકટી નિર્દેશિકા',
    notice: 'જાહેર સૂચના: JeevanGrid રાષ્ટ્રીય આપત્તિ વ્યવસ્થાપન સત્તામંડળ (NDMA), IMD હવામાન અને રાજ્ય આપત્તિ વ્યવસ્થાપન સંસ્થાઓનું પૂરક નાગરિક પોર્ટલ છે. સક્રિય રેડ એલર્ટમાં સ્થાનિક રાજ્ય સત્તામંડળોના નિર્દેશોને પ્રાધાન્ય આપો.',
    rights: '© 2026 JeevanGrid. જાહેર સુરક્ષા માળખું નેટવર્ક. ચકાસેલ સરકારી ડેટા પોર્ટલોમાંથી ખુલ્લી ટેલિમેટ્રી.',
  },
  auth: {
    welcome: 'પાછા આવો', welcomeSub: 'નાગરિક પોર્ટલ અને ઘટના ઇતિહાસ માટે સાઇન ઇન કરો.',
    email: 'ઇમેઇલ સરનામું', password: 'પાસવર્ડ', signIn: 'સાઇન ઇન', signingIn: 'સાઇન ઇન થઈ રહ્યું છે…',
    noAccount: 'JeevanGrid પર નવા છો?', createAccount: 'નાગરિક ખાતું બનાવો',
    name: 'પૂરું નામ', phone: 'ફોન (વૈકલ્પિક)', confirmNote: 'ડેમો ખાતાઓનો પાસવર્ડ Password123! છે.',
  },
  common: {
    loading: 'લોડ થઈ રહ્યું છે…', retry: 'ફરી પ્રયાસ કરો', close: 'બંધ કરો', call112: 'અત્યારે 112 પર કૉલ કરો',
    officialWarning: 'સત્તાવાર ચેતવણી', modelledEstimate: 'મોડેલ અંદાજ — સત્તાવાર ચેતવણી નથી',
    demoData: 'ડેમો ડેટા — લાઇવ ફીડ અનુપલબ્ધ', language: 'ભાષા', listen: 'સાંભળો', stop: 'રોકો',
  },
};

const as: D = {
  nav: {
    home: 'ঘৰ', disasters: 'দুৰ্যোগ', guides: 'সুৰক্ষা নিৰ্দেশনা', resources: 'সম্পদ',
    assistant: 'AI সহায়ক', opsDashboard: 'কাৰ্য ডেশ্বব’ৰ্ড', emergencyHelp: 'জৰুৰী সহায়',
    login: 'নাগৰিক প’ৰ্টেল / লগইন', tagline: 'নিৰাপদ মানুহ। শক্তিশালী সমাজ।',
    demoMode: 'ডেমো মূল্যায়ন ম’ড:', loggedInAs: 'লগইন:',
    guest: 'নাগৰিক (অতিথি)', switchRole: 'ভূমিকা সলনি', selectRole: 'কাৰ্যকৰী ভূমিকা বাছক',
  },
  hero: {
    eyebrow: 'সাজু থাকক। অৱগত থাকক।',
    titleA: 'প্ৰতিটো দুৰ্যোগত,', titleB: 'আপুনি অকলশৰীয়া নহয়।',
    subtitle: 'আপোনাৰ চৌপাশৰ ৰিয়েল-টাইম বিপদ জানক, চৰকাৰী বহু-বিপদ সতৰ্কবাণী সোনকালে পাওক আৰু যাচাইকৃত নাগৰিক সহায় এক স্পৰ্শতে লওক।',
    forecastEyebrow: 'সক্ৰিয় প্ৰতিৰোধ', forecastSource: 'IMD আৰু CWC গ্ৰিড',
    forecastTitle: 'দুৰ্যোগ পূৰ্বাভাস পৰীক্ষা কৰক',
    forecastSub: 'আপোনাৰ জিলাৰ লাইভ বিপদ স্থিতি, বানৰ স্তৰ আৰু কাৰ্যকৰী ধুমুহা সতৰ্কবাণী চাওক।',
    searchPlaceholder: 'চহৰ, জিলা বা পিন ক’ড লিখক (যেনে 400001 বা মুম্বাই)',
    checkRisk: 'বিপদ পৰীক্ষা', analyzing: 'বিশ্লেষণ চলি আছে…',
    detectGps: 'মোৰ বৰ্তমান স্থান বিচাৰক (GPS)', locating: 'GPS ৰে স্থান বিচাৰি আছে…',
    telemetryNote: 'টেলিমেট্ৰি 2 মিনিট আগত আপডেট হ’ল',
    triageEyebrow: 'দ্ৰুত নাগৰিক সহায়', triageNote: '24/7 ৰাষ্ট্ৰীয় ডেস্পেচ',
    triageTitle: 'আপোনাক এতিয়াই সহায় লাগেনে?',
    triageSub: 'ৰাষ্ট্ৰীয় উদ্ধাৰ কৰ্তৃপক্ষক জনাবলৈ বা জৰুৰী নিৰ্দেশনা পাবলৈ যাচাইকৃত মাধ্যম বাছক।',
    aiTitle: 'AI সুৰক্ষা সহায়ক', aiSub: 'তাৎক্ষণিক স্থানান্তৰ সহায় আৰু জীৱনৰক্ষা প্ৰট’কল',
    reportTitle: 'জৰুৰী অৱস্থা জনাওক', reportSub: 'SDRF / DDMA লৈ লাইভ GPS স্থানাংক পঠাওক',
    callTitle: '112 / 1078 লৈ কল কৰক', callSub: 'ৰাষ্ট্ৰীয় জৰুৰী আৰু NDRF হটলাইন',
  },
  status: {
    grid: 'ভাৰত দুৰ্যোগ গ্ৰিড', activeAlerts: '04 সক্ৰিয় সতৰ্কবাণী', regionsAtRisk: '07 বিপদগ্ৰস্ত অঞ্চল',
    advisories: '12 বতৰ পৰামৰ্শ', telemetry: 'শেহতীয়া টেলিমেট্ৰি: 2 মিনিট আগত ছিংক হ’ল',
    viewAll: 'সকলো ৰাষ্ট্ৰীয় সতৰ্কবাণী চাওক',
  },
  dash: {
    eyebrow: 'স্থানীয় নিৰীক্ষণ', title: 'নাগৰিক নিৰ্ণয় ডেশ্বব’ৰ্ড',
    sub: 'সংশ্লেষিত বতৰ টেলিমেট্ৰি, স্থানীয় বহু-বিপদ নিৰীক্ষণ আৰু বায়ুৰ মান প্ৰতি 15 মিনিটত আপডেট হয়।',
    weather: 'বৰ্তমান বতৰ', change: 'সলনি', humidity: 'আৰ্দ্ৰতা', wind: 'বতাহ', rainChance: 'বৰষুণৰ সম্ভাৱনা',
    alertsEyebrow: 'পূৰ্ব সতৰ্কবাণী', alertsTitle: 'সক্ৰিয় সতৰ্কবাণী বুলেটিন', viewMap: 'IMD ৰাডাৰ মানচিত্ৰ আৰু সতৰ্কবাণী চাওক',
    aqi: 'বায়ুৰ মান (AQI)', viewTrend: 'পৰিৱেশৰ ধাৰা আৰু বিপদ কাৰক চাওক',
  },
  hazards: {
    eyebrow: 'ব্যাপক বিপদ নিৰ্দেশিকা', title: 'ঘটনাৰ আগতেই জানক',
    sub: 'উপমহাদেশৰ মুখ্য জলবায়ু আৰু ভূতাত্ত্বিক বিপদৰ বাবে স্পষ্ট, জীৱনৰক্ষাকাৰী নিৰ্দেশনা।',
    guidelines: 'নিৰ্দেশনা', prev: 'আগৰ বিপদ', next: 'পিছৰ বিপদ',
  },
  prep: { eyebrow: 'সহনশীলতা কাঠামো', title: 'ঘটনাৰ আগতেই সাজু থাকক', explore: 'সকলো যাচাইকৃত সুৰক্ষা নিৰ্দেশনা চাওক' },
  emergency: {
    title: 'জৰুৰী নাগৰিক হেল্পলাইন', sub: 'যাচাইকৃত 24/7 ৰাষ্ট্ৰীয় ডেস্পেচ নম্বৰ', close: 'সংলাপ বন্ধ কৰক',
    reportTitle: 'ঘটনাস্থলীৰ স্থানাংক জনাব লাগে?',
    reportSub: 'ফটো আৰু লাইভ স্থান পোনে পোনে জিলা প্ৰতিক্ৰিয়া গোটলৈ পঠাওক।',
    reportBtn: 'ঘটনা জনাওক',
    footer: 'জৰুৰী প্ৰতিক্ৰিয়া সহায় ব্যৱস্থা (ERSS) সকলো ৰাজ্য আৰু কেন্দ্ৰীয় শাসিত অঞ্চলত টোল-ফ্ৰীভাৱে চলে।',
  },
  footer: {
    tagline: 'দুৰ্যোগ সহনশীলতা, নাগৰিক সমন্বয় আৰু ৰাজহুৱা সতৰ্কবাণী স্পষ্টতাৰ বাবে নিৰ্মিত নিৰ্ভৰযোগ্য নাগৰিক আন্তঃগাঁথনি নেটৱৰ্ক।',
    platform: 'মঞ্চ', preparedness: 'প্ৰস্তুতি', directory: 'জৰুৰী নিৰ্দেশিকা',
    notice: 'ৰাজহুৱা জাননী: JeevanGrid ৰাষ্ট্ৰীয় দুৰ্যোগ ব্যৱস্থাপনা কৰ্তৃপক্ষ (NDMA), IMD বতৰ বিজ্ঞান আৰু ৰাজ্য দুৰ্যোগ ব্যৱস্থাপনা সংস্থাৰ পৰিপূৰক নাগৰিক প’ৰ্টেল। সক্ৰিয় ৰেড এলাৰ্টত স্থানীয় ৰাজ্য কৰ্তৃপক্ষৰ নিৰ্দেশক অগ্ৰাধিকাৰ দিয়ক।',
    rights: '© 2026 JeevanGrid. ৰাজহুৱা সুৰক্ষা আন্তঃগাঁথনি নেটৱৰ্ক। যাচাইকৃত চৰকাৰী তথ্য প’ৰ্টেলৰ পৰা মুকলি টেলিমেট্ৰি।',
  },
  auth: {
    welcome: 'পুনৰ স্বাগতম', welcomeSub: 'নাগৰিক প’ৰ্টেল আৰু ঘটনা ইতিহাসৰ বাবে ছাইন ইন কৰক।',
    email: 'ইমেইল ঠিকনা', password: 'পাছৱৰ্ড', signIn: 'ছাইন ইন', signingIn: 'ছাইন ইন হৈ আছে…',
    noAccount: 'JeevanGrid ত নতুন?', createAccount: 'নাগৰিক একাউণ্ট বনাওক',
    name: 'সম্পূৰ্ণ নাম', phone: 'ফোন (ঐচ্ছিক)', confirmNote: 'ডেমো একাউণ্টৰ পাছৱৰ্ড Password123!।',
  },
  common: {
    loading: 'ল’ড হৈ আছে…', retry: 'পুনৰ চেষ্টা', close: 'বন্ধ', call112: 'এতিয়াই 112 লৈ কল কৰক',
    officialWarning: 'চৰকাৰী সতৰ্কবাণী', modelledEstimate: 'মডেল অনুমান — চৰকাৰী সতৰ্কবাণী নহয়',
    demoData: 'ডেমো তথ্য — লাইভ ফিড অনুপলব্ধ', language: 'ভাষা', listen: 'শুনক', stop: 'ৰখাওক',
  },
};

export const DICTIONARIES: Record<AppLang, GlobalDict> = { en, hi, mr, gu, as };

/** Dot-path lookup with English fallback (never crashes on missing keys). */
export function lookup(lang: AppLang, path: string): string {
  const get = (d: GlobalDict): unknown =>
    path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), d);
  const v = get(DICTIONARIES[lang]);
  if (typeof v === 'string') return v;
  const fb = get(DICTIONARIES.en);
  return typeof fb === 'string' ? fb : path;
}
