// 「운명비서」 그래픽 자산 목록(manifest) — D-027 작업 8. 계약: docs/redesign/20-unmyeong-plan.md §2 "자산 관리"
// 화면(클라이언트)·서버 어디서나 읽는 순수 데이터다(fs·DB 없음). 파일 존재 검사는 assets-check.ts(서버·테스트 전용).
//
// 교체 방법(GPT 그래픽 담당 납품 시):
//   1. 파일을 public/unmyeong/final/ 아래에 올린다.
//   2. 아래 목록에서 그 줄의 "placeholder/…-placeholder.svg"를 "final/…"로 한 줄만 바꾼다.
//      isPlaceholder는 경로에서 자동으로 정해진다(placeholder/ 아래면 true).
//   3. 인트로 영상은 intro.video를 null에서 { mp4, webm?, poster, durationSec, vertical? }로 바꾼다.
//      null이면 화면은 intro.fallback("scene" = CSS/SVG 대체 장면)을 쓴다. 영상 재생이 실패해도 같은 대체 장면으로 간다.
// 깨짐 방지: 모든 그림 자산에 fallback(데이터 URI 그림 — 네트워크·파일 없이 항상 그려짐)이 있다.
//   화면은 <img onError>에서 src를 fallback으로 바꾸면 된다(파일이 아직 없거나 경로가 틀려도 빈 칸·깨진 아이콘이 안 나온다).

/** 자산 파일을 두는 공개 경로의 뿌리(public/unmyeong → URL /unmyeong) */
export const ASSET_BASE = "/unmyeong/"

/** 파일이 없을 때 대신 그리는 그림 — 서재 바탕색(--um-study #211C17) 사각형 + 황동(--um-line) 테두리. 외부 요청 없음 */
export const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5" preserveAspectRatio="none">' +
      '<rect width="4" height="5" fill="#211C17"/><rect x="0.1" y="0.1" width="3.8" height="4.8" fill="none" stroke="#504335" stroke-width="0.05"/></svg>',
  )

export interface ImageAsset {
  /** 공개 URL(예: "/unmyeong/placeholder/study-placeholder.svg") */
  src: string
  /** src를 못 불러올 때 쓸 그림(항상 그려지는 데이터 URI) */
  fallback: string
  /** 대체 글(화면 낭독기용). 장식 그림(종이 질감)만 빈 문자열 */
  alt: string
  /** true = 임시 그림(최종으로 보지 않는다). 경로가 placeholder/ 아래면 true */
  isPlaceholder: boolean
}

/** 인트로 영상 한 벌(가로 16:9 또는 세로 9:16) */
export interface VideoSource {
  /** MP4(H.264) 공개 URL */
  mp4: string
  /** WebM 공개 URL(있으면 먼저 시도) */
  webm?: string
  /** 첫 장면 정지 그림 공개 URL(영상 불러오는 동안·실패 시) */
  poster: string
}

export interface IntroVideo extends VideoSource {
  /** 영상 길이(초). 건너뛰기·진행 표시용 */
  durationSec: number
  /** 세로(9:16) 판. 없으면 가로 판을 그대로 쓴다 */
  vertical?: VideoSource
  isPlaceholder: boolean
}

export interface ArchetypeAssets {
  /** 사람 모습(신성한 인간·현자 등) */
  human: ImageAsset
  /** 영물·신수 모습(거울·물에 비친 그림) */
  beast: ImageAsset
  /** 두 그림을 하나로 설명하는 대체 글 */
  alt: string
}

export interface UnmyeongAssets {
  intro: {
    /** 납품 전에는 null → fallback 장면 */
    video: IntroVideo | null
    /** 영상이 없거나 실패할 때: CSS/SVG 대체 장면(src/app/unmyeong/** 가 그린다) */
    fallback: "scene"
  }
  grandma: ImageAsset
  /** 복자(실제 고양이) 자세별 그림 */
  bokja: { sleep: ImageAsset; loaf: ImageAsset }
  /** 깊은 밤의 비밀 서재 배경 */
  study: ImageAsset
  /** 운명비서 고서 표지 */
  bookCover: ImageAsset
  /** 종이 질감(배경 반복 무늬) */
  paperTexture: ImageAsset
  /** 원형 id(archetype 엔진의 ArchetypeId) → 그림 */
  archetypes: Record<string, ArchetypeAssets>
  /** 장 id → 삽화. 무료 5장 키(FREE_CHAPTER_KEYS)와 유료 권 키("volume-1"…)를 쓴다 */
  illustrations: Record<string, ImageAsset>
}

