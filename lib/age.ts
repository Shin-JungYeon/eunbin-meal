// 서버와 브라우저 양쪽에서 쓰는 순수 날짜/월령 계산 (React 의존 없음)

export function toLocalIso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 생년월일부터 기준일까지 만 개월 수. 생일이 기준일보다 뒤면 null. */
export function ageInMonths(birthIso: string, todayIso: string): number | null {
  const [by, bm, bd] = birthIso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  if (birthIso > todayIso) return null;
  const months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
  return Math.max(0, months);
}

export function formatAge(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${months}개월`;
  return rest === 0 ? `만 ${years}세` : `만 ${years}세 ${rest}개월`;
}

/** 월령별 일반적인 식단 단계 (참고용 구분) */
export function feedingStage(months: number) {
  if (months < 4) return {label: '수유기', detail: '이유식 시작 전이에요'};
  if (months < 7) return {label: '이유식 초기', detail: '묽은 미음, 한 가지 재료씩'};
  if (months < 9) return {label: '이유식 중기', detail: '죽 형태, 잘게 다진 재료'};
  if (months < 12) return {label: '이유식 후기', detail: '진밥, 무른 덩어리'};
  if (months < 18) return {label: '이유식 완료기', detail: '무른 밥과 반찬, 싱겁게'};
  if (months < 36) return {label: '유아식', detail: '어른 밥상과 비슷하되 간은 약하게'};
  return {label: '유아식 (3세 이상)', detail: '다양한 식감과 재료 시도'};
}
