# 참고 레시피 기능 설계

## 의도 / 왜

사용자는 인터넷이나 주변에서 본 레시피(텍스트, 사진, 블로그/레시피 링크, 유튜브 영상)를 앱에
저장해 두고, 이후 AI가 주간 식단을 짤 때 그 레시피들을 참고하길 원한다. 저장한 레시피를
한곳에서 다시 볼 수 있는 전용 페이지도 필요하다.

현재 앱은 서버(API 라우트)에서만 Claude를 호출하고, 결과는 브라우저 localStorage에
기기별로 저장한다(백엔드 DB 없음). 식단 생성은 `lib/prompt.ts`의 `buildMealPrompt`가
조립한 텍스트를 `/api/meal-plan`에 보내 이뤄진다. 이 기능도 같은 패턴(로컬 저장 +
서버 API로 Claude 호출)을 따른다.

## 목표

- 텍스트 / 이미지 / 레시피 링크 / 유튜브 링크, 4가지 방식으로 레시피를 추가할 수 있다.
- 추가한 레시피는 기기에 저장되어 다음에도 볼 수 있다.
- "참고 레시피" 전용 페이지에서 저장한 레시피 목록을 보고, 상세를 열어보고, 지울 수 있다.
- 식단을 짤 때(AI 호출) 저장된 참고 레시피들을 프롬프트에 포함해 AI가 활용하도록 한다.

## 비목표 / 안티골

- 여러 기기/보호자 간 동기화, 서버 DB 도입 — 지금처럼 이 기기의 localStorage만 쓴다.
- 유튜브 영상의 실제 자막/음성 추출 — 공식 API가 없어 비공식 스크래핑은 깨지기 쉬우므로
  하지 않는다. 대신 제목·설명(가능하면)과 사용자가 직접 적는 메모로 대체한다.
- 저장된 참고 레시피를 식단의 특정 끼니에 자동으로 "연결"해서, 그 끼니 레시피 보기를 누르면
  저장된 내용을 그대로 보여주는 것 — 이번 범위에서는 하지 않는다. AI가 식단을 짤 때 메뉴
  선택의 참고 자료로만 쓰이고, 끼니별 레시피 보기는 지금처럼 `/api/recipe`가 새로 생성한다.
  (나중에 따로 요청할 수 있는 확장 지점으로 남겨둔다.)
- 참고 레시피의 재추출/수정 편집 기능 — 제목·재료·단계를 고쳐 쓰는 편집 UI는 만들지
  않는다. 추출에 실패하면 저장하지 않으므로, 다시 하려면 새로 추가한다.
- localStorage 용량 관리(이미지가 많이 쌓였을 때의 정리) — 개인 가족 단위 사용 규모를
  가정하고 별도 대책은 만들지 않는다.

## 제약

- Claude 호출은 서버(API 라우트)에서만 한다 (`ANTHROPIC_API_KEY`는 브라우저에 노출 불가).
- 외부 URL 가져오기(레시피 링크, 유튜브 메타데이터)도 서버에서 fetch한다 (CORS 회피 +
  일관성).
- 새 컴포넌트는 AGENTS.md의 Astryx 워크플로를 따른다: `<div>` 금지, 레이아웃/간격은
  컴포넌트가 처리, 색은 토큰만, 새 화면은 템플릿에서 시작.

## 검토한 접근 (사용자와 합의)

소스별 추출 방식에 트레이드오프가 있어 미리 논의했다:

- **텍스트**: 입력 그대로 Claude에 보내 구조화(제목/요약/재료/단계) — 간단하고 안정적.
- **이미지**: Claude 비전으로 사진 속 레시피를 읽어 구조화 — 비전 인식이 꽤 안정적이라 채택.
- **레시피 링크**: 서버에서 페이지를 가져와 본문 텍스트를 추출한 뒤 Claude로 구조화.
- **유튜브 링크**: ① 제목·설명 메타데이터 + 사용자 메모만으로 Claude가 추정 구조화
  (빠르고 안정적, 세부 조리법은 놓칠 수 있음) vs ② 비공식 자막 스크래핑 라이브러리 추가
  (더 정확할 수 있으나 유튜브 변경에 취약, 새 의존성 추가). **①로 결정** — 사용자가 승인.

