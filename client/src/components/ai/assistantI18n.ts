/**
 * Assistant i18n — UI chrome, suggestions, section titles, emergency copy.
 * Extensible: add a language key + dictionary to support a new language.
 * Dynamic AI body text stays in the requested language via the backend
 * orchestrator; English fallback is always explicitly labelled.
 */

export type AssistantLang = 'en' | 'hi' | 'mr' | 'gu' | 'as';

export const ASSISTANT_LANGS: Array<{ code: AssistantLang; label: string; speech: string }> = [
  { code: 'en', label: 'English', speech: 'en-IN' },
  { code: 'hi', label: 'हिन्दी', speech: 'hi-IN' },
  { code: 'mr', label: 'मराठी', speech: 'mr-IN' },
  { code: 'gu', label: 'ગુજરાતી', speech: 'gu-IN' },
  { code: 'as', label: 'অসমীয়া', speech: 'as-IN' },
];

interface Dict {
  statusOnline: string;
  statusConnecting: string;
  statusDegraded: string;
  statusOffline: string;
  introTitle: string;
  introSub: string;
  contextTitle: string;
  setLocationPrompt: string;
  changeLocation: string;
  useMyLocation: string;
  locating: string;
  riskLabel: string;
  dataUpdated: string;
  suggestionsTitle: string;
  composerPlaceholder: string;
  send: string;
  listen: string;
  reading: string;
  stop: string;
  voiceReady: string;
  voiceRecording: string;
  voiceProcessing: string;
  voiceError: string;
  voiceUnsupported: string;
  micDenied: string;
  transcriptReady: string;
  editBeforeSend: string;
  needRescue: string;
  emergencyTitle: string;
  emergencySub: string;
  call112: string;
  findHospital: string;
  findShelter: string;
  shareLocation: string;
  copied: string;
  actions: Array<{ label: string; sub: string; query: string }>;
  suggestHigh: string[];
  suggestQuake: string[];
  suggestCalm: string[];
  sectionTitles: Record<string, string>;
  sourceKinds: Record<string, string>;
  toolWorking: string;
  toolDone: string;
  viewDetails: string;
  hideDetails: string;
  demoNote: string;
  langFallbackNote: string;
}

