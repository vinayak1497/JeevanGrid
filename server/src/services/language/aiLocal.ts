/**
 * Localized chrome for the orchestrated local safety engine (spec §12, §17).
 *
 * The local engine fires when Nugen/DeepSeek are unreachable, so its fixed
 * strings must be available WITHOUT any provider call — static maps only.
 * Dynamic values (risk scores, places, numbers, warning text) pass through
 * untouched; only surrounding labels/titles are localized (spec §7).
 */
import type { SupportedLanguage } from '../aiOrchestrator';

type Strings = Record<string, string>;

const en: Strings = {
  emergencyTitle: 'Get to safety and call 112 now.',
  emergencyBody:
    'If you are in immediate danger, call 112 now. JeevanGrid AI cannot dispatch rescue teams — only a phone call to emergency services can.',
  call112: 'Call 112 now',
  openRiskMap: 'Open risk map & shelters',
  reportEmergency: 'Report this emergency',
  checkRisk: 'Check my local risk',
  emergencyContacts: 'Emergency contacts',
  nearbyHelpLive: 'Nearby medical help (live map data)',
  nearbyHelp: 'Nearby help (live map data)',
  whatToDo: 'What to do now',
  guidance: 'Guidance',
  currentSituation: 'Current situation',
  weather: 'Weather',
  airQuality: 'Air quality',
  quakesObserved: 'Recent earthquakes (observed)',
  quakeOutlook: 'Earthquake outlook',
  officialWarnings: 'Official warnings',
  districtInfo: 'District information',
  kit72: '72-hour emergency kit',
  generalReadiness: 'General emergency readiness',
  introTitle: 'What this assistant can do',
  greeting: 'Namaste. How can we help you stay safe?',
  noteTitle: 'A note on instructions',
};

const hi: Strings = {
  emergencyTitle: 'सुरक्षित स्थान पर जाएं और अभी 112 पर कॉल करें।',
  emergencyBody:
    'यदि आप तत्काल खतरे में हैं, तो अभी 112 पर कॉल करें। JeevanGrid AI बचाव दल नहीं भेज सकता — केवल आपातकालीन सेवाओं को फोन कॉल ही मदद पहुंचा सकता है।',
  call112: 'अभी 112 पर कॉल करें',
  openRiskMap: 'जोखिम मानचित्र व आश्रय खोलें',
  reportEmergency: 'इस आपातकाल की रिपोर्ट करें',
  checkRisk: 'मेरा स्थानीय जोखिम जांचें',
  emergencyContacts: 'आपातकालीन संपर्क',
  nearbyHelpLive: 'नज़दीकी चिकित्सा सहायता (लाइव मानचित्र डेटा)',
  nearbyHelp: 'नज़दीकी सहायता (लाइव मानचित्र डेटा)',
  whatToDo: 'अभी क्या करें',
  guidance: 'मार्गदर्शन',
  currentSituation: 'वर्तमान स्थिति',
  weather: 'मौसम',
  airQuality: 'वायु गुणवत्ता',
  quakesObserved: 'हाल के भूकंप (अवलोकित)',
  quakeOutlook: 'भूकंप परिदृश्य',
  officialWarnings: 'आधिकारिक चेतावनियां',
  districtInfo: 'ज़िले की जानकारी',
  kit72: '72 घंटे की आपातकालीन किट',
  generalReadiness: 'सामान्य आपातकालीन तैयारी',
  introTitle: 'यह सहायक क्या कर सकता है',
  greeting: 'नमस्ते। आपकी सुरक्षा में हम कैसे मदद करें?',
  noteTitle: 'निर्देशों पर एक टिप्पणी',
};

const mr: Strings = {
  emergencyTitle: 'सुरक्षित ठिकाणी जा आणि आत्ताच 112 वर कॉल करा.',
  emergencyBody:
    'तुम्ही तात्काळ धोक्यात असाल तर आत्ताच 112 वर कॉल करा. JeevanGrid AI बचाव पथक पाठवू शकत नाही — फक्त आपत्कालीन सेवांना फोन कॉलच मदत मिळवून देऊ शकतो.',
  call112: 'आत्ताच 112 वर कॉल करा',
  openRiskMap: 'धोका नकाशा व निवारे उघडा',
  reportEmergency: 'ही आणीबाणी नोंदवा',
  checkRisk: 'माझा स्थानिक धोका तपासा',
  emergencyContacts: 'आणीबाणी संपर्क',
  nearbyHelpLive: 'जवळची वैद्यकीय मदत (लाइव्ह नकाशा डेटा)',
  nearbyHelp: 'जवळची मदत (लाइव्ह नकाशा डेटा)',
  whatToDo: 'आत्ता काय करावे',
  guidance: 'मार्गदर्शन',
  currentSituation: 'सध्याची स्थिती',
  weather: 'हवामान',
  airQuality: 'हवेची गुणवत्ता',
  quakesObserved: 'अलीकडील भूकंप (निरीक्षण केलेले)',
  quakeOutlook: 'भूकंप अंदाज',
  officialWarnings: 'अधिकृत इशारे',
  districtInfo: 'जिल्हा माहिती',
  kit72: '72 तासांची आणीबाणी किट',
  generalReadiness: 'सामान्य आणीबाणी सज्जता',
  introTitle: 'हा सहाय्यक काय करू शकतो',
  greeting: 'नमस्ते. तुम्ही सुरक्षित राहण्यासाठी आम्ही कशी मदत करू?',
  noteTitle: 'सूचनांबद्दल एक टीप',
};

