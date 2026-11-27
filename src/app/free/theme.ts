// 무료 화면 전용 테마 스위치. 브랜드(시안 A/B)가 미결정이라 /free 안에서만 적용한다.
// 시안 A로 바꾸려면: ① BRAND를 "a"로 ② fonts.ts의 A 글꼴 주석을 켠다 ③ (A는 첫 화면·공유 카드가 어두운 테마) THEME_DEFAULT를 필요에 따라 "dark"로.
// 색·글꼴·둥글기는 모두 design/tokens.css의 변수만 쓰므로 이 외의 코드는 건드리지 않는다.
export const BRAND: "a" | "b" = "b"
export const THEME_DEFAULT: "light" | "dark" = "light"

export const SITE_NAME = "할머니가 풀어 주는 사주"
export const FREE_TITLE = "무료 사주 한 장 — 생년월일만 넣으면 바로"
export const FREE_DESCRIPTION =
  "가입·결제 없이 생년월일만 넣으면 태어난 해·달·날·시의 여덟 글자와 다섯 가지 기운, 열 해마다 바뀌는 큰 흐름을 바로 보여 드려요. 계산은 옛 달력(만세력)으로 정확히 하고, 풀이 문장은 할미가 한 줄씩 붙여 줍니다. 재미와 참고용입니다."
