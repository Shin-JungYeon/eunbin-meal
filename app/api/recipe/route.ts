import {betaZodOutputFormat} from '@anthropic-ai/sdk/helpers/beta/zod';
import {ageInMonths, feedingStage, formatAge} from '@/lib/age';
import {
  FALLBACK_OPTIONS,
  MAX_TOKENS,
  MODEL,
  SAFETY_RULES,
  checkStop,
  createClient,
  errorJson,
  handleClaudeError,
  missingKeyResponse,
} from '@/lib/ai-server';
import {AiRecipeSchema, RecipeRequestSchema, type RecipeRequest, type RecipeResponse} from '@/lib/recipe-schema';

const SYSTEM_PROMPT = `당신은 한국 가정의 영유아 식사를 돕는 요리 선생님입니다.
보호자가 고른 메뉴의 레시피를 아이 월령에 맞춰 집에서 바로 따라 할 수 있게 알려 줍니다.

지켜야 할 것:
${SAFETY_RULES}
- 분량은 g·개·큰술처럼 집에서 재기 쉬운 단위로 씁니다.
- 단계는 짧고 순서대로, 불 세기와 익히는 정도를 구체적으로 씁니다.`;

export async function POST(request: Request) {
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  let body: RecipeRequest;
  try {
    body = RecipeRequestSchema.parse(await request.json());
  } catch {
    return errorJson(400, '요청 형식이 올바르지 않아요.');
  }

  const name = body.childName.trim() || '아이';
  const months = body.birthDate ? ageInMonths(body.birthDate, body.today) : null;
  const lines = [
    `메뉴: ${body.meal.menu}`,
    `곁들임: ${body.meal.sides.length > 0 ? body.meal.sides.join(', ') : '없음'}`,
    months === null
      ? `${name}의 월령은 모릅니다. 유아식 기준으로 써 주세요.`
      : `${name}는 생후 ${months}개월(${formatAge(months)}), 식단 단계는 ${feedingStage(months).label}(${feedingStage(months).detail})입니다.`,
    `절대 쓰면 안 되는 재료: ${body.avoid.length > 0 ? body.avoid.join(', ') : '없음'}`,
    '',
    '이 메뉴의 레시피를 알려 주세요. 곁들임은 각각 짧게 만드는 법을 알려 주세요.',
  ];

  try {
    const response = await createClient().beta.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // 레시피는 정해진 메뉴를 풀어 쓰는 일이라 짧게 생각하고 빨리 답하게 한다
      output_config: {effort: 'low', format: betaZodOutputFormat(AiRecipeSchema)},
      ...FALLBACK_OPTIONS,
      system: SYSTEM_PROMPT,
      messages: [{role: 'user', content: lines.join('\n')}],
    });

    const failure = checkStop(response.stop_reason, '레시피');
    if (failure) return failure;

    const recipe = response.parsed_output;
    if (!recipe || recipe.steps.length === 0) {
      return errorJson(502, 'AI 응답 형식이 올바르지 않아요. 다시 시도해 주세요.');
    }
    return Response.json({ok: true, recipe} satisfies RecipeResponse);
  } catch (error) {
    return handleClaudeError(error, 'recipe');
  }
}
