'use client';

import {AlertDialog} from '@astryxdesign/core/AlertDialog';

/** AI 식단 짜기 전에 냉장고 재료가 비어 있을 때 띄우는 안내 */
export function NoIngredientsDialog({
  isOpen,
  onOpenChange,
  actionLabel,
  onAction,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="냉장고 재료가 없어요"
      description="식단을 짜려면 냉장고 재료가 필요해요. 재료를 추가한 뒤 다시 시도해 주세요."
      actionLabel={actionLabel}
      actionVariant="primary"
      cancelLabel="닫기"
      onAction={() => {
        onOpenChange(false);
        onAction();
      }}
    />
  );
}