## 데이터 모델

`lib/reference-recipe-schema.ts` (서버·브라우저 공용, zod):

```ts
type SourceType = 'text' | 'image' | 'link' | 'youtube';

// Claude가 채울 구조화 출력 — 소스가 부실해도 steps/mainIngredients는 빈 배열 허용
ExtractedRecipeSchema = {
  title: string;          // 메뉴 이름 추정
  summary: string;        // 한두 문장 소개
  mainIngredients: string[]; // 분량 없이 이름만 (출처마다 분량 표기가 다르므로)
  steps: string[];        // 알 수 있는 만큼만. 모르면 빈 배열
  note: string;           // 추출 한계나 출처 특이사항 (예: "영상 설명 기반 추정")
}

ReferenceRecipeRequestSchema = {
  sourceType: SourceType;
  text?: string;      // sourceType === 'text'일 때 본문
  imageDataUrls?: string[]; // sourceType === 'image'일 때 (data: URL 여러 장, 최대 4장, 클라이언트에서 리사이즈 완료)
  url?: string;       // sourceType === 'link' | 'youtube'일 때
  note?: string;       // 사용자가 보탠 메모 (모든 타입에서 선택적, youtube에서 특히 권장)
}

ReferenceRecipeResponse =
  | {ok: true; recipe: ExtractedRecipeSchema}
  | {ok: false; error: string}
```

저장 레코드 (`lib/reference-recipe.ts`, localStorage 키 `eunbin-meal:reference-recipes:v1`):

```ts
type ReferenceRecipeEntry = {
  id: string;
  createdAt: string; // ISO
  sourceType: SourceType;
  sourceText?: string;      // text 타입 원문 (상세 화면에 원문도 보여줌)
  sourceUrl?: string;       // link/youtube 원본 주소
  imageDataUrls?: string[]; // image 타입, 리사이즈된 데이터 URL 여러 장 (최대 4장)
  userNote?: string;
  status: 'ready' | 'pending';
  extracted: ExtractedRecipeSchema | null; // pending일 때 null
}
```

**실패한 항목은 목록에 남기지 않는다 (사용자 결정)**: `/api/reference-recipe` 호출이
실패하면 그 `pending` 항목을 저장소에서 바로 지운다 — `error` 상태를 따로 저장하지
않는다. 실패 시점에 추가 화면/목록 화면이 열려 있으면 일회성 오류 안내(배너/토스트)만
보여주고, 사용자는 입력을 다시 해서 새로 추가해야 한다. 이 선택의 결과로 원본 입력은
보존하지 않는다 — 개인용 저장 규모에서는 다시 입력하는 비용이 작다고 보고 목록을 깨끗하게
유지하는 쪽을 택했다.

**목록에서 제목 표시 (내 판단으로 확정)**: `pending`(아직 `extracted`가 없는) 항목도
목록에 한 줄은 보여야 한다. 다음 규칙으로 화면 전용 표시용 제목을 만든다 (별도 필드로
저장하지 않고 목록/상세 컴포넌트에서 계산):
- `text`: `sourceText`의 앞부분(예: 20자) + "…"
- `link`/`youtube`: `sourceUrl`의 호스트명(예: `youtube.com`, `example.com`)
- `image`: 고정 문구 "사진 레시피" (여러 장이어도 동일)

**pending이 영원히 멈추는 경우 (내 판단으로 확정)**: 탭을 닫거나 새로고침하면 진행 중이던
요청의 메모리 상태(`inFlight`에 해당하는 것)는 사라지므로, 다음 방문 때 `status:'pending'`
항목이 끝나지 않은 채로 남아있을 수 있다. 이런 항목은 재시도 버튼 없이 삭제 버튼만
제공한다 (실패를 목록에 남기지 않기로 한 결정과 일관되게, 다시 시도하려면 새로 추가).

