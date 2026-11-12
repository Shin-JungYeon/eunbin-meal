import {betaZodOutputFormat} from '@anthropic-ai/sdk/helpers/beta/zod';
import {ageInMonths} from '@/lib/age';
import {buildMealPrompt, parseSettings} from '@/lib/prompt';
import {
  FALLBACK_OPTIONS,
  MAX_TOKENS,
  MODEL,
  SAFETY_RULES,
  checkStop,
  createClient,
  errorJson as errorResponse,
  handleClaudeError,
  missingKeyResponse,
} from '@/lib/ai-server';
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
${SAFETY_RULES}
- 냉장고 재료를 잘 활용하되, 없는 재료가 꼭 필요하면 구하기 쉬운 것으로 씁니다.
- 한국 가정에서 실제로 해 먹을 만한 메뉴로, 메뉴 이름은 짧게, 곁들임은 1~3개로 씁니다.`;

type Week = NonNullable<MealPlanRequest['regenerate']>['currentWeek'];

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
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

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
    const client = createClient();
    const common = {model: MODEL, max_tokens: MAX_TOKENS, ...FALLBACK_OPTIONS, system: SYSTEM_PROMPT};

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
    return handleClaudeError(error, 'meal-plan');
  }
}
