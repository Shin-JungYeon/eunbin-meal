import {useCallback, useEffect, useState} from 'react';
import {createLocalStore} from './local-store';
import {settingsStore} from './settings';
import {ingredientsStore} from './ingredients';
import {ageInMonths, feedingStage, toLocalIso} from './age';
import type {Meal} from './sample-data';
import type {AiRecipe, RecipeRequest, RecipeResponse} from './recipe-schema';

type CachedRecipe = {recipe: AiRecipe; savedAt: string};

const MAX_CACHED = 60;

// 한 번 받은 레시피는 이 기기에 저장해서 다시 열 때 AI를 또 부르지 않는다.
const recipeStore = createLocalStore<Record<string, CachedRecipe>>(
  'eunbin-meal:recipes:v1',
  {},
  raw => (raw && typeof raw === 'object' ? (raw as Record<string, CachedRecipe>) : {}),
);

/** 메뉴·곁들임·식단 단계·못 먹는 재료가 같으면 같은 레시피를 쓴다 */
function cacheKey(meal: Meal) {
  const settings = settingsStore.read();
  const months = settings.birthDate
    ? ageInMonths(settings.birthDate, toLocalIso(new Date()))
    : null;
  const stage = months === null ? '?' : feedingStage(months).label;
  const avoid = [...ingredientsStore.read().avoid].sort().join(',');
  return [meal.menu, meal.sides.join(','), stage, avoid].join('|');
}

function saveRecipe(key: string, recipe: AiRecipe) {
  const entries = Object.entries(recipeStore.read());
  entries.push([key, {recipe, savedAt: new Date().toISOString()}]);
  // 오래된 것부터 지워 개수를 제한
  entries.sort((a, b) => a[1].savedAt.localeCompare(b[1].savedAt));
  recipeStore.write(Object.fromEntries(entries.slice(-MAX_CACHED)));
}

// 같은 메뉴를 동시에 여러 번 요청하지 않도록 진행 중인 요청을 공유
const inFlight = new Map<string, Promise<AiRecipe>>();

async function fetchRecipe(key: string, meal: Meal): Promise<AiRecipe> {
  const running = inFlight.get(key);
  if (running) return running;

  const settings = settingsStore.read();
  const body: RecipeRequest = {
    today: toLocalIso(new Date()),
    childName: settings.childName,
    birthDate: settings.birthDate,
    avoid: ingredientsStore.read().avoid,
    meal: {menu: meal.menu, sides: meal.sides},
  };

  const promise = (async () => {
    const res = await fetch('/api/recipe', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as RecipeResponse | null;
    if (!data || !data.ok) throw new Error(data?.error ?? `레시피를 가져오지 못했어요 (${res.status}).`);
    saveRecipe(key, data.recipe);
    return data.recipe;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

function toMessage(e: unknown) {
  if (e instanceof TypeError) return '네트워크 오류로 레시피를 가져오지 못했어요.';
  return e instanceof Error ? e.message : '레시피를 가져오지 못했어요.';
}

/** meal이 주어지면 저장된 레시피를 보여주고, 없으면 AI에게 받아 온다 */
export function useRecipe(meal: Meal | null) {
  const [recipes] = recipeStore.useValue();
  const [error, setError] = useState<{key: string; message: string} | null>(null);

  const key = meal ? cacheKey(meal) : null;
  const cached = key ? (recipes[key]?.recipe ?? null) : null;
  const errorMessage = error && error.key === key ? error.message : null;

  // 열었는데 저장된 레시피가 없으면 AI에게 요청한다 (외부 API와의 동기화).
  // 성공하면 저장소가 바뀌어 cached로 들어오고, 실패만 상태로 남긴다.
  useEffect(() => {
    if (!meal || !key || cached || errorMessage) return;
    fetchRecipe(key, meal).catch(e => setError({key, message: toMessage(e)}));
  }, [meal, key, cached, errorMessage]);

  const retry = useCallback(() => setError(null), []);

  return {
    recipe: cached,
    isLoading: !!key && !cached && !errorMessage,
    error: errorMessage,
    /** 오류를 지우면 위 effect가 다시 요청한다 */
    retry,
  };
}

/** 이미 열어서 저장된 레시피만 돌려준다 (없으면 null). 새로 AI를 부르지 않는다 */
export function useCachedRecipes(meals: Meal[]): (AiRecipe | null)[] {
  const [recipes] = recipeStore.useValue();
  return meals.map(meal => recipes[cacheKey(meal)]?.recipe ?? null);
}