## 서버: `/api/reference-recipe`

`POST`, 기존 `/api/recipe`와 같은 공통 유틸(`lib/ai-server.ts`)을 재사용.

- `sourceType === 'text'`: 입력 텍스트를 그대로 Claude에 전달.
- `sourceType === 'image'`: `imageDataUrls`의 각 장을 비전 콘텐츠 블록으로 전달
  (`messages.parse`에 image block을 장 수만큼 포함, 최대 4장). 한 레시피가 여러 장(예:
  재료 사진 + 조리 과정 사진)에 걸쳐 있을 수 있으므로 Claude에게 "여러 장이 한 레시피"임을
  프롬프트에서 알려준다. 입력 크기 상한을 둬 과도하게 큰 base64를 막는다(zod `max`, 장당
  + 전체 합계 모두 제한).
- `sourceType === 'link'`: 서버에서 `fetch(url)` (타임아웃, 응답 크기 상한) → HTML에서
  `<script>`/`<style>` 제거 후 텍스트만 추출 → 앞부분 일정 길이로 자름 → Claude에 전달.
  fetch 실패/타임아웃이면 `{ok:false, error:'페이지를 가져오지 못했어요. 메모를 직접
  입력해 텍스트로 추가해 보세요.'}`.
- `sourceType === 'youtube'`: oEmbed(`https://www.youtube.com/oembed?url=...&format=json`)로
  제목 확보 → 가능하면 영상 페이지의 `og:description` 메타 태그도 가져옴 → 제목 + 설명 +
  사용자 메모를 Claude에 전달해 추정 구조화. 메타데이터조차 못 가져오면 제목 없이 URL과
  사용자 메모만으로 시도하고, 그마저 비어 있으면 에러 반환(최소 하나는 있어야 함).
  `og:description` 가져오기가 실패하거나(쿠키 동의 페이지 등으로 막히는 경우 포함) 아예
  비어 있어도 oEmbed 제목 + 사용자 메모만으로 조용히 진행한다 — 이는 임시 땜질이 아니라
  의도한 정상 동작이다. 추후 더 나은 방법이 필요해지면 그건 별도 요청으로 다룬다.
- 모든 경우 Claude 응답 스키마는 `ExtractedRecipeSchema` (effort: low, 기존 레시피
  생성과 동일하게 짧게 생각하도록).
- 공통 에러 처리(`handleClaudeError`, `checkStop`, `missingKeyResponse`)는 기존 라우트와
  동일하게 재사용.

## 클라이언트: `lib/reference-recipe.ts`

`lib/recipe.ts`의 캐시/저장 패턴을 참고하되 더 단순하게:

- `referenceRecipeStore = createLocalStore<Record<string, ReferenceRecipeEntry>>(...)`.
- `useReferenceRecipes()`: 목록(최신순) 반환.
- `addReferenceRecipe(input)`: id 발급 → `status:'pending'`으로 먼저 저장(화면에 즉시
  "불러오는 중" 항목이 보이게) → `/api/reference-recipe` 호출 → 성공 시 `extracted` 채우고
  `status:'ready'`로 갱신, 실패 시 그 항목을 저장소에서 지우고 호출한 쪽에 오류를 던져
  화면이 배너로 보여주게 한다.
- `deleteReferenceRecipe(id)`: 사용자가 직접 지우거나, 끝나지 않고 멈춰 있는 `pending`
  항목을 정리할 때 쓴다.
- `useReferenceRecipesForPrompt()`: `status==='ready'`인 항목을 최신순으로 최대 15개,
  `{title, summary}`만 추려 반환 (프롬프트 길이 제한용).

