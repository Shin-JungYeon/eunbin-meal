'use client';

import {createContext, useContext, useState, type ReactNode} from 'react';
import NextLink from 'next/link';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {InternationalizationProvider} from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.generated.js';
import {themes, defaultThemeSlug} from '@/astryx-themes';

type ThemeModeContextValue = {
  mode: 'light' | 'dark';
  toggleMode: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) throw new Error('useThemeMode must be used within Providers');
  return context;
}

export function Providers({children}: {children: ReactNode}) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const toggleMode = () => setMode(m => (m === 'light' ? 'dark' : 'light'));

  return (
    <InternationalizationProvider locale="ko-KR" messages={{'ko-KR': koKR}}>
      <ThemeModeContext.Provider value={{mode, toggleMode}}>
        <Theme theme={themes[defaultThemeSlug]} mode={mode}>
          <LinkProvider component={NextLink}>{children}</LinkProvider>
        </Theme>
      </ThemeModeContext.Provider>
    </InternationalizationProvider>
  );
}