export const STRINGS: Record<AssistantLang, Dict> = {
  en: {
    statusOnline: 'Safety Intelligence Online',
    statusConnecting: 'Connecting…',
    statusDegraded: 'Degraded — local engine active',
    statusOffline: 'Offline — check connection',
    introTitle: 'How can we help you stay safe?',
    introSub: 'Ask about a disaster, check your local risk, find nearby emergency facilities, or get step-by-step safety guidance.',
    contextTitle: 'Your area',
    setLocationPrompt: 'Set your location to receive local safety guidance.',
    changeLocation: 'Change location',
    useMyLocation: 'Use my current location',
    locating: 'Locating…',
    riskLabel: 'Risk',
    dataUpdated: 'Data updated',
    suggestionsTitle: 'Suggested questions',
    composerPlaceholder: 'Ask an emergency question, or tap the mic to speak…',
    send: 'Send',
    listen: 'Listen',
    reading: 'Reading…',
    stop: 'Stop',
    voiceReady: 'Tap the microphone and speak',
    voiceRecording: 'Listening… tap stop when done',
    voiceProcessing: 'Processing audio…',
    voiceError: 'Could not understand audio. Please try again or type.',
    voiceUnsupported: 'Voice input is not supported in this browser. Please type instead.',
    micDenied: 'Microphone access was denied. Allow it in browser settings or type instead.',
    transcriptReady: 'Transcript ready — review and edit, then send.',
    editBeforeSend: 'Review the transcript before sending.',
    needRescue: 'Need direct rescue? Call 112',
    emergencyTitle: 'Emergency assistance',
    emergencySub: 'If you are in immediate danger, call now. This assistant cannot dispatch rescue teams.',
    call112: 'Call 112',
    findHospital: 'Find nearest hospital',
    findShelter: 'Find nearest shelter',
    shareLocation: 'Share location',
    copied: 'Location copied',
    actions: [
      { label: 'Check my local risk', sub: 'Live risk for your area', query: 'Is my area safe right now?' },
      { label: 'What should I do now?', sub: 'Immediate safety steps', query: 'What should I do right now to stay safe?' },
      { label: 'Find nearby help', sub: 'Hospitals and shelters', query: 'Find nearby hospitals and shelters.' },
      { label: 'Prepare for a disaster', sub: '72-hour readiness', query: 'How should I prepare my family for a disaster?' },
      { label: 'Report an emergency', sub: 'File an incident report', query: '__action:report' },
      { label: 'Emergency contacts', sub: '112, 1078, 108…', query: 'Show me emergency contact numbers.' },
    ],
    suggestHigh: [
      'Is my area currently at flood risk?',
      'What should I keep ready tonight?',
      'Find nearby shelters.',
      'Where is the nearest hospital?',
    ],
    suggestQuake: [
      'What should I do during an earthquake?',
      'How do I make my home safer?',
      'Show emergency contacts.',
    ],
    suggestCalm: [
      'How should I prepare for floods?',
      'What should I keep in an emergency kit?',
      'Check my local risk.',
      'Show emergency contacts.',
    ],
    sectionTitles: {
      emergency: 'Emergency assistance', answer: 'Guidance', situation: 'Current situation',
      risk: 'Risk level', weather: 'Weather', aqi: 'Air quality', quakes: 'Earthquakes',
      alerts: 'Official warnings', help: 'Nearby help', contacts: 'Emergency contacts',
      district: 'District information', do: 'What to do now', intro: 'What this assistant can do',
      note: 'Please note',
    },
    sourceKinds: { live: 'Live data', official: 'Official source', model: 'Modelled estimate', guidance: 'General guidance' },
    toolWorking: 'Checking local conditions…',
    toolDone: 'Local safety assessment completed',
    viewDetails: 'View details',
    hideDetails: 'Hide details',
    demoNote: 'Demo data — live feed unavailable',
    langFallbackNote: 'Showing English — this language is not supported yet.',
  },
  hi: {
    statusOnline: 'सुरक्षा इंटेलिजेंस ऑनलाइन',
    statusConnecting: 'जुड़ रहा है…',
    statusDegraded: 'सीमित सेवा — स्थानीय इंजन सक्रिय',
    statusOffline: 'ऑफ़लाइन — कनेक्शन जांचें',
    introTitle: 'आपकी सुरक्षा में हम कैसे मदद करें?',
    introSub: 'किसी आपदा के बारे में पूछें, अपने क्षेत्र का जोखिम जांचें, नज़दीकी सहायता खोजें या चरण-दर-चरण सुरक्षा मार्गदर्शन पाएं।',
    contextTitle: 'आपका क्षेत्र',
    setLocationPrompt: 'स्थानीय सुरक्षा मार्गदर्शन के लिए अपना स्थान निर्धारित करें।',
    changeLocation: 'स्थान बदलें',
    useMyLocation: 'मेरा वर्तमान स्थान उपयोग करें',
    locating: 'स्थान खोजा जा रहा है…',
    riskLabel: 'जोखिम',
    dataUpdated: 'डेटा अपडेट',
    suggestionsTitle: 'सुझाए गए प्रश्न',
    composerPlaceholder: 'आपातकालीन प्रश्न पूछें, या बोलने के लिए माइक दबाएं…',
    send: 'भेजें',
    listen: 'सुनें',
    reading: 'पढ़ा जा रहा है…',
    stop: 'रोकें',
    voiceReady: 'माइक्रोफ़ोन दबाकर बोलें',
    voiceRecording: 'सुना जा रहा है… समाप्त होने पर रोकें दबाएं',
    voiceProcessing: 'ऑडियो संसाधित हो रहा है…',
    voiceError: 'ऑडियो समझ नहीं आया। पुनः प्रयास करें या लिखें।',
    voiceUnsupported: 'इस ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। कृपया लिखें।',
    micDenied: 'माइक्रोफ़ोन की अनुमति नहीं मिली। सेटिंग में अनुमति दें या लिखें।',
    transcriptReady: 'प्रतिलेख तैयार — समीक्षा करें, संपादित करें, फिर भेजें।',
    editBeforeSend: 'भेजने से पहले प्रतिलेख की समीक्षा करें।',
    needRescue: 'सीधे बचाव चाहिए? 112 पर कॉल करें',
    emergencyTitle: 'आपातकालीन सहायता',
    emergencySub: 'यदि आप तत्काल खतरे में हैं, तो अभी कॉल करें। यह सहायक बचाव दल नहीं भेज सकता।',
    call112: '112 पर कॉल करें',
    findHospital: 'नज़दीकी अस्पताल खोजें',
    findShelter: 'नज़दीकी आश्रय खोजें',
    shareLocation: 'स्थान साझा करें',
    copied: 'स्थान कॉपी हुआ',
    actions: [
      { label: 'मेरा स्थानीय जोखिम जांचें', sub: 'आपके क्षेत्र का लाइव जोखिम', query: 'Is my area safe right now?' },
      { label: 'मुझे अभी क्या करना चाहिए?', sub: 'तत्काल सुरक्षा कदम', query: 'What should I do right now to stay safe?' },
      { label: 'नज़दीकी सहायता खोजें', sub: 'अस्पताल और आश्रय', query: 'Find nearby hospitals and shelters.' },
      { label: 'आपदा की तैयारी करें', sub: '72 घंटे की तैयारी', query: 'How should I prepare my family for a disaster?' },
      { label: 'आपातकाल दर्ज करें', sub: 'घटना रिपोर्ट दर्ज करें', query: '__action:report' },
      { label: 'आपातकालीन संपर्क', sub: '112, 1078, 108…', query: 'Show me emergency contact numbers.' },
    ],
    suggestHigh: ['क्या मेरे क्षेत्र में अभी बाढ़ का खतरा है?', 'आज रात क्या तैयार रखूं?', 'नज़दीकी आश्रय खोजें।', 'नज़दीकी अस्पताल कहां है?'],
    suggestQuake: ['भूकंप के दौरान क्या करूं?', 'घर को सुरक्षित कैसे बनाऊं?', 'आपातकालीन संपर्क दिखाएं।'],
    suggestCalm: ['बाढ़ की तैयारी कैसे करूं?', 'आपातकालीन किट में क्या रखूं?', 'मेरा स्थानीय जोखिम जांचें।', 'आपातकालीन संपर्क दिखाएं।'],
    sectionTitles: {
      emergency: 'आपातकालीन सहायता', answer: 'मार्गदर्शन', situation: 'वर्तमान स्थिति',
      risk: 'जोखिम स्तर', weather: 'मौसम', aqi: 'वायु गुणवत्ता', quakes: 'भूकंप',
      alerts: 'आधिकारिक चेतावनी', help: 'नज़दीकी सहायता', contacts: 'आपातकालीन संपर्क',
      district: 'ज़िले की जानकारी', do: 'अभी क्या करें', intro: 'यह सहायक क्या कर सकता है',
      note: 'कृपया ध्यान दें',
    },
    sourceKinds: { live: 'लाइव डेटा', official: 'आधिकारिक स्रोत', model: 'मॉडल अनुमान', guidance: 'सामान्य मार्गदर्शन' },
    toolWorking: 'स्थानीय स्थिति जांची जा रही है…',
    toolDone: 'स्थानीय सुरक्षा आकलन पूर्ण',
    viewDetails: 'विवरण देखें',
    hideDetails: 'विवरण छिपाएं',
    demoNote: 'डेमो डेटा — लाइव फ़ीड अनुपलब्ध',
    langFallbackNote: 'अंग्रेज़ी में दिखाया जा रहा है — यह भाषा अभी समर्थित नहीं है।',
  },
  mr: {
    statusOnline: 'सुरक्षा इंटेलिजेंस ऑनलाइन',
    statusConnecting: 'जोडत आहे…',
    statusDegraded: 'मर्यादित सेवा — स्थानिक इंजिन सक्रिय',
    statusOffline: 'ऑफलाइन — कनेक्शन तपासा',
    introTitle: 'तुम्ही सुरक्षित राहण्यासाठी आम्ही कशी मदत करू?',
    introSub: 'आपत्तीबद्दल विचारा, तुमच्या भागाचा धोका तपासा, जवळची मदत शोधा किंवा टप्प्याटप्प्याने सुरक्षा मार्गदर्शन मिळवा.',
    contextTitle: 'तुमचा भाग',
    setLocationPrompt: 'स्थानिक सुरक्षा मार्गदर्शनासाठी तुमचे स्थान निश्चित करा.',
    changeLocation: 'स्थान बदला',
    useMyLocation: 'माझे सध्याचे स्थान वापरा',
    locating: 'स्थान शोधत आहे…',
    riskLabel: 'धोका',
    dataUpdated: 'डेटा अद्ययावत',
    suggestionsTitle: 'सुचवलेले प्रश्न',
    composerPlaceholder: 'आणीबाणीचा प्रश्न विचारा, किंवा बोलण्यासाठी माइक दाबा…',
    send: 'पाठवा',
    listen: 'ऐका',
    reading: 'वाचत आहे…',
    stop: 'थांबवा',
    voiceReady: 'मायक्रोफोन दाबून बोला',
    voiceRecording: 'ऐकत आहे… पूर्ण झाल्यावर थांबवा दाबा',
    voiceProcessing: 'ऑडिओ प्रक्रिया सुरू आहे…',
    voiceError: 'ऑडिओ समजला नाही. पुन्हा प्रयत्न करा किंवा लिहा.',
    voiceUnsupported: 'या ब्राउझरमध्ये व्हॉइस इनपुट समर्थित नाही. कृपया लिहा.',
    micDenied: 'मायक्रोफोन परवानगी नाकारली. सेटिंग्जमध्ये परवानगी द्या किंवा लिहा.',
    transcriptReady: 'प्रतिलेख तयार — तपासा, संपादित करा, मग पाठवा.',
    editBeforeSend: 'पाठवण्यापूर्वी प्रतिलेख तपासा.',
    needRescue: 'थेट बचाव हवा आहे? 112 वर कॉल करा',
    emergencyTitle: 'आणीबाणी सहाय्य',
    emergencySub: 'तुम्ही तात्काळ धोक्यात असाल तर आत्ताच कॉल करा. हा सहाय्यक बचाव पथक पाठवू शकत नाही.',
    call112: '112 वर कॉल करा',
    findHospital: 'जवळचे रुग्णालय शोधा',
    findShelter: 'जवळचा निवारा शोधा',
    shareLocation: 'स्थान सामायिक करा',
    copied: 'स्थान कॉपी झाले',
    actions: [
      { label: 'माझा स्थानिक धोका तपासा', sub: 'तुमच्या भागाचा लाइव्ह धोका', query: 'Is my area safe right now?' },
      { label: 'मी आत्ता काय करावे?', sub: 'तात्काळ सुरक्षा पावले', query: 'What should I do right now to stay safe?' },
      { label: 'जवळची मदत शोधा', sub: 'रुग्णालये आणि निवारे', query: 'Find nearby hospitals and shelters.' },
      { label: 'आपत्तीची तयारी करा', sub: '72 तासांची तयारी', query: 'How should I prepare my family for a disaster?' },
      { label: 'आणीबाणी नोंदवा', sub: 'घटना अहवाल दाखल करा', query: '__action:report' },
      { label: 'आणीबाणी संपर्क', sub: '112, 1078, 108…', query: 'Show me emergency contact numbers.' },
    ],
    suggestHigh: ['माझ्या भागात सध्या पूरधोका आहे का?', 'आज रात्री काय तयार ठेवू?', 'जवळचे निवारे शोधा.', 'जवळचे रुग्णालय कुठे आहे?'],
    suggestQuake: ['भूकंपादरम्यान काय करावे?', 'घर सुरक्षित कसे करावे?', 'आणीबाणी संपर्क दाखवा.'],
    suggestCalm: ['पुराची तयारी कशी करावी?', 'आणीबाणी किटमध्ये काय ठेवावे?', 'माझा स्थानिक धोका तपासा.', 'आणीबाणी संपर्क दाखवा.'],
    sectionTitles: {
      emergency: 'आणीबाणी सहाय्य', answer: 'मार्गदर्शन', situation: 'सध्याची स्थिती',
      risk: 'धोका पातळी', weather: 'हवामान', aqi: 'हवेची गुणवत्ता', quakes: 'भूकंप',
      alerts: 'अधिकृत इशारे', help: 'जवळची मदत', contacts: 'आणीबाणी संपर्क',
      district: 'जिल्हा माहिती', do: 'आत्ता काय करावे', intro: 'हा सहाय्यक काय करू शकतो',
      note: 'कृपया लक्षात घ्या',
    },
    sourceKinds: { live: 'लाइव्ह डेटा', official: 'अधिकृत स्रोत', model: 'मॉडेल अंदाज', guidance: 'सामान्य मार्गदर्शन' },
    toolWorking: 'स्थानिक परिस्थिती तपासत आहे…',
    toolDone: 'स्थानिक सुरक्षा मूल्यांकन पूर्ण',
    viewDetails: 'तपशील पहा',
    hideDetails: 'तपशील लपवा',
    demoNote: 'डेमो डेटा — लाइव्ह फीड अनुपलब्ध',
    langFallbackNote: 'इंग्रजीत दाखवत आहे — ही भाषा अद्याप समर्थित नाही.',
  },
  gu: {
    statusOnline: 'સુરક્ષા ઇન્ટેલિજન્સ ઓનલાઇન',
    statusConnecting: 'જોડાઈ રહ્યું છે…',
    statusDegraded: 'મર્યાદિત સેવા — સ્થાનિક એન્જિન સક્રિય',
    statusOffline: 'ઓફલાઇન — કનેક્શન તપાસો',
    introTitle: 'તમે સુરક્ષિત રહો તેમાં અમે કેવી રીતે મદદ કરીએ?',
    introSub: 'આપત્તિ વિશે પૂછો, તમારા વિસ્તારનું જોખમ તપાસો, નજીકની મદદ શોધો અથવા તબક્કાવાર સુરક્ષા માર્ગદર્શન મેળવો.',
    contextTitle: 'તમારો વિસ્તાર',
    setLocationPrompt: 'સ્થાનિક સુરક્ષા માર્ગદર્શન માટે તમારું સ્થાન નક્કી કરો.',
    changeLocation: 'સ્થાન બદલો',
    useMyLocation: 'મારું વર્તમાન સ્થાન વાપરો',
    locating: 'સ્થાન શોધાઈ રહ્યું છે…',
    riskLabel: 'જોખમ',
    dataUpdated: 'ડેટા અપડેટ',
    suggestionsTitle: 'સૂચવેલા પ્રશ્નો',
    composerPlaceholder: 'કટોકટીનો પ્રશ્ન પૂછો, અથવા બોલવા માટે માઇક દબાવો…',
    send: 'મોકલો',
    listen: 'સાંભળો',
    reading: 'વાંચી રહ્યું છે…',
    stop: 'રોકો',
    voiceReady: 'માઇક્રોફોન દબાવીને બોલો',
    voiceRecording: 'સાંભળી રહ્યું છે… પૂર્ણ થાય ત્યારે રોકો દબાવો',
    voiceProcessing: 'ઓડિયો પ્રોસેસ થઈ રહ્યો છે…',
    voiceError: 'ઓડિયો સમજાયો નહીં. ફરી પ્રયાસ કરો અથવા લખો.',
    voiceUnsupported: 'આ બ્રાઉઝરમાં વોઇસ ઇનપુટ સપોર્ટેડ નથી. કૃપા કરીને લખો.',
    micDenied: 'માઇક્રોફોન પરવાનગી નકારાઈ. સેટિંગ્સમાં મંજૂરી આપો અથવા લખો.',
    transcriptReady: 'ટ્રાન્સક્રિપ્ટ તૈયાર — સમીક્ષા કરો, સંપાદિત કરો, પછી મોકલો.',
    editBeforeSend: 'મોકલતા પહેલા ટ્રાન્સક્રિપ્ટની સમીક્ષા કરો.',
    needRescue: 'સીધા બચાવની જરૂર? 112 પર કૉલ કરો',
    emergencyTitle: 'કટોકટી સહાય',
    emergencySub: 'જો તમે તાત્કાલિક જોખમમાં હોવ તો અત્યારે જ કૉલ કરો. આ સહાયક બચાવ ટીમ મોકલી શકતો નથી.',
    call112: '112 પર કૉલ કરો',
    findHospital: 'નજીકની હોસ્પિટલ શોધો',
    findShelter: 'નજીકનો આશ્રય શોધો',
    shareLocation: 'સ્થાન શેર કરો',
    copied: 'સ્થાન કૉપિ થયું',
    actions: [
      { label: 'મારું સ્થાનિક જોખમ તપાસો', sub: 'તમારા વિસ્તારનું લાઇવ જોખમ', query: 'Is my area safe right now?' },
      { label: 'મારે અત્યારે શું કરવું?', sub: 'તાત્કાલિક સુરક્ષા પગલાં', query: 'What should I do right now to stay safe?' },
      { label: 'નજીકની મદદ શોધો', sub: 'હોસ્પિટલો અને આશ્રયો', query: 'Find nearby hospitals and shelters.' },
      { label: 'આપત્તિની તૈયારી કરો', sub: '72 કલાકની તૈયારી', query: 'How should I prepare my family for a disaster?' },
      { label: 'કટોકટી નોંધાવો', sub: 'ઘટના અહેવાલ દાખલ કરો', query: '__action:report' },
      { label: 'કટોકટી સંપર્કો', sub: '112, 1078, 108…', query: 'Show me emergency contact numbers.' },
    ],
    suggestHigh: ['શું મારા વિસ્તારમાં અત્યારે પૂરનું જોખમ છે?', 'આજે રાત્રે શું તૈયાર રાખું?', 'નજીકના આશ્રયો શોધો.', 'નજીકની હોસ્પિટલ ક્યાં છે?'],
    suggestQuake: ['ભૂકંપ દરમિયાન શું કરવું?', 'ઘરને સુરક્ષિત કેવી રીતે બનાવું?', 'કટોકટી સંપર્કો બતાવો.'],
    suggestCalm: ['પૂરની તૈયારી કેવી રીતે કરવી?', 'કટોકટી કિટમાં શું રાખવું?', 'મારું સ્થાનિક જોખમ તપાસો.', 'કટોકટી સંપર્કો બતાવો.'],
    sectionTitles: {
      emergency: 'કટોકટી સહાય', answer: 'માર્ગદર્શન', situation: 'વર્તમાન સ્થિતિ',
      risk: 'જોખમ સ્તર', weather: 'હવામાન', aqi: 'હવાની ગુણવત્તા', quakes: 'ભૂકંપ',
      alerts: 'સત્તાવાર ચેતવણીઓ', help: 'નજીકની મદદ', contacts: 'કટોકટી સંપર્કો',
      district: 'જિલ્લા માહિતી', do: 'અત્યારે શું કરવું', intro: 'આ સહાયક શું કરી શકે',
      note: 'કૃપા કરીને નોંધ લો',
    },
    sourceKinds: { live: 'લાઇવ ડેટા', official: 'સત્તાવાર સ્રોત', model: 'મોડેલ અંદાજ', guidance: 'સામાન્ય માર્ગદર્શન' },
    toolWorking: 'સ્થાનિક પરિસ્થિતિ તપાસાઈ રહી છે…',
    toolDone: 'સ્થાનિક સુરક્ષા મૂલ્યાંકન પૂર્ણ',
    viewDetails: 'વિગતો જુઓ',
    hideDetails: 'વિગતો છુપાવો',
    demoNote: 'ડેમો ડેટા — લાઇવ ફીડ અનુપલબ્ધ',
    langFallbackNote: 'અંગ્રેજીમાં બતાવી રહ્યું છે — આ ભાષા હજુ સપોર્ટેડ નથી.',
  },
  as: {
    statusOnline: 'সুৰক্ষা ইণ্টেলিজেন্স অনলাইন',
    statusConnecting: 'সংযোগ কৰি আছে…',
    statusDegraded: 'সীমিত সেৱা — স্থানীয় ইঞ্জিন সক্ৰিয়',
    statusOffline: 'অফলাইন — সংযোগ পৰীক্ষা কৰক',
    introTitle: 'আপুনি নিৰাপদে থাকিবলৈ আমি কেনেকৈ সহায় কৰিব পাৰো?',
    introSub: 'দুৰ্যোগ সম্পৰ্কে সুধক, আপোনাৰ অঞ্চলৰ বিপদ পৰীক্ষা কৰক, ওচৰৰ সহায় বিচাৰক বা step-by-step সুৰক্ষা নিৰ্দেশনা লওক।',
    contextTitle: 'আপোনাৰ অঞ্চল',
    setLocationPrompt: 'স্থানীয় সুৰক্ষা নিৰ্দেশনাৰ বাবে আপোনাৰ স্থান নিৰ্ধাৰণ কৰক।',
    changeLocation: 'স্থান সলনি কৰক',
    useMyLocation: 'মোৰ বৰ্তমান স্থান ব্যৱহাৰ কৰক',
    locating: 'স্থান বিচাৰি আছে…',
    riskLabel: 'বিপদ',
    dataUpdated: 'তথ্য আপডেট',
    suggestionsTitle: 'পৰামৰ্শিত প্ৰশ্ন',
    composerPlaceholder: 'জৰুৰী প্ৰশ্ন সুধক, বা ক’বলৈ মাইক টিপক…',
    send: 'পঠাওক',
    listen: 'শুনক',
    reading: 'পঢ়ি আছে…',
    stop: 'ৰখাওক',
    voiceReady: 'মাইক্ৰ’ফোন টিপি কওক',
    voiceRecording: 'শুনি আছে… শেষ হ’লে ৰখাওক টিপক',
    voiceProcessing: 'অডিঅ’ প্ৰক্ৰিয়াকৰণ হৈ আছে…',
    voiceError: 'অডিঅ’ বুজা নগ’ল। পুনৰ চেষ্টা কৰক বা লিখক।',
    voiceUnsupported: 'এই ব্ৰাউজাৰত ভইচ ইনপুট সমৰ্থিত নহয়। অনুগ্ৰহ কৰি লিখক।',
    micDenied: 'মাইক্ৰ’ফোনৰ অনুমতি নাকচ হ’ল। ছেটিংছত অনুমতি দিয়ক বা লিখক।',
    transcriptReady: 'প্ৰতিলিপি সাজু — পৰ্যালোচনা কৰক, সম্পাদনা কৰক, তাৰ পিছত পঠাওক।',
    editBeforeSend: 'পঠোৱাৰ আগতে প্ৰতিলিপি পৰ্যালোচনা কৰক।',
    needRescue: 'প্ৰত্যক্ষ উদ্ধাৰ লাগে? 112 লৈ কল কৰক',
    emergencyTitle: 'জৰুৰী সহায়',
    emergencySub: 'যদি আপুনি তাৎক্ষণিক বিপদত আছে, এতিয়াই কল কৰক। এই সহায়কে উদ্ধাৰকাৰী দল পঠিয়াব নোৱাৰে।',
    call112: '112 লৈ কল কৰক',
    findHospital: 'ওচৰৰ চিকিৎসালয় বিচাৰক',
    findShelter: 'ওচৰৰ আশ্ৰয় বিচাৰক',
    shareLocation: 'স্থান ভাগ-বতৰা কৰক',
    copied: 'স্থান কপি হ’ল',
    actions: [
      { label: 'মোৰ স্থানীয় বিপদ পৰীক্ষা কৰক', sub: 'আপোনাৰ অঞ্চলৰ লাইভ বিপদ', query: 'Is my area safe right now?' },
      { label: 'মই এতিয়া কি কৰিব লাগে?', sub: 'তাৎক্ষণিক সুৰক্ষা পদক্ষেপ', query: 'What should I do right now to stay safe?' },
      { label: 'ওচৰৰ সহায় বিচাৰক', sub: 'চিকিৎসালয় আৰু আশ্ৰয়', query: 'Find nearby hospitals and shelters.' },
      { label: 'দুৰ্যোগৰ বাবে প্ৰস্তুত হওক', sub: '72 ঘণ্টাৰ প্ৰস্তুতি', query: 'How should I prepare my family for a disaster?' },
      { label: 'জৰুৰী অৱস্থা জনাওক', sub: 'ঘটনাৰ প্ৰতিবেদন দিয়ক', query: '__action:report' },
      { label: 'জৰুৰী যোগাযোগ', sub: '112, 1078, 108…', query: 'Show me emergency contact numbers.' },
    ],
    suggestHigh: ['মোৰ অঞ্চলত এতিয়া বানৰ বিপদ আছে নেকি?', 'আজি নিশা কি সাজু ৰাখিম?', 'ওচৰৰ আশ্ৰয় বিচাৰক।', 'ওচৰৰ চিকিৎসালয় ক’ত?'],
    suggestQuake: ['ভূমিকম্পৰ সময়ত কি কৰিব লাগে?', 'ঘৰ কেনেকৈ সুৰক্ষিত কৰিম?', 'জৰুৰী যোগাযোগ দেখুৱাওক।'],
    suggestCalm: ['বানৰ বাবে কেনেকৈ প্ৰস্তুত হ’ম?', 'জৰুৰী কিটত কি ৰাখিম?', 'মোৰ স্থানীয় বিপদ পৰীক্ষা কৰক।', 'জৰুৰী যোগাযোগ দেখুৱাওক।'],
    sectionTitles: {
      emergency: 'জৰুৰী সহায়', answer: 'নিৰ্দেশনা', situation: 'বৰ্তমান অৱস্থা',
      risk: 'বিপদৰ স্তৰ', weather: 'বতৰ', aqi: 'বায়ুৰ মান', quakes: 'ভূমিকম্প',
      alerts: 'চৰকাৰী সতৰ্কবাণী', help: 'ওচৰৰ সহায়', contacts: 'জৰুৰী যোগাযোগ',
      district: 'জিলাৰ তথ্য', do: 'এতিয়া কি কৰিব', intro: 'এই সহায়কে কি কৰিব পাৰে',
      note: 'অনুগ্ৰহ কৰি মন কৰক',
    },
    sourceKinds: { live: 'লাইভ তথ্য', official: 'চৰকাৰী উৎস', model: 'মডেল অনুমান', guidance: 'সাধাৰণ নিৰ্দেশনা' },
    toolWorking: 'স্থানীয় অৱস্থা পৰীক্ষা কৰি আছে…',
    toolDone: 'স্থানীয় সুৰক্ষা মূল্যায়ন সম্পূৰ্ণ',
    viewDetails: 'বিৱৰণ চাওক',
    hideDetails: 'বিৱৰণ লুকুৱাওক',
    demoNote: 'ডেমো তথ্য — লাইভ ফিড অনুপলব্ধ',
    langFallbackNote: 'ইংৰাজীত দেখুওৱা হৈছে — এই ভাষা এতিয়াও সমৰ্থিত নহয়।',
  },
};

export function getStrings(lang: string): Dict {
  return STRINGS[(lang as AssistantLang) in STRINGS ? (lang as AssistantLang) : 'en'];
}
