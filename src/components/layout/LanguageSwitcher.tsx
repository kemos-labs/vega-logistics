'use client';

import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const [language, setLanguage] = useState('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read the browser preference after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const savedLang = localStorage.getItem('language') || 'en';
    setLanguage(savedLang);
  }, []);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    
    // Update document attributes
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    // Reload to apply i18n changes
    window.location.reload();
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-1 bg-[#18181c] border border-[#2a2a33] rounded-lg p-1">
      <button
        onClick={() => handleLanguageChange('en')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
          language === 'en'
            ? 'bg-[#3b82f6] text-white'
            : 'text-[#71717a] hover:text-[#a1a1aa]'
        }`}
      >
        <Globe className="w-3 h-3" />
        EN
      </button>
      <button
        onClick={() => handleLanguageChange('ar')}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
          language === 'ar'
            ? 'bg-[#3b82f6] text-white'
            : 'text-[#71717a] hover:text-[#a1a1aa]'
        }`}
      >
        <Globe className="w-3 h-3" />
        العربية
      </button>
    </div>
  );
}
