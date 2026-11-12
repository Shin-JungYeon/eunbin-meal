'use client';

import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {VStack} from '@astryxdesign/core/VStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {List, ListItem} from '@astryxdesign/core/List';
import {Icon} from '@astryxdesign/core/Icon';
import {ShoppingCartIcon} from '@heroicons/react/24/outline';
import {SHEET_QUERY} from '@/components/RecipeDialog';
import {useCachedRecipes} from '@/lib/recipe';
import {useIngredients} from '@/lib/ingredients';
import {ingredientStatus, normalizeIngredientName} from '@/lib/shopping';
import {MEAL_SLOTS, type DayPlan, type Meal} from '@/lib/sample-data';
import type {AiRecipe} from '@/lib/recipe-schema';

const TITLE = '이번 주 장보기 목록';

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
): ShoppingGroup[] {
  const groups = new Map<string, ShoppingGroup>();
  weekMeals.forEach(({when}, i) => {
    const recipe = recipes[i];
    if (!recipe) return;
    for (const item of recipe.ingredients) {
      if (ingredientStatus(item.name, fridge, pantry) !== 'buy') continue;
      const key = normalizeIngredientName(item.name);
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
  const {fridge, pantry} = useIngredients();
  const weekMeals = flattenWeek(days);
  const recipes = useCachedRecipes(weekMeals.map(w => w.meal));
  const openedCount = recipes.filter(Boolean).length;
  const groups = buildShoppingGroups(weekMeals, recipes, fridge, pantry);

  return (
    <VStack gap={3}>
      <Text type="supporting">
        {openedCount}/{weekMeals.length}끼 레시피 확인함
        {openedCount < weekMeals.length && ' — 메뉴를 눌러 레시피를 열면 여기에 더해져요.'}
      </Text>

      {groups.length > 0 ? (
        <List density="compact" hasDividers>
          {groups.map(group => (
            <ListItem
              key={group.key}
              startContent={<Icon icon={ShoppingCartIcon} color="warning" label="장보기 필요" />}
              label={<Text weight="semibold">{group.displayName}</Text>}
              description={
                <Text type="supporting" textWrap="pretty">
                  {group.items.map(item => `${item.when} ${item.amount}`).join(', ')}
                </Text>
              }
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
