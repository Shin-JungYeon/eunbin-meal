'use client';

import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Icon} from '@astryxdesign/core/Icon';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {SunIcon, MoonIcon, SparklesIcon} from '@heroicons/react/24/outline';
import {mealPlanStore, useGenerateMealPlan} from '@/lib/meal-plan';
import {MEAL_SLOTS, SAMPLE_WEEK, type DayPlan, type Meal} from '@/lib/sample-data';
import {useTodayIso} from '@/lib/date';

const SLOT_ICON = {breakfast: SunIcon, dinner: MoonIcon} as const;
const DAY_COLUMN_WIDTH = 44;

function formatMonthDay(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}.${d}`;
}

function formatCreatedAt(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function WeeklyPlanPage() {
  const today = useTodayIso();
  const [plan] = mealPlanStore.useValue();
  const {generate, isGenerating, error} = useGenerateMealPlan();
  const week = plan?.days ?? SAMPLE_WEEK;
  const first = week[0];
  const last = week[week.length - 1];
  const [, firstMonth, firstDay] = first.date.split('-').map(Number);
  const [, lastMonth, lastDay] = last.date.split('-').map(Number);
  const range =
    firstMonth === lastMonth
      ? `${firstMonth}월 ${firstDay}일 – ${lastDay}일`
      : `${firstMonth}월 ${firstDay}일 – ${lastMonth}월 ${lastDay}일`;

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={2}>{range}</Heading>
        <Text type="supporting">7일 · 아침/저녁 14끼</Text>
      </VStack>

      {plan ? (
        <Banner
          status="success"
          title={`AI가 짠 식단 · ${formatCreatedAt(plan.createdAt)}`}
          description={plan.tip}
        />
      ) : (
        <Banner
          status="info"
          title="샘플 식단이에요"
          description="재료 관리에서 재료를 확인하고 AI로 이번 주 식단을 짜 보세요."
        />
      )}

      {plan && plan.warnings.length > 0 && (
        <Banner
          status="warning"
          title="못 먹는 재료가 들어간 것 같아요"
          description={`${plan.warnings.join(' / ')} — 해당 끼니는 확인 후 바꿔 주세요.`}
        />
      )}

      <VStack gap={2}>
        <Button
          label={plan ? 'AI로 다시 짜기' : 'AI로 이번 주 식단 짜기'}
          variant={plan ? 'secondary' : 'primary'}
          width="100%"
          icon={<Icon icon={SparklesIcon} />}
          onClick={() => void generate()}
          isLoading={isGenerating}
        />
        {isGenerating && (
          <Text type="supporting" justify="center">
            AI가 식단을 짜고 있어요. 30초~1분 정도 걸릴 수 있어요.
          </Text>
        )}
        {error && <Banner status="error" title="식단을 짜지 못했어요" description={error} />}
      </VStack>

      <VStack gap={2}>
        <WeekColumnHeader />
        {week.map(day => (
          <DayRow key={day.date} day={day} isToday={day.date === today} />
        ))}
      </VStack>
    </VStack>
  );
}

/** 그리드 열 제목: (요일) | 아침 | 저녁 */
function WeekColumnHeader() {
  return (
    <HStack gap={3} paddingInline={3} vAlign="center">
      <VStack width={DAY_COLUMN_WIDTH}>
        <Text type="label" color="secondary">
          요일
        </Text>
      </VStack>
      <StackItem size="fill">
        <Grid columns={2} gap={3}>
          {MEAL_SLOTS.map(slot => (
            <HStack key={slot.key} gap={1} vAlign="center">
              <Icon icon={SLOT_ICON[slot.key]} size="sm" color="secondary" />
              <Text type="label" color="secondary">
                {slot.label}
              </Text>
            </HStack>
          ))}
        </Grid>
      </StackItem>
    </HStack>
  );
}

function DayRow({day, isToday}: {day: DayPlan; isToday: boolean}) {
  return (
    <Card padding={3} variant={isToday ? 'yellow' : 'default'} aria-current={isToday ? 'date' : undefined}>
      <HStack gap={3}>
        <VStack width={DAY_COLUMN_WIDTH} gap={0.5} hAlign="start">
          <Text type="large" weight="bold">
            {day.weekday}
          </Text>
          <Text type="supporting" hasTabularNumbers>
            {formatMonthDay(day.date)}
          </Text>
          {isToday && (
            <Text type="supporting" weight="bold" color="primary">
              오늘
            </Text>
          )}
        </VStack>
        <StackItem size="fill">
          <Grid columns={2} gap={3}>
            {MEAL_SLOTS.map(slot => (
              <MealCell key={slot.key} meal={day[slot.key]} slotLabel={slot.label} />
            ))}
          </Grid>
        </StackItem>
      </HStack>
    </Card>
  );
}

function MealCell({meal, slotLabel}: {meal: Meal; slotLabel: string}) {
  return (
    <VStack gap={1} aria-label={`${slotLabel}: ${meal.menu}`}>
      <Text type="body" weight="semibold" textWrap="pretty">
        {meal.menu}
      </Text>
      <Text type="supporting" textWrap="pretty">
        {meal.sides.join(' · ')}
      </Text>
    </VStack>
  );
}
