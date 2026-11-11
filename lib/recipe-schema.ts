import {z} from 'zod';

// 레시피 API의 요청/응답 모양 (서버와 브라우저 공용).

/** Claude가 채울 구조화 출력 형식 */
export const AiRecipeSchema = z.object({
  summary: z.string().describe('이 메뉴를 한 문장으로 소개 (아이에게 좋은 점 포함)'),
  cookMinutes: z.number().describe('준비부터 완성까지 대략 걸리는 시간(분)'),
  servings: z.string().describe('기준 분량 (예: 아이 1회분 + 보호자 1인분)'),
  ingredients: z
    .array(z.object({name: z.string(), amount: z.string().describe('예: 30g, 1/4개, 1큰술')}))
    .describe('메인 메뉴 재료와 분량'),
  steps: z.array(z.string()).describe('만드는 순서. 한 단계에 한 동작씩 짧게'),
  childTips: z
    .array(z.string())
    .describe('이 월령 아이에게 줄 때 주의할 점 (크기·질감·간·온도 등) 1~3개'),
  sides: z
    .array(z.object({name: z.string(), howTo: z.string().describe('한두 문장 만드는 법')}))
    .describe('곁들임마다 하나씩'),
});

export type AiRecipe = z.infer<typeof AiRecipeSchema>;

const shortText = z.string().max(80);

export const RecipeRequestSchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  childName: z.string().max(40),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  avoid: z.array(z.string().max(40)).max(40),
  meal: z.object({menu: shortText, sides: z.array(shortText).max(6)}),
});

export type RecipeRequest = z.infer<typeof RecipeRequestSchema>;

export type RecipeResponse = {ok: true; recipe: AiRecipe} | {ok: false; error: string};