이미지는 `AddReferenceRecipeDialog`에서 파일을 받은 즉시(장마다) `<canvas>`로 긴 변
1024px, JPEG quality 0.75 정도로 리사이즈한 뒤 데이터 URL로 변환해 저장/전송한다 (원본
그대로 저장하면 localStorage 용량을 빨리 소모하므로). 한 레시피에 최대 4장까지 첨부할
수 있고, 추가/삭제(순서 변경은 불필요)가 가능한 간단한 썸네일 목록으로 보여준다.

## 향후 DB 연동 대비

이번 범위에서 실제 DB를 붙이지는 않지만(비목표), 나중에 localStorage를 서버 DB로 바꾸는
비용을 낮추기 위해 다음을 지킨다 — 기존 스토어들(`ingredientsStore`, `settingsStore`
등)은 여러 파일에서 직접 `.read()`를 호출하지만, 새로 만드는 이 모듈은 아래 규칙으로
경계를 둔다:

- `referenceRecipeStore`(의 `createLocalStore` 인스턴스)는 `lib/reference-recipe.ts`
  밖으로 내보내지 않는다. 다른 모듈(`lib/meal-plan.ts`, 화면 컴포넌트 등)은 이 파일이
  내보내는 함수/훅(`useReferenceRecipes`, `addReferenceRecipe`, `deleteReferenceRecipe`,
  `readReferenceRecipesForPrompt`)으로만 접근한다. 저장소를 실제 DB 호출(API 라우트 경유)
  로 바꿀 때 이 파일 내부만 고치면 되게 하기 위함이다.
- `addReferenceRecipe`는 어차피 Claude 호출이 있어 이미 비동기이므로, DB로 바뀌어도
  시그니처가 그대로다. `useReferenceRecipes`/`deleteReferenceRecipe`/
  `readReferenceRecipesForPrompt`는 지금은 동기(localStorage라 즉시 반환)이지만, 나중에
  DB를 붙이면 내부적으로 비동기가 될 수 있다는 점을 감안해 호출부는 이미 훅의 반환값이
  바뀔 때 리렌더되는 구조(`useSyncExternalStore` 기반)로 짜여 있어 큰 수정 없이 로딩
  상태만 추가하면 될 것으로 본다. 이번 구현에서 로딩 상태를 미리 만들어두지는 않는다.
- 이미지(`imageDataUrls`)는 지금은 data URL 문자열을 그대로 저장하지만, DB로 가면 실제
  파일은 별도 오브젝트 스토리지에 두고 이 필드엔 그 파일을 가리키는 URL 문자열이 들어가는
  구조로 바뀔 수 있다. 지금 당장 그렇게 만들지는 않되, "data URL이거나 나중엔 다른 URL일
  수 있는 이미지 참조 문자열"이라는 의미로 다루면 되므로 필드 타입(`string[]`)은 바뀌지
  않을 전망이다.

## 식단 생성 프롬프트 반영

- `lib/prompt.ts` `buildMealPrompt`에 선택적 인자 `referenceRecipes?: {title:string;
  summary:string}[]` 추가. 비어있지 않으면 끝에 다음 형식으로 줄 추가:
  ```
  참고 레시피 목록 (가능하면 이 중에서 메뉴를 고르거나 활용해 주세요):
  - {title}: {summary}
  ...
  ```
- `lib/meal-plan-schema.ts`의 `MealPlanRequestSchema`에
  `referenceRecipes: z.array(z.object({title: shortText, summary: z.string().max(200)})).max(15)`
  (기본 빈 배열) 추가.
- `lib/meal-plan.ts`의 `buildBaseRequest`는 `referenceRecipeStore.read()`를 직접 읽지
  않고, `lib/reference-recipe.ts`가 내보내는 `readReferenceRecipesForPrompt()`(훅이 아닌
  일반 함수, `useReferenceRecipesForPrompt`와 같은 선별 로직을 공유)를 호출한다 — 아래
  "향후 DB 연동 대비" 참고.
