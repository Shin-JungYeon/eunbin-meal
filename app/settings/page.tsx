'use client';

import {useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import type {ISODateString} from '@astryxdesign/core/Calendar';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Button} from '@astryxdesign/core/Button';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Icon} from '@astryxdesign/core/Icon';
import {Divider} from '@astryxdesign/core/Divider';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {ageInMonths, feedingStage, formatAge, useTodayIso} from '@/lib/date';
import {buildMealPrompt, useSettings, type PromptCondition} from '@/lib/settings';
import {useIngredients} from '@/lib/ingredients';

export default function SettingsPage() {
  const {settings, update, reset: resetSettings} = useSettings();
  const today = useTodayIso();
  const {fridge, avoid} = useIngredients();
  const [resetCount, setResetCount] = useState(0);
  const reset = () => {
    resetSettings();
    setResetCount(n => n + 1);
  };

  const months =
    settings.birthDate && today ? ageInMonths(settings.birthDate, today) : null;
  const isFutureBirth = !!settings.birthDate && !!today && settings.birthDate > today;

  return (
    <VStack gap={4}>
      <Card>
        <VStack gap={4}>
          <SectionTitle
            title="아이 정보"
            description="생년월일로 월령을 계산해 식단 단계에 맞춰 짜요."
          />
          <TextInput
            label="아이 이름"
            value={settings.childName}
            onChange={childName => update({childName})}
            placeholder="예: 은빈"
            width="100%"
          />
          <DateInput
            // 저장된 값이 바깥에서 바뀔 때(첫 로드 후 저장값 반영, 기본값 복원) 달력이
            // 처음 열릴 달을 다시 잡도록 새로 마운트한다. 직접 입력 중에는 key가 그대로다.
            key={`${today ? 'client' : 'server'}-${resetCount}`}
            label="생년월일"
            value={(settings.birthDate ?? undefined) as ISODateString | undefined}
            onChange={birthDate => update({birthDate: birthDate ?? null})}
            max={(today ?? undefined) as ISODateString | undefined}
            weekStartsOn="mon"
            // 터치 기기에서는 OS 기본 날짜 선택기 대신 Astryx 하단 시트 달력을 쓴다.
            // (기본 선택기는 월요일 시작을 지원하지 않고, 일부 환경에서 열리지 않음)
            presentation="adaptive-bottom-sheet"
            hasClear
            width="100%"
            status={
              isFutureBirth ? {type: 'error', message: '오늘 이후 날짜는 입력할 수 없어요'} : undefined
            }
          />

          {months === null ? (
            <Text type="supporting">생년월일을 입력하면 월령을 자동으로 계산해요.</Text>
          ) : (
            <Card variant="yellow" padding={3}>
              <MetadataList>
                <MetadataListItem label="월령">
                  <Text weight="bold" hasTabularNumbers>
                    생후 {months}개월 ({formatAge(months)})
                  </Text>
                </MetadataListItem>
                <MetadataListItem label="식단 단계">
                  <VStack gap={0.5}>
                    <Text weight="bold">{feedingStage(months).label}</Text>
                    <Text type="supporting">{feedingStage(months).detail}</Text>
                  </VStack>
                </MetadataListItem>
              </MetadataList>
            </Card>
          )}
        </VStack>
      </Card>

      <Card>
        <VStack gap={4}>
          <SectionTitle
            title="AI 식단 조건"
            description="식단을 짤 때 AI에게 함께 전달할 조건이에요. 목록에 있는 조건이 모두 반영돼요. 고치거나 지울 수 있고, 직접 추가할 수도 있어요."
          />
          <ConditionList
            conditions={settings.conditions}
            onChange={conditions => update({conditions})}
          />
          <Divider />
          <TextArea
            label="추가 요청사항"
            description="조건 목록에 없는 내용을 자유롭게 적어주세요."
            value={settings.extraNote}
            onChange={extraNote => update({extraNote})}
            placeholder="예: 주말 저녁은 가족이 같이 먹을 수 있는 메뉴로"
            rows={3}
            maxLength={300}
            width="100%"
          />
        </VStack>
      </Card>

      <Card>
        <VStack gap={3}>
          <SectionTitle
            title="프롬프트 미리보기"
            description="AI 식단 짜기를 누르면 이 내용이 그대로 전달돼요. 재료는 재료 관리 화면의 목록이에요."
          />
          <VStack gap={1}>
            {buildMealPrompt(settings, months, {fridge, avoid}).map((line, i) => (
              <Text key={i} type="supporting" color="primary">
                {line}
              </Text>
            ))}
          </VStack>
        </VStack>
      </Card>

      <VStack gap={2} hAlign="center">
        <Button
          label="기본값으로 되돌리기"
          variant="ghost"
          icon={<Icon icon={ArrowPathIcon} />}
          onClick={reset}
        />
        <Text type="supporting" justify="center">
          변경 내용은 이 기기에 자동으로 저장돼요.
        </Text>
      </VStack>
    </VStack>
  );
}

