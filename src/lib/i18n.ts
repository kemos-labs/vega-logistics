import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../public/locales/en/translation.json';
import arTranslation from '../../public/locales/ar/translation.json';

const resources = {
  en: { translation: enTranslation },
  ar: { translation: arTranslation },
};

// Hydration-safe: initial language is always 'en' on both server and first client render.
// Persisted language is applied after mount via ClientLayout/useEffect to avoid mismatch.
function getInitialLanguage(): string {
  return 'en';
}

const initialLng = getInitialLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLng,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Apply the initial language to <html> immediately on the client so RTL/LTR
// is correct even before the React tree mounts — but only after hydration gate.
// For now keep as en; ClientLayout will set correct dir after mount.
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLng;
  document.documentElement.dir = initialLng === 'ar' ? 'rtl' : 'ltr';
}

export default i18n;
