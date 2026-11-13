'use client';

import type {ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {Layout, LayoutHeader, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Icon} from '@astryxdesign/core/Icon';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {CalendarDaysIcon, ShoppingBagIcon, Cog6ToothIcon, SunIcon, MoonIcon} from '@heroicons/react/24/outline';
import {
  CalendarDaysIcon as CalendarDaysSolid,
  ShoppingBagIcon as ShoppingBagSolid,
  Cog6ToothIcon as Cog6ToothSolid,
} from '@heroicons/react/24/solid';
import {useThemeMode} from '@/components/Providers';

const TABS = [
  {
    href: '/',
    label: '주간 식단',
    subtitle: '이번 주 아침·저녁 메뉴',
    icon: CalendarDaysIcon,
    selectedIcon: CalendarDaysSolid,
  },
  {
    href: '/ingredients',
    label: '재료 관리',
    subtitle: '냉장고 재료와 못 먹는 재료',
    icon: ShoppingBagIcon,
    selectedIcon: ShoppingBagSolid,
  },
  {
    href: '/settings',
    label: '설정',
    subtitle: '아이 정보와 AI 식단 조건',
    icon: Cog6ToothIcon,
    selectedIcon: Cog6ToothSolid,
  },
] as const;

/**
 * 모바일 앱 프레임: 상단 제목 + 스크롤 콘텐츠 + 하단 탭바.
 * 넓은 화면에서는 콘텐츠 폭을 휴대폰 폭 정도로 제한한다.
 */
export function AppFrame({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const current = TABS.find(tab => tab.href === pathname) ?? TABS[0];
  const {mode, toggleMode} = useThemeMode();

  return (
    <VStack height="100dvh">
      <Layout
        height="fill"
        contentWidth={560}
        header={
          <LayoutHeader hasDivider>
            <HStack justify="between" align="center">
              <VStack gap={0.5}>
                <Text type="supporting">은빈이 식단</Text>
                <Heading level={1}>{current.label}</Heading>
              </VStack>
              <IconButton
                variant="ghost"
                label={mode === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}
                tooltip={mode === 'light' ? '다크 모드' : '라이트 모드'}
                icon={<Icon icon={mode === 'light' ? MoonIcon : SunIcon} />}
                onClick={toggleMode}
              />
            </HStack>
          </LayoutHeader>
        }
        content={<LayoutContent label={current.subtitle}>{children}</LayoutContent>}
        footer={
          <LayoutFooter hasDivider padding={1} label="하단 메뉴">
            <TabList value={current.href} onChange={() => {}} layout="fill" size="lg">
              {TABS.map(tab => (
                <Tab
                  key={tab.href}
                  value={tab.href}
                  href={tab.href}
                  label={tab.label}
                  icon={<Icon icon={tab.icon} />}
                  selectedIcon={<Icon icon={tab.selectedIcon} />}
                />
              ))}
            </TabList>
          </LayoutFooter>
        }
      />
    </VStack>
  );
}
