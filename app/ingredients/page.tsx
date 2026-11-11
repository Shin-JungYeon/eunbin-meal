'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Token} from '@astryxdesign/core/Token';
import {Button} from '@astryxdesign/core/Button';
import {Icon} from '@astryxdesign/core/Icon';
import {Divider} from '@astryxdesign/core/Divider';
import {Banner} from '@astryxdesign/core/Banner';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {StackItem} from '@astryxdesign/core/Stack';
import {SparklesIcon, PlusIcon, TrashIcon} from '@heroicons/react/24/outline';
import {IngredientField} from '@/components/IngredientField';
import {NoIngredientsDialog} from '@/components/NoIngredientsDialog';
import {COMMON_AVOID} from '@/lib/sample-data';
import {useIngredients} from '@/lib/ingredients';
import {useGenerateMealPlan} from '@/lib/meal-plan';

export default function IngredientsPage() {
  // 재료는 이 기기에 저장되고, AI 식단 짜기에 그대로 쓰인다.
  const {fridge, avoid, setFridge, setAvoid} = useIngredients();
  const {generate, isGenerating, error} = useGenerateMealPlan();
  const router = useRouter();
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isNoIngredientsOpen, setIsNoIngredientsOpen] = useState(false);

  const handleGenerate = async () => {
    if (fridge.length === 0) {
      setIsNoIngredientsOpen(true);
      return;
    }
    if (await generate()) router.push('/');
  };

  const suggestions = COMMON_AVOID.filter(name => !avoid.includes(name));

  return (
    <VStack gap={4}>
      <Card>
        <VStack gap={4}>
          <SectionTitle
            title="냉장고 재료"
            count={fridge.length}
            description="지금 집에 있는 재료를 넣어주세요. 식단을 짤 때 먼저 활용해요."
            action={
              fridge.length > 0 && (
                <Button
                  label="전체 삭제"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={TrashIcon} />}
                  onClick={() => setIsClearOpen(true)}
                />
              )
            }
          />
          <AlertDialog
            isOpen={isClearOpen}
            onOpenChange={setIsClearOpen}
            title="냉장고 재료를 모두 삭제할까요?"
            description={`등록된 재료 ${fridge.length}개가 모두 지워져요. 되돌릴 수 없어요.`}
            actionLabel="전체 삭제"
            cancelLabel="취소"
            onAction={() => {
              setFridge([]);
              setIsClearOpen(false);
            }}
          />
          <IngredientField
            label="냉장고 재료 추가"
            placeholder="예: 애호박, 닭가슴살"
            emptyText="아직 등록한 재료가 없어요."
            color="green"
            items={fridge}
            onChange={setFridge}
          />
        </VStack>
      </Card>

      <Card>
        <VStack gap={4}>
          <SectionTitle
            title="못 먹는 재료"
            count={avoid.length}
            description="알레르기가 있거나 아직 먹이지 않는 재료예요. 식단에서 빼고 짜요."
          />
          <IngredientField
            label="못 먹는 재료 추가"
            placeholder="예: 땅콩, 새우"
            emptyText="제외할 재료가 없어요."
            color="red"
            items={avoid}
            onChange={setAvoid}
          />

          {suggestions.length > 0 && (
            <>
              <Divider />
              <VStack gap={2}>
                <Text type="label" color="secondary">
                  자주 제외하는 재료
                </Text>
                <HStack gap={2} wrap="wrap">
                  {suggestions.map(name => (
                    <Token
                      key={name}
                      label={name}
                      size="lg"
                      icon={<Icon icon={PlusIcon} size="sm" />}
                      description={`못 먹는 재료에 ${name} 추가`}
                      onClick={() => setAvoid([...avoid, name])}
                    />
                  ))}
                </HStack>
              </VStack>
            </>
          )}
        </VStack>
      </Card>

      <VStack gap={2}>
        <Button
          label="이 재료로 식단 짜기"
          variant="primary"
          size="lg"
          width="100%"
          icon={<Icon icon={SparklesIcon} />}
          onClick={handleGenerate}
          isLoading={isGenerating}
        />
        {error && <Banner status="error" title="식단을 짜지 못했어요" description={error} />}
        <NoIngredientsDialog
          isOpen={isNoIngredientsOpen}
          onOpenChange={setIsNoIngredientsOpen}
          actionLabel="재료 추가하기"
          onAction={() =>
            // 대화상자는 닫힐 때 여는 버튼으로 포커스를 돌려놓으므로, 닫힌 뒤에 입력칸으로 옮긴다.
            setTimeout(() => {
              const input = document.querySelector<HTMLInputElement>(
                'input[placeholder^="예: 애호박"]',
              );
              input?.scrollIntoView({block: 'center', behavior: 'smooth'});
              input?.focus({preventScroll: true});
            }, 400)
          }
        />
        <Text type="supporting" justify="center">
          {isGenerating
            ? 'AI가 식단을 짜고 있어요. 30초~1분 정도 걸릴 수 있어요.'
            : '설정의 아이 정보와 식단 조건도 함께 반영돼요.'}
        </Text>
      </VStack>
    </VStack>
  );
}

function SectionTitle({
  title,
  count,
  description,
  action,
}: {
  title: string;
  count: number;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <VStack gap={1}>
      <HStack gap={2} vAlign="center">
        <Heading level={2}>{title}</Heading>
        <StackItem size="fill">
          <Text type="supporting" hasTabularNumbers>
            {count}개
          </Text>
        </StackItem>
        {action}
      </HStack>
      <Text type="supporting">{description}</Text>
    </VStack>
  );
}
