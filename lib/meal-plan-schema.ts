import {z} from 'zod';

// 서버(API 라우트)와 브라우저가 같이 쓰는 요청/응답 모양.

export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
export const SLOT_KEYS = ['breakfast', 'dinner'] as const;
export const SLOT_LABEL = {breakfast: '아침', dinner: '저녁'} as const;

export type Weekday = (typeof WEEKDAYS)[number];
export type SlotKey = (typeof SLOT_KEYS)[number];

const MAX_MEALS_PER_WEEK = WEEKDAYS.length * SLOT_KEYS.length;

// AI 응답과 "골라서 다시 짜기"로 돌려보내는 요청 양쪽에서 같은 상한을 써서 서로 어긋나지 않게 한다.
const MAX_SIDES = 6;

const MealSchema = z.object({
  menu: z.string().describe('메뉴 이름. 짧게 (예: 소고기 애호박죽)'),
  sides: z.array(z.string()).max(MAX_SIDES).describe('곁들임 반찬·과일 1~3개'),
});

const WeekDaySchema = z.object({
  weekday: z.enum(WEEKDAYS),
  breakfast: MealSchema,
  dinner: MealSchema,
});

/** Claude가 채울 구조화 출력 형식: 일주일 전체 */
export const AiMealPlanSchema = z.object({
  days: z.array(WeekDaySchema).describe('월요일부터 일요일까지 순서대로 정확히 7개'),
  tip: z.string().describe('이번 주 식단에 대한 보호자용 한두 문장 팁'),
});

export type AiMealPlan = z.infer<typeof AiMealPlanSchema>;

/** Claude가 채울 구조화 출력 형식: 선택한 끼니만 */
export const AiReplacementSchema = z.object({
  meals: z
    .array(
      z.object({
        weekday: z.enum(WEEKDAYS),
        slot: z.enum(SLOT_KEYS).describe('breakfast = 아침, dinner = 저녁'),
        menu: MealSchema.shape.menu,
        sides: MealSchema.shape.sides,
      }),
    )
    .describe('바꿔 달라고 한 끼니마다 정확히 하나씩'),
});

export type MealReplacement = z.infer<typeof AiReplacementSchema>['meals'][number];

const shortText = z.string().max(80);
const RequestMealSchema = z.object({menu: shortText, sides: z.array(shortText).max(MAX_SIDES)});

/** 브라우저 → API 요청 본문 (길이 제한으로 과도한 입력 차단) */
export const MealPlanRequestSchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  settings: z.object({
    childName: z.string().max(40),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    conditions: z.array(z.object({id: z.string().max(80), label: z.string().max(120)})).max(30),
    extraNote: z.string().max(300),
  }),
  ingredients: z.object({
    fridge: z.array(z.string().max(40)).max(80),
    avoid: z.array(z.string().max(40)).max(40),
    pantry: z.array(z.string().max(40)).max(60).optional(),
  }),
  /** 있으면 일주일 전체가 아니라 targets 끼니만 새로 짠다 */
  regenerate: z
    .object({
      currentWeek: z
        .array(
          z.object({
            weekday: z.enum(WEEKDAYS),
            breakfast: RequestMealSchema,
            dinner: RequestMealSchema,
          }),
        )
        .length(WEEKDAYS.length),
      targets: z
        .array(z.object({weekday: z.enum(WEEKDAYS), slot: z.enum(SLOT_KEYS)}))
        .min(1)
        .max(MAX_MEALS_PER_WEEK),
    })
    .optional(),
});

export type MealPlanRequest = z.infer<typeof MealPlanRequestSchema>;

export type MealPlanResponse =
  | {ok: true; mode: 'full'; plan: AiMealPlan; warnings: string[]}
  | {ok: true; mode: 'partial'; replacements: MealReplacement[]; warnings: string[]}
  | {ok: false; error: string};
