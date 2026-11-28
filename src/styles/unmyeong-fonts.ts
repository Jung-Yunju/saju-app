// 운명비서 글꼴 — next/font/google (빌드 때 내려받아 우리 서버에서 제공 → 방문자 브라우저는 Google에 요청하지 않는다)
// 쓰는 법: <div className={`um-root ${umFontVariables}`}> — CSS는 src/styles/unmyeong.css 의 --um-font-title / --um-font-body 가 이 변수를 받는다.
//
// 선택 이유(DESIGN_SYSTEM 8-2)
// - 제목: 나눔명조(Nanum Myeongjo) — 획 대비가 큰 붓 명조. 고서·옛 말투에 맞는다. 400(할머니 대사)·700(제목·버튼)·800(표지·도장)만.
// - 한자: Google의 나눔명조에는 한자가 없다(실측: 運命秘書·第一章 글리프 없음). 그래서 제목 글꼴 목록 두 번째에 Noto Serif KR을 두어
//   한자만 이 글꼴로 그린다. 브라우저는 화면에 나온 한자가 든 조각만 받는다(가변 글꼴 1벌 — 굵기 지정 없음).
// - 본문: Noto Sans KR — 긴 글 가독. 400(본문)·700(강조)만.
//
// preload: false 로 둔다.
// - 한국어 글꼴은 Google이 유니코드 범위로 100여 조각을 나눠 두고, next/font의 preload는 subsets(latin 등)만 미리 받는다.
//   화면 글자는 거의 한글이라 latin 조각을 미리 받아도 첫 그림이 빨라지지 않고 요청만 늘어난다.
// - 한글 조각은 화면에 실제로 쓰인 글자 범위만 브라우저가 받는다(unicode-range). display: "swap"으로 글꼴이 오기 전에도 글이 바로 보인다.
// - adjustFontFallback(기본 true)이 대체 글꼴 크기를 맞춰 글꼴 교체 때 흔들림을 줄인다.
import { Nanum_Myeongjo, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google"

export const umTitleFont = Nanum_Myeongjo({
  weight: ["400", "700", "800"],
  display: "swap",
  preload: false,
  variable: "--um-ff-title",
  // fallback을 주지 않는다: 이 변수 바로 뒤가 --um-ff-hanja(한자 담당)여야 한자가 시스템 글꼴로 새지 않는다(unmyeong.css --um-font-title)
})

export const umHanjaFont = Noto_Serif_KR({
  display: "swap",
  preload: false,
  variable: "--um-ff-hanja",
})

export const umBodyFont = Noto_Sans_KR({
  weight: ["400", "700"],
  display: "swap",
  preload: false,
  variable: "--um-ff-body",
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "system-ui", "sans-serif"],
})

/** .um-root 와 같은 요소(또는 조상)에 붙이는 클래스 — CSS 변수 세 개를 선언한다 */
export const umFontVariables = `${umTitleFont.variable} ${umHanjaFont.variable} ${umBodyFont.variable}`
