import Anthropic from '@anthropic-ai/sdk';
import {betaZodOutputFormat} from '@anthropic-ai/sdk/helpers/beta/zod';
import {ageInMonths} from '@/lib/age';
import {buildMealPrompt, parseSettings} from '@/lib/prompt';
import {
  AiMealPlanSchema,
  AiReplacementSchema,
  MealPlanRequestSchema,
  SLOT_LABEL,
  WEEKDAYS,
  type MealPlanRequest,
  type MealPlanResponse,
  type MealReplacement,
} from '@/lib/meal-plan-schema';

const SYSTEM_PROMPT = `당신은 한국 가정의 영유아 식단을 짜는 영양 전문가입니다.
보호자가 알려준 아이의 월령, 냉장고 재료, 못 먹는 재료, 조건에 맞춰 아침·저녁 식단을 짭니다.

지켜야 할 것:
- "절대 쓰면 안 되는 재료"는 알레르기일 수 있으니 메뉴와 반찬 어디에도 넣지 않습니다. 그 재료로 만든 가공품도 함께 뺍니다. (예: 우유 → 치즈·요거트·버터·크림, 달걀 → 마요네즈·계란찜·전 반죽의 달걀, 밀 → 빵·국수·부침가루, 대두 → 두부·된장·간장)
- 월령과 식단 단계에 맞는 질감과 간으로 짭니다. 12개월 미만이면 꿀과 생우유를 쓰지 않습니다. 통견과류, 통포도처럼 질식 위험이 큰 형태는 쓰지 않습니다.
- 냉장고 재료를 잘 활용하되, 없는 재료가 꼭 필요하면 구하기 쉬운 것으로 씁니다.
- 한국 가정에서 실제로 해 먹을 만한 메뉴로, 메뉴 이름은 짧게, 곁들임은 1~3개로 씁니다.`;

type Week = NonNullable<MealPlanRequest['regenerate']>['currentWeek'];

function errorResponse(status: number, error: string) {
  return Response.json({ok: false, error} satisfies MealPlanResponse, {status});
}

/** 못 먹는 재료 이름이 식단 문구에 그대로 들어갔는지 마지막으로 한 번 더 확인 */
function findAvoidHits(days: Week, avoid: string[]): string[] {
  const hits: string[] = [];
  for (const day of days) {
    for (const slot of ['breakfast', 'dinner'] as const) {
      const meal = day[slot];
      const text = [meal.menu, ...meal.sides].join(' ');
      for (const name of avoid) {
        if (name && text.includes(name)) {
          hits.push(`${day.weekday} ${SLOT_LABEL[slot]}: '${name}' 포함 (${meal.menu})`);
        }
      }
    }
  }
  return hits;
}

function describeMeal(meal: {menu: string; sides: string[]}) {
  return meal.sides.length > 0 ? `${meal.menu} (곁들임: ${meal.sides.join(', ')})` : meal.menu;
}

