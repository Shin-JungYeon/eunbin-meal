'use client';

import {useRef} from 'react';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {VStack} from '@astryxdesign/core/VStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {List, ListItem} from '@astryxdesign/core/List';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {SHEET_QUERY} from '@/components/RecipeDialog';
import {createLocalStore} from '@/lib/local-store';
import {useCachedRecipes} from '@/lib/recipe';
import {useIngredients} from '@/lib/ingredients';
import {ingredientStatus, normalizeIngredientName} from '@/lib/shopping';
import {MEAL_SLOTS, type DayPlan, type Meal} from '@/lib/sample-data';
import type {AiRecipe} from '@/lib/recipe-schema';

const TITLE = '이번 주 장보기 목록';

// 샀다고 체크한 재료 이름(정규화 키). 재료 이름 기준이라 팝업을 닫았다 열어도 유지된다.
const checkedStore = createLocalStore<string[]>('eunbin-meal:shopping-checked:v1', [], raw =>
  Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [],
);

type WeekMeal = {meal: Meal; when: string};

function flattenWeek(days: DayPlan[]): WeekMeal[] {
  return days.flatMap(day =>
    MEAL_SLOTS.map(slot => ({meal: day[slot.key], when: `${day.weekday}요일 ${slot.label}`})),
  );
}

type ShoppingGroup = {key: string; displayName: string; items: {when: string; amount: string}[]};

function buildShoppingGroups(
  weekMeals: WeekMeal[],
  recipes: (AiRecipe | null)[],
  fridge: string[],
  pantry: string[],
  checked: Set<string>,
): ShoppingGroup[] {
  const groups = new Map<string, ShoppingGroup>();
  weekMeals.forEach(({when}, i) => {
    const recipe = recipes[i];
    if (!recipe) return;
    for (const item of recipe.ingredients) {
      const key = normalizeIngredientName(item.name);
      // 체크해서 냉장고로 넘어간 재료는 상태가 바뀌어도 (샀다는 표시로) 계속 보여 준다.
      if (ingredientStatus(item.name, fridge, pantry) !== 'buy' && !checked.has(key)) continue;
      const displayName = item.name.replace(/\([^)]*\)/g, '').trim() || item.name;
      const group = groups.get(key) ?? {key, displayName, items: []};
      group.items.push({when, amount: item.amount});
      groups.set(key, group);
    }
  });
  return [...groups.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
}

export function ShoppingListDialog({
  isOpen,
  onOpenChange,
  days,
}: {
  isOpen: boolean;
  onOpenChange: (next: boolean) => void;
  days: DayPlan[];
}) {
  const useSheet = useMediaQuery(SHEET_QUERY);
  // 닫혀 있을 때는 계산하지 않는다 (레시피 캐시 키 계산에 현재 시각이 들어가 prerender와 안 맞음)
  const body = isOpen ? <ShoppingListBody days={days} /> : null;

  if (useSheet) {
    return (
      <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange} label={TITLE} height="tall">
        <VStack gap={4}>
          <Heading level={2}>{TITLE}</Heading>
          {body}
        </VStack>
      </BottomSheet>
    );
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={480} maxHeight="85dvh">
      <DialogHeader title={TITLE} onOpenChange={onOpenChange} />
      <StackItem size="fill" isScrollable>
        <VStack padding={4}>{body}</VStack>
      </StackItem>
    </Dialog>
  );
}

function ShoppingListBody({days}: {days: DayPlan[]}) {
  const {fridge, pantry, setFridge} = useIngredients();
  const [checkedKeys, setCheckedKeys] = checkedStore.useValue();
  const checked = new Set(checkedKeys);

  const weekMeals = flattenWeek(days);
  const recipes = useCachedRecipes(weekMeals.map(w => w.meal));
  const openedCount = recipes.filter(Boolean).length;
  const groups = buildShoppingGroups(weekMeals, recipes, fridge, pantry, checked);

  // 체크하면 냉장고 재료에 더하고, 체크 해제하면 방금 더했던 그 이름을 다시 뺀다.
  // 이미 기본 재료 등으로 커버되는 재료(장보기 필요가 아님)는 냉장고에 중복으로 넣지 않는다.
  const toggle = (group: ShoppingGroup, isChecked: boolean) => {
    setCheckedKeys(
      isChecked
        ? [...new Set([...checkedKeys, group.key])]
        : checkedKeys.filter(k => k !== group.key),
    );
    if (isChecked) {
      const alreadyCovered = ingredientStatus(group.displayName, fridge, pantry) !== 'buy';
      if (!alreadyCovered) setFridge([...fridge, group.displayName]);
    } else {
      setFridge(fridge.filter(name => name !== group.displayName));
    }
  };

  return (
    <VStack gap={3}>
      <Text type="supporting">
        {openedCount}/{weekMeals.length}끼 레시피 확인함
        {openedCount < weekMeals.length && ' — 메뉴를 눌러 레시피를 열면 여기에 더해져요.'}
      </Text>

      {groups.length > 0 ? (
        <List density="compact" hasDividers>
          {groups.map(group => (
            <ShoppingListRow
              key={group.key}
              group={group}
              // 재료 관리에서 이 재료를 지워 더 이상 냉장고·기본 재료로 안 잡히면 체크도 자동으로 풀린다.
              isChecked={
                checked.has(group.key) &&
                ingredientStatus(group.displayName, fridge, pantry) !== 'buy'
              }
              onToggle={isChecked => toggle(group, isChecked)}
            />
          ))}
        </List>
      ) : (
        <Text type="supporting">
          {openedCount === 0
            ? '아직 연 레시피가 없어요. 메뉴를 눌러 레시피를 열어 보세요.'
            : '장볼 재료가 없어요. 냉장고 재료와 기본 재료로 충분해요.'}
        </Text>
      )}
    </VStack>
  );
}

function ShoppingListRow({
  group,
  isChecked,
  onToggle,
}: {
  group: ShoppingGroup;
  isChecked: boolean;
  onToggle: (isChecked: boolean) => void;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  return (
    <ListItem
      interactiveRef={checkboxRef}
      startContent={
        <CheckboxInput
          ref={checkboxRef}
          label={`${group.displayName} 샀음`}
          isLabelHidden
          value={isChecked}
          onChange={onToggle}
        />
      }
      label={
        <Text weight="semibold" hasStrikethrough={isChecked} color={isChecked ? 'disabled' : undefined}>
          {group.displayName}
        </Text>
      }
      description={
        <Text type="supporting" textWrap="pretty" hasStrikethrough={isChecked}>
          {group.items.map(item => `${item.when} ${item.amount}`).join(', ')}
        </Text>
      }
    />
  );
}