- `app/api/meal-plan/route.ts`는 받은 `referenceRecipes`를 그대로 `buildMealPrompt`에
  넘긴다. 안전 규칙(못 먹는 재료 제외)은 참고 레시피 유무와 무관하게 기존 `findAvoidHits`
  검사가 그대로 최종 결과에 적용되므로 별도 처리가 필요 없다.
- `app/settings/page.tsx`의 "프롬프트 미리보기" 카드도 참고 레시피 목록을 반영하도록
  `buildMealPrompt` 호출에 같은 인자를 추가한다(있으면 미리보기에도 보이는 게 자연스러움).

## 화면

- **탐색**: `components/AppFrame.tsx`의 `TABS`에 4번째 탭 추가 — `/recipes`, 라벨
  "참고 레시피", 부제 "직접 추가한 레시피 모음", 아이콘은 heroicons에서 책 모양
  (`BookOpenIcon`/`BookOpenIcon` solid) 사용.
- **목록 페이지** `app/recipes/page.tsx`: 저장된 항목을 최신순 카드/리스트로 보여줌
  (제목 — `extracted.title`이 있으면 그것, 없으면 위 "목록에서 제목 표시" 규칙으로 만든
  임시 제목 —, 출처 아이콘, 요약 한 줄, `pending`이면 스피너와 삭제 버튼만). 실패한
  시도는 목록에 남기지 않고, 실패 순간 화면이 열려 있었다면 배너로 한 번만 알린다.
  우측 상단/상단에 "레시피 추가" 버튼. 항목을 누르면 상세(다이얼로그 또는 바텀시트,
  `RecipeDialog`처럼 `useMediaQuery(SHEET_QUERY)`로 분기)에서 제목/요약/재료/단계와,
  있으면 `note`(추출 한계 안내 — `RecipeDialog`의 `childTips` 배너처럼 info `Banner`로)와
  `userNote`(사용자 메모, 일반 텍스트)를 보여주고, 원본(이미지는 여러 장이면 가로
  스크롤/그리드 썸네일 목록, 원문 텍스트, 또는 링크 열기 버튼)과 삭제 버튼을 제공한다.
- **추가 다이얼로그** `components/AddReferenceRecipeDialog.tsx`: 소스 타입 4개를 고르는
  탭/세그먼트, 타입별 입력(텍스트: TextArea, 이미지: 파일 선택 여러 장(최대 4장) + 썸네일
  미리보기·장별 삭제, 링크: URL TextInput, 유튜브: URL TextInput + 메모 TextArea). 제출 시
  `addReferenceRecipe` 호출, 진행 중 스피너, 실패 시 다이얼로그 안에 에러 배너를 보여주고
  입력값은 그대로 남겨 바로 다시 제출해볼 수 있게 한다 (저장소에는 실패가 남지 않음).
- 정확한 컴포넌트 선정은 AGENTS.md 워크플로에 따라 구현 시 `astryx search`/`astryx
  component`로 확인한다 (탭 전환, 파일 입력에 맞는 Astryx 컴포넌트 확인 필요 — 설계
  시점에는 존재를 가정만 함).

## 구현자에게 남기는 것

- 정확한 Astryx 컴포넌트 이름(탭/세그먼트 컨트롤, 파일 업로드)과 템플릿 선택은 구현 시
  `astryx` CLI로 확인한다.
- 링크 본문 추출의 "텍스트만 뽑는" 구체적 방식(정규식 기반 태그 제거 수준이면 충분,
  별도 파서 라이브러리 추가는 지양 — 새 의존성 없이 가는 게 이 프로젝트 기조와 맞음).
- 유튜브 메타데이터 fetch 실패 시 메시지 문구, 에러 배너 문구들의 정확한 한국어 표현.
- `MAX_CACHED`(기존 레시피 60개)처럼 참고 레시피 저장 개수 상한을 둘지 여부 — 필요하면
  구현 중 적당한 값(예: 100개)을 정해 가장 오래된 것부터 정리한다.
