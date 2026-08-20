import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../public/locales/en/translation.json';
import arTranslation from '../../public/locales/ar/translation.json';

const resources = {
  en: { translation: enTranslation },
  ar: { translation: arTranslation },
};

// Read persisted language on the client. On the server, this is a no-op
// (no localStorage), so the initial server render stays as English.
function getInitialLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem('language');
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // localStorage can throw in private mode or sandboxed contexts
  }
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
// is correct even before the React tree mounts.
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLng;
  document.documentElement.dir = initialLng === 'ar' ? 'rtl' : 'ltr';
}

export default i18n;
