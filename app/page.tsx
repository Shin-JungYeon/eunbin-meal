'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {SelectableCard} from '@astryxdesign/core/SelectableCard';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {Icon} from '@astryxdesign/core/Icon';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {
  SunIcon,
  MoonIcon,
  SparklesIcon,
  ArrowPathIcon,
  CursorArrowRaysIcon,
} from '@heroicons/react/24/outline';
import {mealPlanStore, useGenerateMealPlan, type MealTarget} from '@/lib/meal-plan';
import {ingredientsStore} from '@/lib/ingredients';
import {NoIngredientsDialog} from '@/components/NoIngredientsDialog';
import {RecipeDialog, type OpenMeal} from '@/components/RecipeDialog';
import {MEAL_SLOTS, SAMPLE_WEEK, type DayPlan, type Meal} from '@/lib/sample-data';
import {SLOT_LABEL, type SlotKey, type Weekday} from '@/lib/meal-plan-schema';
import {useTodayIso} from '@/lib/date';

const SLOT_ICON = {breakfast: SunIcon, dinner: MoonIcon} as const;
const DAY_COLUMN_WIDTH = 44;

const targetKey = (weekday: string, slot: SlotKey) => `${weekday}|${slot}`;

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
  const {generate, regenerate, isGenerating, error} = useGenerateMealPlan();
  const router = useRouter();
  const [isNoIngredientsOpen, setIsNoIngredientsOpen] = useState(false);

  // 고른 끼니만 다시 짜기
  const [isSelecting, setIsSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastReplaced, setLastReplaced] = useState<string[]>([]);
  const [openMeal, setOpenMeal] = useState<OpenMeal | null>(null);

  const hasFridge = () => {
    if (ingredientsStore.read().fridge.length > 0) return true;
    setIsNoIngredientsOpen(true);
    return false;
  };

  const handleGenerate = async () => {
    if (!hasFridge()) return;
    setLastReplaced([]);
    await generate();
  };

  const toggle = (key: string, isOn: boolean) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (isOn) next.add(key);
      else next.delete(key);
      return next;
    });

  const exitSelecting = () => {
    setIsSelecting(false);
    setSelected(new Set());
  };

  const handleRegenerateSelected = async () => {
    if (selected.size === 0 || !hasFridge()) return;
    const targets: MealTarget[] = [...selected].map(key => {
      const [weekday, slot] = key.split('|');
      return {weekday: weekday as Weekday, slot: slot as SlotKey};
    });
    if (await regenerate(targets)) {
      setLastReplaced(targets.map(t => `${t.weekday} ${SLOT_LABEL[t.slot]}`));
      exitSelecting();
    }
  };

  const week = plan?.days ?? SAMPLE_WEEK;
  const first = week[0];
  const last = week[week.length - 1];
  const [, firstMonth, firstDay] = first.date.split('-').map(Number);
  const [, lastMonth, lastDay] = last.date.split('-').map(Number);
  const range =
    firstMonth === lastMonth
      ? `${firstMonth}월 ${firstDay}일 – ${lastDay}일`
      : `${firstMonth}월 ${firstDay}일 – ${lastMonth}월 ${lastDay}일`;

  const regenerateSelectedButton = (
    <Button
      label={selected.size > 0 ? `선택한 ${selected.size}끼 다시 짜기` : '다시 짤 끼니를 골라 주세요'}
      variant="primary"
      width="100%"
      icon={<Icon icon={SparklesIcon} />}
      onClick={handleRegenerateSelected}
      isDisabled={selected.size === 0}
      isLoading={isGenerating}
    />
  );

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
          description={`${plan.warnings.join(' / ')} — 해당 끼니를 골라 다시 짜 보세요.`}
        />
      )}

      <VStack gap={2}>
        {isSelecting ? (
          <>
            <Text type="supporting">
              바꾸고 싶은 끼니를 눌러 고르세요. 고른 끼니만 새 메뉴로 바뀌고 나머지는 그대로예요.
            </Text>
            <HStack gap={2}>
              <StackItem size="fill">{regenerateSelectedButton}</StackItem>
              <Button label="취소" variant="ghost" onClick={exitSelecting} isDisabled={isGenerating} />
            </HStack>
          </>
        ) : plan ? (
          <Grid columns={2} gap={2}>
            <Button
              label="골라서 다시 짜기"
              variant="primary"
              width="100%"
              icon={<Icon icon={CursorArrowRaysIcon} />}
              onClick={() => {
                setLastReplaced([]);
                setIsSelecting(true);
              }}
              isDisabled={isGenerating}
            />
            <Button
              label="전체 다시 짜기"
              variant="secondary"
              width="100%"
              icon={<Icon icon={ArrowPathIcon} />}
              onClick={handleGenerate}
              isLoading={isGenerating}
            />
          </Grid>
        ) : (
          <Button
            label="AI로 이번 주 식단 짜기"
            variant="primary"
            width="100%"
            icon={<Icon icon={SparklesIcon} />}
            onClick={handleGenerate}
            isLoading={isGenerating}
          />
        )}
        {isGenerating && (
          <Text type="supporting" justify="center">
            AI가 식단을 짜고 있어요. 30초~1분 정도 걸릴 수 있어요.
          </Text>
        )}
        {!isGenerating && lastReplaced.length > 0 && (
          <Text type="supporting" justify="center">
            {lastReplaced.join(', ')} 메뉴를 새로 짰어요.
          </Text>
        )}
        {error && <Banner status="error" title="식단을 짜지 못했어요" description={error} />}
        <NoIngredientsDialog
          isOpen={isNoIngredientsOpen}
          onOpenChange={setIsNoIngredientsOpen}
          actionLabel="재료 추가하러 가기"
          onAction={() => router.push('/ingredients')}
        />
      </VStack>

      <VStack gap={2}>
        <WeekColumnHeader />
        {week.map(day => (
          <DayRow
            key={day.date}
            day={day}
            isToday={day.date === today}
            onOpenMeal={(slot, slotLabel) =>
              setOpenMeal({meal: day[slot], when: `${day.weekday}요일 ${slotLabel}`})
            }
            selection={
              isSelecting
                ? {
                    isSelected: slot => selected.has(targetKey(day.weekday, slot)),
                    onToggle: (slot, isOn) => toggle(targetKey(day.weekday, slot), isOn),
                    isDisabled: isGenerating,
                  }
                : undefined
            }
          />
        ))}
      </VStack>

      {/* 아래까지 내려가며 고른 경우를 위해 맨 아래에도 같은 버튼 */}
      {isSelecting && regenerateSelectedButton}

      <RecipeDialog open={openMeal} onClose={() => setOpenMeal(null)} />
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

