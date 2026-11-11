import {z} from 'zod';

// 서버(API 라우트)와 브라우저가 같이 쓰는 요청/응답 모양.

export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

const MealSchema = z.object({
  menu: z.string().describe('메뉴 이름. 짧게 (예: 소고기 애호박죽)'),
  sides: z.array(z.string()).describe('곁들임 반찬·과일 1~3개'),
});

/** Claude가 채울 구조화 출력 형식 */
export const AiMealPlanSchema = z.object({
  days: z
    .array(
      z.object({
        weekday: z.enum(WEEKDAYS),
        breakfast: MealSchema,
        dinner: MealSchema,
      }),
    )
    .describe('월요일부터 일요일까지 순서대로 정확히 7개'),
  tip: z.string().describe('이번 주 식단에 대한 보호자용 한두 문장 팁'),
});

export type AiMealPlan = z.infer<typeof AiMealPlanSchema>;

/** 브라우저 → API 요청 본문 (길이 제한으로 과도한 입력 차단) */
export const MealPlanRequestSchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  settings: z.object({
    childName: z.string().max(40),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    conditions: z
      .array(z.object({id: z.string().max(80), label: z.string().max(120), enabled: z.boolean()}))
      .max(30),
    extraNote: z.string().max(300),
  }),
  ingredients: z.object({
    fridge: z.array(z.string().max(40)).max(80),
    avoid: z.array(z.string().max(40)).max(40),
  }),
});

export type MealPlanRequest = z.infer<typeof MealPlanRequestSchema>;

export type MealPlanResponse =
  | {ok: true; plan: AiMealPlan; warnings: string[]}
  | {ok: false; error: string};
