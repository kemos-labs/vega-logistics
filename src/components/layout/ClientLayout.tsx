'use client';

import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { AppProvider } from '@/lib/AppContext';
import { AppProvider50 } from '@/lib/AppContext50';

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [lang, setLang] = useState('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration guard: must re-render after mount
    setMounted(true);
    const savedLang = localStorage.getItem('language') || 'en';
    setLang(savedLang);
    i18n.changeLanguage(savedLang);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('language', lang);
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, mounted]);

  return (
    <I18nextProvider i18n={i18n}>
      <AppProvider>
        <AppProvider50>
          <div
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            suppressHydrationWarning
            style={{ direction: lang === 'ar' ? 'rtl' : 'ltr', visibility: mounted ? 'visible' : 'hidden' }}
          >
            {children}
          </div>
        </AppProvider50>
      </AppProvider>
    </I18nextProvider>
  );
}