type Selection = {
  isSelected: (slot: SlotKey) => boolean;
  onToggle: (slot: SlotKey, isOn: boolean) => void;
  isDisabled: boolean;
};

function DayRow({
  day,
  isToday,
  selection,
  onOpenMeal,
}: {
  day: DayPlan;
  isToday: boolean;
  selection?: Selection;
  onOpenMeal: (slot: SlotKey, slotLabel: string) => void;
}) {
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
          <Grid columns={2} gap={2}>
            {MEAL_SLOTS.map(slot =>
              selection ? (
                <SelectableCard
                  key={slot.key}
                  label={`${day.weekday} ${slot.label}: ${day[slot.key].menu}`}
                  isSelected={selection.isSelected(slot.key)}
                  onChange={isOn => selection.onToggle(slot.key, isOn)}
                  isDisabled={selection.isDisabled}
                  variant="transparent"
                  padding={2}>
                  <MealCell meal={day[slot.key]} slotLabel={slot.label} />
                </SelectableCard>
              ) : (
                <ClickableCard
                  key={slot.key}
                  label={`${day.weekday} ${slot.label} ${day[slot.key].menu} 레시피 보기`}
                  onClick={() => onOpenMeal(slot.key, slot.label)}
                  variant="transparent"
                  padding={2}>
                  <MealCell meal={day[slot.key]} slotLabel={slot.label} />
                </ClickableCard>
              ),
            )}
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