const isPlaceholderPath = (rel: string): boolean => rel.startsWith("placeholder/")

/** "placeholder/study-placeholder.svg" 또는 "final/study.webp" → 그림 자산 한 줄 */
export function img(rel: string, alt: string): ImageAsset {
  return { src: ASSET_BASE + rel, fallback: FALLBACK_IMAGE, alt, isPlaceholder: isPlaceholderPath(rel) }
}

/** 원형 12안(docs/redesign/02-archetypes.md §4·§7 ArchetypeId) — 그림 납품 전에는 모두 같은 임시 그림 */
export const ARCHETYPE_IDS = [
  "galaxy", "hyeonmu", "golden-sun", "moon-goddess", "bonghwang", "baekho",
  "black-fox", "white-deer", "sage", "cheongnyong", "silver-wolf", "eternal-forest",
] as const

const ARCHETYPE_NAME_KO: Record<(typeof ARCHETYPE_IDS)[number], string> = {
  galaxy: "은하",
  hyeonmu: "현무",
  "golden-sun": "황금빛 태양",
  "moon-goddess": "달의 여신",
  bonghwang: "봉황",
  baekho: "백호",
  "black-fox": "흑여우",
  "white-deer": "백록",
  sage: "지혜의 현자",
  cheongnyong: "청룡",
  "silver-wolf": "은빛 늑대",
  "eternal-forest": "불멸의 숲",
}

const archetype = (id: (typeof ARCHETYPE_IDS)[number]): ArchetypeAssets => {
  const name = ARCHETYPE_NAME_KO[id]
  return {
    // 납품 시 예: img("final/archetype/galaxy-human.webp", …)
    human: img("placeholder/reflection-placeholder.svg", `${name}의 사람 모습(임시 그림)`),
    beast: img("placeholder/reflection-placeholder.svg", `물에 비친 ${name}(임시 그림)`),
    alt: `거울에 비친 네 안의 ${name}`,
  }
}

/** 무료 결과 5장의 키(순서 = 장 번호). /api/unmyeong/free 응답 chapters[].key와 같다 */
export const FREE_CHAPTER_KEYS = ["being", "gift", "reason", "chart", "unfolding"] as const
export type FreeChapterKey = (typeof FREE_CHAPTER_KEYS)[number]

export const UNMYEONG_ASSETS: UnmyeongAssets = {
  intro: {
    // 납품 예: { mp4: "/unmyeong/final/intro-16x9.mp4", webm: "/unmyeong/final/intro-16x9.webm", poster: "/unmyeong/final/intro-poster.webp",
    //          durationSec: 18, vertical: { mp4: "/unmyeong/final/intro-9x16.mp4", poster: "/unmyeong/final/intro-poster-9x16.webp" }, isPlaceholder: false }
    video: null,
    fallback: "scene",
  },
  grandma: img("placeholder/grandma-placeholder.svg", "등불 아래 고서를 펼친 할머니(임시 그림)"),
  bokja: {
    sleep: img("placeholder/bokja-sleep-placeholder.svg", "책상 위에서 잠든 고양이 복자(임시 그림)"),
    loaf: img("placeholder/bokja-loaf-placeholder.svg", "앞발을 접고 앉은 고양이 복자(임시 그림)"),
  },
  study: img("placeholder/study-placeholder.svg", "깊은 밤의 비밀 서재(임시 그림)"),
  bookCover: img("placeholder/book-cover-placeholder.svg", "운명비서 고서 표지(임시 그림)"),
  paperTexture: img("placeholder/paper-placeholder.svg", ""),
  archetypes: Object.fromEntries(ARCHETYPE_IDS.map((id) => [id, archetype(id)])),
  illustrations: {
    being: img("placeholder/reflection-placeholder.svg", "물에 비친 네 안의 존재(임시 그림)"),
    gift: img("placeholder/study-placeholder.svg", "서재 책상 위에 놓인 것들(임시 그림)"),
    reason: img("placeholder/grandma-placeholder.svg", "이야기를 들려주는 할머니(임시 그림)"),
    chart: img("placeholder/book-cover-placeholder.svg", "할미가 읽어 낸 고서(임시 그림)"),
    unfolding: img("placeholder/bokja-loaf-placeholder.svg", "다음 장을 기다리는 복자(임시 그림)"),
    "volume-1": img("placeholder/book-cover-placeholder.svg", "제1권 표지(임시 그림)"),
    "volume-2": img("placeholder/book-cover-placeholder.svg", "제2권 표지(임시 그림)"),
    "volume-3": img("placeholder/book-cover-placeholder.svg", "제3권 표지(임시 그림)"),
    "volume-4": img("placeholder/book-cover-placeholder.svg", "제4권 표지(임시 그림)"),
    "volume-5": img("placeholder/book-cover-placeholder.svg", "제5권 표지(임시 그림)"),
  },
}

