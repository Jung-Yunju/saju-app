import { mediaOf, type MediaKind } from "./media-utils"

/** 펼친 고서 탑뷰 정지 이미지(영상 마지막 프레임과 같은 구도). PC는 cover, 세로 화면은 contain(D-032) */
export function BookStill({ kind, className, onError, plain }: { kind: MediaKind; className?: string; onError?: () => void; plain?: boolean }) {
  const m = mediaOf(kind)
  const cls = `um-still ${plain ? "um-still--plain" : kind === "mobile" ? "um-still--contain" : ""} ${className ?? ""}`
  return (
    <picture>
      <source srcSet={m.stillWebp} type="image/webp" />
      <img src={m.stillJpg} alt="" className={cls} width={m.stillWidth} height={m.stillHeight} decoding="async" fetchPriority="high" onError={onError} />
    </picture>
  )
}

/** 세로 화면 contain 여백: 같은 이미지를 아주 흐리고 어둡게 깐 배경(서재 어둠과 어울리게) */
export function StillBackdrop({ kind }: { kind: MediaKind }) {
  if (kind !== "mobile") return null
  const m = mediaOf(kind)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={m.stillJpg} alt="" aria-hidden="true" className="um-backdrop" decoding="async" />
}
