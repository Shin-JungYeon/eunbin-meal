import {useCallback, useEffect, useState, useSyncExternalStore} from 'react';
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

export type BulkFetchStatus = {done: number; total: number} | null;

// 여러 레시피를 한 번에 불러오는 중인지는 팝업을 닫아도 계속 진행되므로,
// 특정 컴포넌트가 아니라 모듈 전역에 둬서 어디서든(팝업이 닫혀 있어도) 볼 수 있게 한다.
let bulkFetchStatus: BulkFetchStatus = null;
const bulkFetchListeners = new Set<() => void>();

function setBulkFetchStatus(next: BulkFetchStatus) {
  bulkFetchStatus = next;
  bulkFetchListeners.forEach(listener => listener());
}

/** 지금 여러 레시피를 한 번에 불러오는 중이면 진행 상황을, 아니면 null을 돌려준다 */
export function useBulkFetchStatus(): BulkFetchStatus {
  return useSyncExternalStore(
    listener => {
      bulkFetchListeners.add(listener);
      return () => bulkFetchListeners.delete(listener);
    },
    () => bulkFetchStatus,
    () => null,
  );
}

/**
 * 아직 캐시되지 않은 끼니들의 레시피를 하나씩 차례로 불러온다 (여러 개를 한꺼번에 부르지 않음).
 * 호출한 화면(팝업)을 닫아도 끝까지 진행되며, 진행 상황은 useBulkFetchStatus로 어디서든 볼 수 있다.
 * 하나가 실패해도 나머지는 계속 진행한다. 저장은 기존처럼 recipeStore에 바로바로 반영된다.
 */
export async function fetchMissingRecipes(meals: Meal[]): Promise<void> {
  const cache = recipeStore.read();
  const toFetch = meals.filter(meal => !(cacheKey(meal) in cache));
  if (toFetch.length === 0) return;

  setBulkFetchStatus({done: 0, total: toFetch.length});
  for (const [i, meal] of toFetch.entries()) {
    try {
      await fetchRecipe(cacheKey(meal), meal);
    } catch {
      // 하나 실패해도 나머지는 계속 불러온다. 남은 끼니는 버튼을 다시 눌러 이어서 시도할 수 있다.
    }
    setBulkFetchStatus({done: i + 1, total: toFetch.length});
  }
  setBulkFetchStatus(null);
}

const noSubscription = () => () => {};

/** 서버(또는 prerender)에서는 false, 하이드레이션 뒤 브라우저에서만 true */
function useIsClient() {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

/** 이 끼니의 레시피를 한 번이라도 열어 본 적 있는지 */
export function useIsRecipeCached(meal: Meal): boolean {
  const [recipes] = recipeStore.useValue();
  // 모든 끼니 칸에서 항상 렌더되므로, 캐시 키 계산(현재 시각 포함)은 브라우저에서만 한다
  // (prerender와 안 맞는 값이라 Next.js가 경고하는 걸 피한다).
  const isClient = useIsClient();
  return isClient && cacheKey(meal) in recipes;
}