/** 원형 그림. 모르는 id(엔진 원형이 늘었는데 그림이 아직 없을 때)도 깨지지 않게 임시 그림을 준다 */
export function archetypeAssets(id: string | null | undefined): ArchetypeAssets {
  const hit = id ? UNMYEONG_ASSETS.archetypes[id] : undefined
  return (
    hit ?? {
      human: img("placeholder/reflection-placeholder.svg", "네 안의 존재(임시 그림)"),
      beast: img("placeholder/reflection-placeholder.svg", "물에 비친 네 안의 존재(임시 그림)"),
      alt: "거울에 비친 네 안의 존재",
    }
  )
}

/** 장 삽화. 없으면 서재 그림 */
export function illustrationFor(chapterKey: string): ImageAsset {
  return UNMYEONG_ASSETS.illustrations[chapterKey] ?? UNMYEONG_ASSETS.study
}

/** 목록의 그림 자산 전부(검사·미리 불러오기용). key는 "bokja.sleep", "archetypes.galaxy.human" 같은 점 경로 */
export function listImageAssets(m: UnmyeongAssets = UNMYEONG_ASSETS): { key: string; asset: ImageAsset }[] {
  const out: { key: string; asset: ImageAsset }[] = []
  const walk = (v: unknown, key: string) => {
    if (!v || typeof v !== "object") return
    const o = v as Record<string, unknown>
    if (typeof o.src === "string" && typeof o.fallback === "string" && typeof o.isPlaceholder === "boolean") {
      out.push({ key, asset: o as unknown as ImageAsset })
      return
    }
    for (const [k, child] of Object.entries(o)) walk(child, key ? `${key}.${k}` : k)
  }
  walk({ grandma: m.grandma, bokja: m.bokja, study: m.study, bookCover: m.bookCover, paperTexture: m.paperTexture, archetypes: m.archetypes, illustrations: m.illustrations }, "")
  return out
}

/** 영상 파일 URL 전부(영상이 null이면 빈 배열) */
export function listVideoFiles(m: UnmyeongAssets = UNMYEONG_ASSETS): { key: string; src: string }[] {
  const v = m.intro.video
  if (!v) return []
  const out = [
    { key: "intro.video.mp4", src: v.mp4 },
    { key: "intro.video.poster", src: v.poster },
    ...(v.webm ? [{ key: "intro.video.webm", src: v.webm }] : []),
  ]
  if (v.vertical) {
    out.push({ key: "intro.video.vertical.mp4", src: v.vertical.mp4 }, { key: "intro.video.vertical.poster", src: v.vertical.poster })
    if (v.vertical.webm) out.push({ key: "intro.video.vertical.webm", src: v.vertical.webm })
  }
  return out
}

/** 임시 그림이 하나라도 남았는가(출시 전 점검용) */
export function hasPlaceholders(m: UnmyeongAssets = UNMYEONG_ASSETS): boolean {
  return listImageAssets(m).some((a) => a.asset.isPlaceholder) || m.intro.video === null || m.intro.video.isPlaceholder
}
