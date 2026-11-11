'use client';

import type {ReactNode} from 'react';
import NextLink from 'next/link';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {InternationalizationProvider} from '@astryxdesign/core/i18n';
import koKR from '@astryxdesign/core/locales/ko-KR.generated.js';
import {themes, defaultThemeSlug} from '@/astryx-themes';

export function Providers({children}: {children: ReactNode}) {
  return (
    <InternationalizationProvider locale="ko-KR" messages={{'ko-KR': koKR}}>
      <Theme theme={themes[defaultThemeSlug]}>
        <LinkProvider component={NextLink}>{children}</LinkProvider>
      </Theme>
    </InternationalizationProvider>
  );
}
