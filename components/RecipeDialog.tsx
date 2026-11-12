'use client';

import type {ReactNode} from 'react';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {VStack} from '@astryxdesign/core/VStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {List, ListItem} from '@astryxdesign/core/List';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {Divider} from '@astryxdesign/core/Divider';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Center} from '@astryxdesign/core/Center';
import {Icon} from '@astryxdesign/core/Icon';
import {ShoppingCartIcon, CheckCircleIcon} from '@heroicons/react/24/outline';
import {useRecipe} from '@/lib/recipe';
import {useIngredients} from '@/lib/ingredients';
import {ingredientStatus} from '@/lib/shopping';
import type {Meal} from '@/lib/sample-data';
import type {AiRecipe} from '@/lib/recipe-schema';

// 휴대폰·좁은 화면은 아래에서 올라오는 시트, 넓은 화면은 가운데 팝업
export const SHEET_QUERY = '(max-width: 640px), (pointer: coarse) and (hover: none)';

export type OpenMeal = {meal: Meal; when: string};

export function RecipeDialog({open, onClose}: {open: OpenMeal | null; onClose: () => void}) {
  const useSheet = useMediaQuery(SHEET_QUERY);
  const isOpen = open !== null;
  const onOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const title = open?.meal.menu ?? '레시피';
  const body = open ? <RecipeBody meal={open.meal} /> : null;

  if (useSheet) {
    return (
      <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange} label={`${title} 레시피`} height="tall">
        <VStack gap={4}>
          <VStack gap={0.5}>
            <Text type="supporting">{open?.when} 레시피</Text>
            <Heading level={2}>{title}</Heading>
          </VStack>
          {body}
        </VStack>
      </BottomSheet>
    );
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={520} maxHeight="85dvh">
      <DialogHeader title={title} subtitle={`${open?.when ?? ''} 레시피`} onOpenChange={onOpenChange} />
      {/* 팝업 높이(maxHeight)를 넘는 긴 레시피는 본문만 스크롤 (제목은 고정) */}
      <StackItem size="fill" isScrollable>
        <VStack padding={4}>{body}</VStack>
      </StackItem>
    </Dialog>
  );
}

function RecipeBody({meal}: {meal: Meal}) {
  const {recipe, isLoading, error, retry} = useRecipe(meal);

  if (recipe) return <RecipeContent recipe={recipe} />;

  if (error) {
    return (
      <VStack gap={3}>
        <Banner status="error" title="레시피를 가져오지 못했어요" description={error} />
        <Button label="다시 시도" onClick={retry} />
      </VStack>
    );
  }

  if (isLoading) {
    return (
      <Center>
        <VStack gap={2} hAlign="center" paddingBlock={8}>
          <Spinner size="xl" />
          <Text type="supporting" justify="center">
            AI가 레시피를 쓰고 있어요. 잠시만 기다려 주세요.
          </Text>
        </VStack>
      </Center>
    );
  }

  return null;
}

function Section({title, children}: {title: string; children: ReactNode}) {
  return (
    <VStack gap={2}>
      <Heading level={3}>{title}</Heading>
      {children}
    </VStack>
  );
}

/** 줄바꿈되는 목록 항목 (문자열 label은 한 줄로 잘리므로 Text로 감싼다) */
const wrap = (text: string) => <Text textWrap="pretty">{text}</Text>;

/** 재료 목록: 냉장고에 없는 재료는 장보기 표시 (냉장고 목록이 바뀌면 바로 다시 계산) */
function IngredientList({ingredients}: {ingredients: AiRecipe['ingredients']}) {
  const {fridge, pantry} = useIngredients();
  const rows = ingredients.map(item => ({
    ...item,
    status: ingredientStatus(item.name, fridge, pantry),
  }));
  const toBuy = rows.filter(row => row.status === 'buy');

  return (
    <VStack gap={2}>
      <Text type="supporting">
        {toBuy.length > 0
          ? `장보기 필요 ${toBuy.length}개: ${toBuy.map(row => row.name.replace(/\([^)]*\)/g, '').trim()).join(', ')}`
          : '냉장고 재료와 기본 재료로 만들 수 있어요.'}
      </Text>
      <List density="compact" hasDividers>
        {rows.map(row => (
          <ListItem
            key={row.name}
            startContent={
              row.status === 'buy' ? (
                <Icon icon={ShoppingCartIcon} color="warning" label="장보기 필요" />
              ) : row.status === 'fridge' ? (
                <Icon icon={CheckCircleIcon} color="success" label="냉장고에 있음" />
              ) : (
                <Icon icon={CheckCircleIcon} color="disabled" label="기본 재료" />
              )
            }
            label={wrap(row.name)}
            description={
              row.status === 'buy' ? (
                <Text type="supporting" weight="semibold">
                  장보기 필요
                </Text>
              ) : row.status === 'pantry' ? (
                <Text type="supporting">기본 재료</Text>
              ) : undefined
            }
            endContent={<Text type="supporting">{row.amount}</Text>}
          />
        ))}
      </List>
    </VStack>
  );
}

function RecipeContent({recipe}: {recipe: AiRecipe}) {
  return (
    <VStack gap={4}>
      <Text>{recipe.summary}</Text>

      <MetadataList>
        <MetadataListItem label="조리 시간">
          <Text hasTabularNumbers>약 {recipe.cookMinutes}분</Text>
        </MetadataListItem>
        <MetadataListItem label="분량">
          <Text>{recipe.servings}</Text>
        </MetadataListItem>
      </MetadataList>

      <Divider />
      <Section title="재료">
        <IngredientList ingredients={recipe.ingredients} />
      </Section>

      <Section title="만드는 법">
        <List listStyle="decimal" density="compact">
          {recipe.steps.map((step, i) => (
            <ListItem key={i} label={wrap(step)} />
          ))}
        </List>
      </Section>

      {recipe.childTips.length > 0 && (
        <Banner status="info" title="아이에게 줄 때" description={recipe.childTips.join(' ')} />
      )}

      {recipe.sides.length > 0 && (
        <Section title="곁들임">
          <List density="compact" hasDividers>
            {recipe.sides.map(side => (
              <ListItem
                key={side.name}
                label={<Text weight="semibold">{side.name}</Text>}
                description={wrap(side.howTo)}
              />
            ))}
          </List>
        </Section>
      )}

      <Text type="supporting">
        AI가 쓴 레시피예요. 알레르기 재료와 아이에게 맞는 크기·익힘 정도는 한 번 더 확인해 주세요.
      </Text>
    </VStack>
  );
}
