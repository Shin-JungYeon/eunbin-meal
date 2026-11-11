import {createLocalStore} from './local-store';
import {SAMPLE_AVOID, SAMPLE_FRIDGE} from './sample-data';
import {DEFAULT_PANTRY} from './shopping';

export type Ingredients = {
  fridge: string[];
  avoid: string[];
  /** 늘 집에 있는 기본 재료·양념 (장보기 표시에서 빠짐) */
  pantry: string[];
};

const DEFAULT_INGREDIENTS: Ingredients = {
  fridge: SAMPLE_FRIDGE,
  avoid: SAMPLE_AVOID,
  pantry: DEFAULT_PANTRY,
};

const stringList = (value: unknown, fallback: string[]) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : fallback;

// 재료도 설정처럼 이 기기에 저장해서 AI 식단 짜기에서 바로 쓴다.
export const ingredientsStore = createLocalStore<Ingredients>(
  'eunbin-meal:ingredients:v1',
  DEFAULT_INGREDIENTS,
  raw => {
    const data = (raw ?? {}) as Partial<Ingredients>;
    return {
      fridge: stringList(data.fridge, SAMPLE_FRIDGE),
      avoid: stringList(data.avoid, SAMPLE_AVOID),
      // 예전 저장 데이터에는 pantry가 없으므로 기본값으로 채운다
      pantry: stringList(data.pantry, DEFAULT_PANTRY),
    };
  },
);

export {DEFAULT_PANTRY};

export function useIngredients() {
  const [ingredients, set] = ingredientsStore.useValue();
  return {
    ...ingredients,
    setFridge: (fridge: string[]) => set({...ingredientsStore.read(), fridge}),
    setAvoid: (avoid: string[]) => set({...ingredientsStore.read(), avoid}),
    setPantry: (pantry: string[]) => set({...ingredientsStore.read(), pantry}),
  };
}
