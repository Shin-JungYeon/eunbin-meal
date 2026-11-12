'use client';

import {useState} from 'react';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {Token} from '@astryxdesign/core/Token';
import {Text} from '@astryxdesign/core/Text';
import {Icon} from '@astryxdesign/core/Icon';
import {PlusIcon} from '@heroicons/react/24/outline';
import {normalizeIngredientName} from '@/lib/shopping';

type TokenColor = 'green' | 'red' | 'gray';

type Props = {
  label: string;
  placeholder: string;
  emptyText: string;
  color: TokenColor;
  items: string[];
  onChange: (items: string[]) => void;
  /** 다른 목록(예: 냉장고 재료 ↔ 기본 재료)과 겹치는 이름은 막는다 */
  otherList?: {items: string[]; label: string};
};

/** 재료 이름을 입력해 칩(Token)으로 추가/삭제하는 필드 */
export function IngredientField({
  label,
  placeholder,
  emptyText,
  color,
  items,
  onChange,
  otherList,
}: Props) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (items.includes(name)) {
      setError(`'${name}'은(는) 이미 있어요`);
      return;
    }
    const inOtherList = otherList?.items.some(
      other => normalizeIngredientName(other) === normalizeIngredientName(name),
    );
    if (inOtherList) {
      setError(`'${name}'은(는) 이미 ${otherList?.label}에 있어요`);
      return;
    }
    onChange([...items, name]);
    setDraft('');
    setError(null);
  };

  return (
    <VStack gap={3}>
      <VStack gap={1}>
        <HStack gap={2} vAlign="center">
          <StackItem size="fill">
            <TextInput
              label={label}
              isLabelHidden
              value={draft}
              onChange={value => {
                setDraft(value);
                setError(null);
              }}
              onEnter={add}
              placeholder={placeholder}
              enterKeyHint="done"
              status={error ? {type: 'error'} : undefined}
              hasClear
              width="100%"
            />
          </StackItem>
          <StackItem>
            <Button
              label="추가"
              variant="primary"
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

      {items.length === 0 ? (
        <Text type="supporting">{emptyText}</Text>
      ) : (
        <HStack gap={2} wrap="wrap">
          {items.map(item => (
            <Token
              key={item}
              label={item}
              color={color}
              size="lg"
              onRemove={() => onChange(items.filter(i => i !== item))}
            />
          ))}
        </HStack>
      )}
    </VStack>
  );
}
