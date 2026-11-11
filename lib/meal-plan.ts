import {useCallback, useState} from 'react';
import {createLocalStore} from './local-store';
import {settingsStore} from './settings';
import {ingredientsStore} from './ingredients';
import {toLocalIso} from './age';
import type {DayPlan} from './sample-data';
import type {MealPlanRequest, MealPlanResponse} from './meal-plan-schema';

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

export function useGenerateMealPlan() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (): Promise<boolean> => {
    setIsGenerating(true);
    setError(null);
    try {
      const today = toLocalIso(new Date());
      const settings = settingsStore.read();
      const body: MealPlanRequest = {
        today,
        settings: {
          childName: settings.childName,
          birthDate: settings.birthDate,
          conditions: settings.conditions.map(({id, label, enabled}) => ({id, label, enabled})),
          extraNote: settings.extraNote,
        },
        ingredients: ingredientsStore.read(),
      };

      const res = await fetch('/api/meal-plan', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as MealPlanResponse | null;
      if (!data || !data.ok) {
        setError(data?.error ?? `식단을 짜지 못했어요 (${res.status}).`);
        return false;
      }

      const monday = mondayOf(today);
      mealPlanStore.write({
        days: data.plan.days.map((day, i) => ({...day, date: addDays(monday, i)})),
        tip: data.plan.tip,
        warnings: data.warnings,
        createdAt: new Date().toISOString(),
      });
      return true;
    } catch {
      setError('네트워크 오류로 식단을 짜지 못했어요. 연결을 확인해 주세요.');
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {generate, isGenerating, error};
}
