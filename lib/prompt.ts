// 서버(API 라우트)와 브라우저 양쪽에서 쓰는 설정 타입과 프롬프트 조립 (React 의존 없음)
import {feedingStage, formatAge} from './age';

export type PromptCondition = {
  id: string;
  label: string;
  enabled: boolean;
  /** 사용자가 직접 추가한 조건이면 true (삭제 가능) */
  isCustom?: boolean;
};

export type Settings = {
  childName: string;
  /** YYYY-MM-DD */
  birthDate: string | null;
  conditions: PromptCondition[];
  extraNote: string;
};

export const DEFAULT_CONDITIONS: PromptCondition[] = [
  {id: 'low-salt', label: '간은 최대한 약하게 (소금·간장 최소)', enabled: true},
  {id: 'not-spicy', label: '맵거나 자극적인 양념 빼기', enabled: true},
  {id: 'choking', label: '질식 위험 재료는 잘게 썰기 (포도, 방울토마토 등)', enabled: true},
  {id: 'fridge-first', label: '냉장고 재료를 우선 활용하기', enabled: true},
  {id: 'no-repeat', label: '같은 메뉴는 주 2회 이하로', enabled: true},
  {id: 'quick', label: '조리 시간 30분 이내', enabled: false},
  {id: 'balanced', label: '끼니마다 단백질·채소·탄수화물 고르게', enabled: true},
];

// 샘플 기본값 (생년월일은 하드코딩된 예시)
export const DEFAULT_SETTINGS: Settings = {
  childName: '은빈',
  birthDate: '2025-03-15',
  conditions: DEFAULT_CONDITIONS,
  extraNote: '',
};

export function parseSettings(raw: unknown): Settings {
  const data = (raw ?? {}) as Partial<Settings>;
  return {
    childName: typeof data.childName === 'string' ? data.childName : DEFAULT_SETTINGS.childName,
    birthDate: typeof data.birthDate === 'string' ? data.birthDate : null,
    conditions: Array.isArray(data.conditions)
      ? data.conditions.filter(
          (c): c is PromptCondition =>
            !!c && typeof c.id === 'string' && typeof c.label === 'string',
        )
      : DEFAULT_CONDITIONS,
    extraNote: typeof data.extraNote === 'string' ? data.extraNote : '',
  };
}

// ── AI 프롬프트 조립 ─────────────────────────────────────────────────────────

export type PromptIngredients = {fridge: string[]; avoid: string[]};

/**
 * AI에게 보낼 요청 문장. ingredients를 넘기지 않으면 미리보기용 자리표시자를 쓴다.
 * 같은 함수가 설정 화면 미리보기와 실제 AI 호출(서버) 양쪽에서 쓰인다.
 */
export function buildMealPrompt(
  settings: Settings,
  months: number | null,
  ingredients?: PromptIngredients,
): string[] {
  const name = settings.childName.trim() || '아이';
  const lines: string[] = [];

  if (months === null) {
    lines.push(`${name}의 일주일(월~일) 아침·저녁 식단을 짜 주세요.`);
  } else {
    const stage = feedingStage(months);
    lines.push(
      `생후 ${months}개월(${formatAge(months)}) ${name}의 일주일(월~일) 아침·저녁 식단을 짜 주세요.`,
      `식단 단계: ${stage.label} — ${stage.detail}`,
    );
  }

  const list = (items: string[]) => (items.length > 0 ? items.join(', ') : '없음');
  lines.push(
    `냉장고 재료: ${ingredients ? list(ingredients.fridge) : '{재료 관리의 냉장고 재료}'}`,
  );
  lines.push(
    `절대 쓰면 안 되는 재료: ${ingredients ? list(ingredients.avoid) : '{재료 관리의 못 먹는 재료}'}`,
  );

  const enabled = settings.conditions.filter(c => c.enabled);
  if (enabled.length > 0) {
    lines.push('조건:');
    enabled.forEach(c => lines.push(`- ${c.label}`));
  }

  const note = settings.extraNote.trim();
  if (note) lines.push(`추가 요청: ${note}`);

  return lines;
}
