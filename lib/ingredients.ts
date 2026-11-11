import {createLocalStore} from './local-store';
import {SAMPLE_AVOID, SAMPLE_FRIDGE} from './sample-data';

export type Ingredients = {fridge: string[]; avoid: string[]};

const DEFAULT_INGREDIENTS: Ingredients = {fridge: SAMPLE_FRIDGE, avoid: SAMPLE_AVOID};

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
    };
  },
);

export function useIngredients() {
  const [ingredients, set] = ingredientsStore.useValue();
  return {
    ...ingredients,
    setFridge: (fridge: string[]) => set({...ingredientsStore.read(), fridge}),
    setAvoid: (avoid: string[]) => set({...ingredientsStore.read(), avoid}),
  };
}
