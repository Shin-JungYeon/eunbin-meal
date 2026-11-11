// 이번 단계는 AI 연동 없이 화면만 만든다. 아래는 모두 하드코딩된 샘플 데이터.

export type MealSlot = 'breakfast' | 'dinner';

export type Meal = {
  menu: string;
  sides: string[];
};

export type DayPlan = {
  /** 요일 짧은 이름 (월~일) */
  weekday: string;
  /** ISO 날짜 (YYYY-MM-DD) */
  date: string;
  breakfast: Meal;
  dinner: Meal;
};

export const MEAL_SLOTS: {key: MealSlot; label: string}[] = [
  {key: 'breakfast', label: '아침'},
  {key: 'dinner', label: '저녁'},
];

/** 샘플 주간: 2026-11-09(월) ~ 2026-11-15(일) */
export const SAMPLE_WEEK: DayPlan[] = [
  {
    weekday: '월',
    date: '2026-11-09',
    breakfast: {menu: '소고기 애호박죽', sides: ['백김치', '바나나']},
    dinner: {menu: '닭고기 카레라이스', sides: ['브로콜리 무침', '사과']},
  },
  {
    weekday: '화',
    date: '2026-11-10',
    breakfast: {menu: '달걀 채소 스크램블', sides: ['모닝빵', '딸기']},
    dinner: {menu: '두부 된장국 · 잡곡밥', sides: ['시금치나물', '감자조림']},
  },
  {
    weekday: '수',
    date: '2026-11-11',
    breakfast: {menu: '고구마 오트밀', sides: ['요거트', '블루베리']},
    dinner: {menu: '소고기 무국 · 흰쌀밥', sides: ['애호박전', '김']},
  },
  {
    weekday: '목',
    date: '2026-11-12',
    breakfast: {menu: '치즈 감자 수프', sides: ['식빵 토스트', '배']},
    dinner: {menu: '연어 채소 주먹밥', sides: ['미역국', '오이 무침']},
  },
  {
    weekday: '금',
    date: '2026-11-13',
    breakfast: {menu: '단호박 닭죽', sides: ['깍두기(순한맛)', '귤']},
    dinner: {menu: '돼지고기 채소 볶음밥', sides: ['달걀국', '방울토마토']},
  },
  {
    weekday: '토',
    date: '2026-11-14',
    breakfast: {menu: '바나나 팬케이크', sides: ['우유', '귤']},
    dinner: {menu: '대구살 맑은탕 · 잡곡밥', sides: ['당근 볶음', '두부부침']},
  },
  {
    weekday: '일',
    date: '2026-11-15',
    breakfast: {menu: '참치 양배추 덮밥', sides: ['계란찜', '사과']},
    dinner: {menu: '소고기 버섯 리조또', sides: ['양배추 샐러드', '배']},
  },
];

export const SAMPLE_FRIDGE: string[] = [
  '소고기 다짐육',
  '닭가슴살',
  '두부',
  '달걀',
  '애호박',
  '당근',
  '브로콜리',
  '감자',
  '고구마',
  '양배추',
  '사과',
  '바나나',
];

export const SAMPLE_AVOID: string[] = ['땅콩', '새우', '키위'];

/** 빠른 추가용: 유아 식단에서 흔히 제외하는 재료 */
export const COMMON_AVOID: string[] = [
  '우유',
  '달걀',
  '땅콩',
  '견과류',
  '밀',
  '대두',
  '새우',
  '게',
  '고등어',
  '복숭아',
  '토마토',
  '키위',
];
