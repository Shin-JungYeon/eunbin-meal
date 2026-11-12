import Anthropic from '@anthropic-ai/sdk';

// 서버(API 라우트) 전용: Claude 호출에 공통으로 쓰는 설정과 오류 처리.

export const MODEL = 'claude-opus-5-5';

/** 식단·레시피 호출 모두에 쓰는 응답 토큰 상한 */
export const MAX_TOKENS = 16000;

/** 식단·레시피 모두에 들어가는 안전 규칙 */
export const SAFETY_RULES = `- "절대 쓰면 안 되는 재료"는 알레르기일 수 있으니 메뉴와 반찬 어디에도 넣지 않습니다. 그 재료로 만든 가공품도 함께 뺍니다. (예: 우유 → 치즈·요거트·버터·크림, 달걀 → 마요네즈·계란찜·전 반죽의 달걀, 밀 → 빵·국수·부침가루, 대두 → 두부·된장·간장)
- 월령과 식단 단계에 맞는 질감과 간으로 짭니다. 12개월 미만이면 꿀과 생우유를 쓰지 않습니다. 통견과류, 통포도처럼 질식 위험이 큰 형태는 쓰지 않습니다.`;

/** 안전 분류기가 요청을 거절하면 서버에서 다른 모델로 한 번 더 시도한다 */
export const FALLBACK_OPTIONS = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default' as const,
};

export function errorJson(status: number, error: string) {
  return Response.json({ok: false as const, error}, {status});
}

export function missingKeyResponse() {
  if (process.env.ANTHROPIC_API_KEY) return null;
  return errorJson(
    500,
    'ANTHROPIC_API_KEY가 설정되지 않았어요. 프로젝트 폴더의 .env.local에 키를 넣고 개발 서버를 다시 시작해 주세요.',
  );
}

/** API 키는 서버에서만 읽는다 (.env.local의 ANTHROPIC_API_KEY). 브라우저로 내려가지 않는다. */
export function createClient() {
  return new Anthropic();
}

export function checkStop(stopReason: string | null, what = '식단') {
  if (stopReason === 'refusal') {
    return errorJson(
      422,
      `AI가 이 요청으로는 ${what}을 만들 수 없다고 답했어요. 조건을 바꿔서 다시 시도해 주세요.`,
    );
  }
  if (stopReason === 'max_tokens') {
    return errorJson(502, 'AI 응답이 중간에 끊겼어요. 다시 시도해 주세요.');
  }
  return null;
}

export function handleClaudeError(error: unknown, tag: string) {
  if (error instanceof Anthropic.AuthenticationError) {
    return errorJson(401, 'API 키가 올바르지 않아요. .env.local의 ANTHROPIC_API_KEY를 확인해 주세요.');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return errorJson(429, '요청이 많아 잠시 막혔어요. 조금 뒤에 다시 시도해 주세요.');
  }
  if (error instanceof Anthropic.APIError) {
    console.error(`[${tag}] Claude API error`, error.status, error.message);
    return errorJson(502, `AI 서버 오류가 발생했어요 (${error.status ?? '연결 실패'}). 잠시 뒤 다시 시도해 주세요.`);
  }
  console.error(`[${tag}] unexpected error`, error);
  return errorJson(500, '처리 중 알 수 없는 오류가 발생했어요.');
}
