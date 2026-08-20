'use client';

import { Clock, Wifi, RefreshCw } from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

interface HeaderProps {
  lastUpdate: Date;
  moduleTitle: string;
}

export default memo(function Header({ lastUpdate, moduleTitle }: HeaderProps) {
  const { t } = useTranslation();
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Riyadh',
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const secondsAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

  return (
    <header className="h-12 bg-[#0c0c0f] border-b border-[#2a2a33] flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider">
          {moduleTitle}
        </span>
      </div>

      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5 text-[#22c55e]">
          <Wifi className="w-3 h-3" />
          <span className="text-[#52525b]">{t('status.mockData')}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[#52525b]">
          <RefreshCw className={`w-3 h-3 ${secondsAgo < 5 ? 'animate-spin text-[#3b82f6]' : ''}`} />
          <span>{t('status.updated')} {secondsAgo}s {t('status.secondsAgo')}</span>
        </div>

        <div className="flex items-center gap-1.5 text-[#a1a1aa] font-mono-data">
          <Clock className="w-3 h-3 text-[#52525b]" />
          <span>{time}</span>
        </div>

        <span className="text-[#3d3d4a]">UTC+3</span>

        <div className="border-l border-[#2a2a33] pl-4">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
});