function ConditionList({
  conditions,
  onChange,
}: {
  conditions: PromptCondition[];
  onChange: (next: PromptCondition[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    if (conditions.some(c => c.label === label)) {
      setError('이미 있는 조건이에요');
      return;
    }
    onChange([...conditions, {id: `custom-${Date.now()}`, label, enabled: true, isCustom: true}]);
    setDraft('');
    setError(null);
  };

  return (
    <VStack gap={3}>
      {conditions.length === 0 && (
        <Text type="supporting">조건이 없어요. 아래에서 추가하거나 기본값으로 되돌릴 수 있어요.</Text>
      )}
      {conditions.map(condition => (
        <ConditionRow
          key={condition.id}
          condition={condition}
          otherLabels={conditions.filter(c => c.id !== condition.id).map(c => c.label)}
          onChange={next => onChange(conditions.map(c => (c.id === condition.id ? next : c)))}
          onDelete={() => onChange(conditions.filter(c => c.id !== condition.id))}
        />
      ))}

      <VStack gap={1}>
        <HStack gap={2} vAlign="center">
          <StackItem size="fill">
            <TextInput
              label="조건 직접 추가"
              isLabelHidden
              value={draft}
              onChange={value => {
                setDraft(value);
                setError(null);
              }}
              onEnter={add}
              placeholder="예: 생선은 주 2회 이상"
              enterKeyHint="done"
              status={error ? {type: 'error'} : undefined}
              width="100%"
            />
          </StackItem>
          <StackItem>
            <Button
              label="추가"
              icon={<Icon icon={PlusIcon} />}
              onClick={add}
              isDisabled={!draft.trim()}
            />
          </StackItem>
        </HStack>
        {error && (
          <Text type="supporting" role="alert">
            {error}
          </Text>
        )}
      </VStack>
    </VStack>
  );
}

/** 조건 한 줄: 수정 · 삭제 */
function ConditionRow({
  condition,
  otherLabels,
  onChange,
  onDelete,
}: {
  condition: PromptCondition;
  otherLabels: string[];
  onChange: (next: PromptCondition) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(condition.label);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(condition.label);
    setError(null);
    setIsEditing(true);
  };

  const save = () => {
    const label = draft.trim();
    if (!label) {
      setError('조건 내용을 입력해 주세요');
      return;
    }
    if (otherLabels.includes(label)) {
      setError('이미 있는 조건이에요');
      return;
    }
    // 직접 고친 조건은 기본 문구 자동 변경 대상에서 빠지도록 isCustom으로 표시
    if (label !== condition.label) onChange({...condition, label, isCustom: true});
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <VStack gap={1}>
        <HStack gap={1} vAlign="center">
          <StackItem size="fill">
            <TextInput
              label={`'${condition.label}' 조건 수정`}
              isLabelHidden
              value={draft}
              onChange={value => {
                setDraft(value);
                setError(null);
              }}
              onEnter={save}
              onKeyDown={e => {
                if (e.key === 'Escape') setIsEditing(false);
              }}
              enterKeyHint="done"
              hasAutoFocus
              status={error ? {type: 'error'} : undefined}
              width="100%"
            />
          </StackItem>
          <IconButton
            label="수정 저장"
            icon={<Icon icon={CheckIcon} />}
            variant="primary"
            size="sm"
            onClick={save}
          />
          <IconButton
            label="수정 취소"
            icon={<Icon icon={XMarkIcon} />}
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(false)}
          />
        </HStack>
        {error && (
          <Text type="supporting" role="alert">
            {error}
          </Text>
        )}
      </VStack>
    );
  }

  return (
    <HStack gap={1} vAlign="center">
      <StackItem size="fill">
        <Text type="body">{condition.label}</Text>
      </StackItem>
      <IconButton
        label={`'${condition.label}' 조건 수정`}
        icon={<Icon icon={PencilSquareIcon} />}
        variant="ghost"
        size="sm"
        onClick={startEdit}
      />
      <IconButton
        label={`'${condition.label}' 조건 삭제`}
        icon={<Icon icon={TrashIcon} />}
        variant="ghost"
        size="sm"
        onClick={onDelete}
      />
    </HStack>
  );
}

function SectionTitle({title, description}: {title: string; description: string}) {
  return (
    <VStack gap={1}>
      <Heading level={2}>{title}</Heading>
      <Text type="supporting">{description}</Text>
    </VStack>
  );
}