/** 선택한 끼니만 바꿀 때 기본 요청 뒤에 붙이는 내용 */
function buildReplacePrompt(regenerate: NonNullable<MealPlanRequest['regenerate']>) {
  const lines = ['', '이번 주 현재 식단:'];
  for (const day of regenerate.currentWeek) {
    lines.push(
      `- ${day.weekday} 아침: ${describeMeal(day.breakfast)}`,
      `- ${day.weekday} 저녁: ${describeMeal(day.dinner)}`,
    );
  }
  lines.push(
    '',
    '보호자가 아래 끼니를 마음에 들어 하지 않았어요. 이 끼니만 새 메뉴로 바꿔 주세요.',
    '현재 메뉴와는 다른 메뉴로 짜고, 바꾸지 않는 나머지 끼니와도 겹치지 않게 해 주세요.',
  );
  for (const target of regenerate.targets) {
    const day = regenerate.currentWeek.find(d => d.weekday === target.weekday);
    const current = day ? ` (현재: ${day[target.slot].menu})` : '';
    lines.push(`- ${target.weekday} ${SLOT_LABEL[target.slot]}${current}`);
  }
  return lines;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse(
      500,
      'ANTHROPIC_API_KEY가 설정되지 않았어요. 프로젝트 폴더의 .env.local에 키를 넣고 개발 서버를 다시 시작해 주세요.',
    );
  }

  let body: MealPlanRequest;
  try {
    body = MealPlanRequestSchema.parse(await request.json());
  } catch {
    return errorResponse(400, '요청 형식이 올바르지 않아요.');
  }

  const settings = parseSettings(body.settings);
  const months = settings.birthDate ? ageInMonths(settings.birthDate, body.today) : null;
  const baseLines = buildMealPrompt(settings, months, body.ingredients);
  const {regenerate} = body;

  try {
    // API 키는 서버에서만 읽는다 (.env.local의 ANTHROPIC_API_KEY). 브라우저로 내려가지 않는다.
    const client = new Anthropic();
    const common = {
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // 안전 분류기가 요청을 거절하면 서버에서 다른 모델로 한 번 더 시도한다.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default' as const,
      system: SYSTEM_PROMPT,
    };

    if (regenerate) {
      // ── 선택한 끼니만 다시 짜기 ──
      const response = await client.beta.messages.parse({
        ...common,
        output_config: {effort: 'medium', format: betaZodOutputFormat(AiReplacementSchema)},
        messages: [
          {role: 'user', content: [...baseLines, ...buildReplacePrompt(regenerate)].join('\n')},
        ],
      });
      const failure = checkStop(response.stop_reason);
      if (failure) return failure;

      const meals = response.parsed_output?.meals ?? [];
      const replacements: MealReplacement[] = [];
      for (const target of regenerate.targets) {
        const found = meals.find(m => m.weekday === target.weekday && m.slot === target.slot);
        if (!found) return errorResponse(502, 'AI가 일부 끼니를 빠뜨렸어요. 다시 시도해 주세요.');
        replacements.push(found);
      }

      const merged = regenerate.currentWeek.map(day => {
        const next = {...day};
        for (const r of replacements) {
          if (r.weekday === day.weekday) next[r.slot] = {menu: r.menu, sides: r.sides};
        }
        return next;
      });
      const warnings = findAvoidHits(merged, body.ingredients.avoid);
      return Response.json({ok: true, mode: 'partial', replacements, warnings} satisfies MealPlanResponse);
    }

    // ── 일주일 전체 짜기 ──
    const response = await client.beta.messages.parse({
      ...common,
      output_config: {effort: 'medium', format: betaZodOutputFormat(AiMealPlanSchema)},
      messages: [
        {
          role: 'user',
          content: [...baseLines, '', '결과는 월요일부터 일요일까지 정확히 7일입니다.'].join('\n'),
        },
      ],
    });
    const failure = checkStop(response.stop_reason);
    if (failure) return failure;

    const plan = response.parsed_output;
    if (!plan || plan.days.length !== 7) {
      return errorResponse(502, 'AI 응답 형식이 올바르지 않아요. 다시 시도해 주세요.');
    }
    // 요일 순서를 월~일로 고정
    plan.days.sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday));

    const warnings = findAvoidHits(plan.days, body.ingredients.avoid);
    return Response.json({ok: true, mode: 'full', plan, warnings} satisfies MealPlanResponse);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return errorResponse(401, 'API 키가 올바르지 않아요. .env.local의 ANTHROPIC_API_KEY를 확인해 주세요.');
    }
    if (error instanceof Anthropic.RateLimitError) {
      return errorResponse(429, '요청이 많아 잠시 막혔어요. 조금 뒤에 다시 시도해 주세요.');
    }
    if (error instanceof Anthropic.APIError) {
      console.error('[meal-plan] Claude API error', error.status, error.message);
      return errorResponse(502, `AI 서버 오류가 발생했어요 (${error.status ?? '연결 실패'}). 잠시 뒤 다시 시도해 주세요.`);
    }
    console.error('[meal-plan] unexpected error', error);
    return errorResponse(500, '식단을 짜는 중 알 수 없는 오류가 발생했어요.');
  }
}

function checkStop(stopReason: string | null) {
  if (stopReason === 'refusal') {
    return errorResponse(
      422,
      'AI가 이 요청으로는 식단을 짤 수 없다고 답했어요. 조건이나 추가 요청사항을 바꿔서 다시 시도해 주세요.',
    );
  }
  if (stopReason === 'max_tokens') {
    return errorResponse(502, 'AI 응답이 중간에 끊겼어요. 다시 시도해 주세요.');
  }
  return null;
}
