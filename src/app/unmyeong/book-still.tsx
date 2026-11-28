import { mediaOf, type MediaKind } from "./media-utils"

/** 펼친 고서 탑뷰 정지 이미지(영상 마지막 프레임과 같은 구도). object-fit: cover */
export function BookStill({ kind, className, onError }: { kind: MediaKind; className?: string; onError?: () => void }) {
  const m = mediaOf(kind)
  return (
    <picture>
      <source srcSet={m.stillWebp} type="image/webp" />
      <img src={m.stillJpg} alt="" className={`um-still ${className ?? ""}`} width={m.stillWidth} height={m.stillHeight} decoding="async" fetchPriority="high" onError={onError} />
    </picture>
  )
}
