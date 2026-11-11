import type {Metadata, Viewport} from 'next';
import './globals.css';
import {Providers} from '@/components/Providers';
import {AppFrame} from '@/components/AppFrame';

export const metadata: Metadata = {
  title: '은빈이 식단',
  description: '유아 주간 식단 플래너',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({children}: LayoutProps<'/'>) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
