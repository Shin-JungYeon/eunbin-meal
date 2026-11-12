import {useCallback, useState} from 'react';
import {createLocalStore} from './local-store';
import {settingsStore} from './settings';
import {ingredientsStore} from './ingredients';
import {toLocalIso} from './age';
import type {DayPlan} from './sample-data';
import type {MealPlanRequest, MealPlanResponse, SlotKey, Weekday} from './meal-plan-schema';

export type GeneratedPlan = {
  days: DayPlan[];
  tip: string;
  /** 못 먹는 재료가 결과에 들어간 것으로 보이는 곳 */
  warnings: string[];
  /** ISO 시각 */
  createdAt: string;
};

export const mealPlanStore = createLocalStore<GeneratedPlan | null>(
  'eunbin-meal:meal-plan:v1',
  null,
  raw => {
    const data = raw as GeneratedPlan | null;
    return data && Array.isArray(data.days) && data.days.length === 7 ? data : null;
  },
);

/** 오늘이 속한 주의 월요일 (YYYY-MM-DD) */
function mondayOf(todayIso: string) {
  const [y, m, d] = todayIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const offset = (date.getDay() + 6) % 7; // 월=0 … 일=6
  date.setDate(date.getDate() - offset);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return toLocalIso(next);
}

export type MealTarget = {weekday: Weekday; slot: SlotKey};

function buildBaseRequest(today: string): MealPlanRequest {
  const settings = settingsStore.read();
  return {
    today,
    settings: {
      childName: settings.childName,
      birthDate: settings.birthDate,
      conditions: settings.conditions.map(({id, label}) => ({id, label})),
      extraNote: settings.extraNote,
    },
    ingredients: ingredientsStore.read(),
  };
}

async function postMealPlan(body: MealPlanRequest) {
  const res = await fetch('/api/meal-plan', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as MealPlanResponse | null;
  if (!data || !data.ok) {
    throw new Error(data?.error ?? `식단을 짜지 못했어요 (${res.status}).`);
  }
  return data;
}

export function useGenerateMealPlan() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (task: () => Promise<void>): Promise<boolean> => {
    setIsGenerating(true);
    setError(null);
    try {
      await task();
      return true;
    } catch (e) {
      setError(
        e instanceof TypeError
          ? '네트워크 오류로 식단을 짜지 못했어요. 연결을 확인해 주세요.'
          : e instanceof Error
            ? e.message
            : '식단을 짜지 못했어요.',
      );
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  /** 일주일 전체를 새로 짠다 */
  const generate = useCallback(
    () =>
      run(async () => {
        const today = toLocalIso(new Date());
        const data = await postMealPlan(buildBaseRequest(today));
        if (data.mode !== 'full') throw new Error('AI 응답 형식이 올바르지 않아요.');
        const monday = mondayOf(today);
        mealPlanStore.write({
          days: data.plan.days.map((day, i) => ({...day, date: addDays(monday, i)})),
          tip: data.plan.tip,
          warnings: data.warnings,
          createdAt: new Date().toISOString(),
        });
      }),
    [run],
  );

  /** 지금 식단에서 고른 끼니만 새로 짠다 */
  const regenerate = useCallback(
    (targets: MealTarget[]) =>
      run(async () => {
        const plan = mealPlanStore.read();
        if (!plan) throw new Error('먼저 AI로 이번 주 식단을 짜 주세요.');
        const data = await postMealPlan({
          ...buildBaseRequest(toLocalIso(new Date())),
          regenerate: {
            currentWeek: plan.days.map(({weekday, breakfast, dinner}) => ({
              weekday: weekday as Weekday,
              breakfast,
              dinner,
            })),
            targets,
          },
        });
        if (data.mode !== 'partial') throw new Error('AI 응답 형식이 올바르지 않아요.');
        // 응답을 기다리는 동안 바뀌었을 수 있으니 최신 식단에 덮어쓴다
        const latest = mealPlanStore.read() ?? plan;
        mealPlanStore.write({
          ...latest,
          days: latest.days.map(day => {
            const next = {...day};
            for (const r of data.replacements) {
              if (r.weekday === day.weekday) next[r.slot] = {menu: r.menu, sides: r.sides};
            }
            return next;
          }),
          warnings: data.warnings,
          createdAt: new Date().toISOString(),
        });
      }),
    [run],
  );

  return {generate, regenerate, isGenerating, error};
}
