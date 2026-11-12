// 레시피 재료가 냉장고에 있는지 판단 (화면에서 바로 계산, AI 호출 없음)

export type IngredientStatus = 'fridge' | 'pantry' | 'buy';

/** 기본 재료 기본값: 보통 집에 있는 재료·양념. 재료 관리에서 바꿀 수 있다 */
export const DEFAULT_PANTRY = [
  '물',
  '밥',
  '쌀',
  '소금',
  '간장',
  '국간장',
  '참기름',
  '들기름',
  '식용유',
  '올리브유',
  '설탕',
  '후추',
  '참깨',
  '깨',
  '다시마',
  '멸치육수',
  '육수',
  '채수',
];

/** 같은 재료의 다른 이름을 하나로 맞춘다 */
const SYNONYMS: Record<string, string> = {
  계란: '달걀',
  쇠고기: '소고기',
  우육: '소고기',
  돈육: '돼지고기',
  계육: '닭고기',
};

/**
 * 괄호 설명·공백을 지우고 동의어를 맞춘다. 예: '소고기 다짐육(우둔)' → '소고기다짐육'
 * 장보기 목록에서 같은 재료를 한데 묶을 때도 쓴다.
 */
export function normalizeIngredientName(name: string) {
  let text = name.replace(/\([^)]*\)/g, '').replace(/\s+/g, '');
  for (const [from, to] of Object.entries(SYNONYMS)) text = text.replaceAll(from, to);
  return text;
}

/** 괄호 설명만 뗀 화면 표시용 이름. 전부 괄호 안이라 빈 문자열이 되면 원래 이름을 쓴다. */
export function displayIngredientName(name: string) {
  return name.replace(/\([^)]*\)/g, '').trim() || name;
}

const OR = /또는|혹은|\/|,/;

/**
 * 여러 후보 중 하나라도 있으면 된다.
 * '물 또는 무염 채수', '닭 안심(또는 닭가슴살)'처럼 괄호 안의 대안도 후보로 본다.
 */
function alternatives(name: string) {
  // 괄호를 먼저 떼어야 한다: 구분자가 괄호 안에 있으면(예: '밥(진밥 또는 일반 밥)')
  // 괄호를 안 뗀 채로 나눌 때 조각마다 괄호가 반쪽만 남아 기본 이름과 안 맞게 된다.
  const base = name.replace(/\([^)]*\)/g, '');
  const inParens = [...name.matchAll(/\(([^)]*)\)/g)]
    .map(m => m[1])
    .filter(text => OR.test(text))
    .flatMap(text => text.split(OR));
  return [...base.split(OR), ...inParens].map(normalizeIngredientName).filter(Boolean);
}

export function ingredientStatus(
  name: string,
  fridge: string[],
  pantry: string[] = DEFAULT_PANTRY,
): IngredientStatus {
  const options = alternatives(name);

  // 한쪽이 다른 쪽을 포함하면 같은 재료로 본다 ('소고기 다짐육(우둔)' ↔ '소고기 다짐육', '육수' ↔ '멸치육수').
  // 단, 한 글자 이름은 똑같을 때만 ('배' ↔ '배추', '파' ↔ '양파', '나물' ↔ '물', '쌀국수' ↔ '쌀' 오인 방지)
  const sameIngredient = (a: string, b: string) => {
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.length >= 2 && long.includes(short);
  };

  const fridgeNames = fridge.map(normalizeIngredientName).filter(Boolean);
  const inFridge = options.some(option => fridgeNames.some(item => sameIngredient(option, item)));
  if (inFridge) return 'fridge';

  const pantryNames = pantry.map(normalizeIngredientName).filter(Boolean);
  const isPantry = options.some(option => pantryNames.some(base => sameIngredient(option, base)));
  return isPantry ? 'pantry' : 'buy';
}