const gu: Strings = {
  emergencyTitle: 'સુરક્ષિત સ્થળે જાઓ અને અત્યારે 112 પર કૉલ કરો.',
  emergencyBody:
    'જો તમે તાત્કાલિક જોખમમાં હોવ તો અત્યારે 112 પર કૉલ કરો. JeevanGrid AI બચાવ ટીમ મોકલી શકતું નથી — ફક્ત કટોકટી સેવાઓને ફોન કૉલ જ મદદ અપાવી શકે.',
  call112: 'અત્યારે 112 પર કૉલ કરો',
  openRiskMap: 'જોખમ નકશો અને આશ્રયો ખોલો',
  reportEmergency: 'આ કટોકટીની જાણ કરો',
  checkRisk: 'મારું સ્થાનિક જોખમ તપાસો',
  emergencyContacts: 'કટોકટી સંપર્કો',
  nearbyHelpLive: 'નજીકની તબીબી મદદ (લાઇવ નકશો ડેટા)',
  nearbyHelp: 'નજીકની મદદ (લાઇવ નકશો ડેટા)',
  whatToDo: 'અત્યારે શું કરવું',
  guidance: 'માર્ગદર્શન',
  currentSituation: 'વર્તમાન સ્થિતિ',
  weather: 'હવામાન',
  airQuality: 'હવાની ગુણવત્તા',
  quakesObserved: 'તાજેતરના ભૂકંપ (અવલોકિત)',
  quakeOutlook: 'ભૂકંપ અંદાજ',
  officialWarnings: 'સત્તાવાર ચેતવણીઓ',
  districtInfo: 'જિલ્લા માહિતી',
  kit72: '72 કલાકની કટોકટી કિટ',
  generalReadiness: 'સામાન્ય કટોકટી તૈયારી',
  introTitle: 'આ સહાયક શું કરી શકે',
  greeting: 'નમસ્તે. તમે સુરક્ષિત રહો તેમાં અમે કેવી રીતે મદદ કરીએ?',
  noteTitle: 'સૂચનાઓ વિશે નોંધ',
};

const as: Strings = {
  emergencyTitle: 'নিৰাপদ ঠাইলৈ যাওক আৰু এতিয়াই 112 লৈ কল কৰক।',
  emergencyBody:
    'যদি আপুনি তাৎক্ষণিক বিপদত আছে, এতিয়াই 112 লৈ কল কৰক। JeevanGrid AI য়ে উদ্ধাৰকাৰী দল পঠিয়াব নোৱাৰে — কেৱল জৰুৰী সেৱালৈ ফোন কলেহে সহায় পাব।',
  call112: 'এতিয়াই 112 লৈ কল কৰক',
  openRiskMap: 'বিপদ মানচিত্ৰ আৰু আশ্ৰয় খোলক',
  reportEmergency: 'এই জৰুৰী অৱস্থা জনাওক',
  checkRisk: 'মোৰ স্থানীয় বিপদ পৰীক্ষা কৰক',
  emergencyContacts: 'জৰুৰী যোগাযোগ',
  nearbyHelpLive: 'ওচৰৰ চিকিৎসা সহায় (লাইভ মানচিত্ৰ তথ্য)',
  nearbyHelp: 'ওচৰৰ সহায় (লাইভ মানচিত্ৰ তথ্য)',
  whatToDo: 'এতিয়া কি কৰিব',
  guidance: 'নিৰ্দেশনা',
  currentSituation: 'বৰ্তমান অৱস্থা',
  weather: 'বতৰ',
  airQuality: 'বায়ুৰ মান',
  quakesObserved: 'শেহতীয়া ভূমিকম্প (পৰ্যবেক্ষিত)',
  quakeOutlook: 'ভূমিকম্পৰ সম্ভাৱনা',
  officialWarnings: 'চৰকাৰী সতৰ্কবাণী',
  districtInfo: 'জিলাৰ তথ্য',
  kit72: '72 ঘণ্টীয়া জৰুৰী কিট',
  generalReadiness: 'সাধাৰণ জৰুৰী প্ৰস্তুতি',
  introTitle: 'এই সহায়কে কি কৰিব পাৰে',
  greeting: 'নমস্কাৰ। আপুনি নিৰাপদে থাকিবলৈ আমি কেনেকৈ সহায় কৰিব পাৰো?',
  noteTitle: 'নিৰ্দেশনা সম্পৰ্কে টোকা',
};

const MAPS: Record<SupportedLanguage, Strings> = { en, hi, mr, gu, as };

/** Fixed-string lookup with English fallback — never throws. */
export function aiT(lang: SupportedLanguage, key: string): string {
  return MAPS[lang]?.[key] || MAPS.en[key] || key;
}
