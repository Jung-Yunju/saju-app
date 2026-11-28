import type { CSSProperties, ReactNode } from "react"
import { cx } from "../cx"

export type UmStudyBackdropProps = {
  /** 배경 그림 밝기(0~1). 기본 0.35. 값을 바꾸면 0.8초에 걸쳐 바뀐다 */
  dim?: number
  /** 흐림(px). 기본 2.5 */
  blur?: number
  /**
   * true면 처음 그려질 때 "영상 마지막 프레임(밝기 1·흐림 0)" 상태에서 dim·blur 상태로 0.8초 어두워진다.
   * 인트로 영상이 끝나는 순간 영상 대신 이 배경을 깔 때 쓴다(같은 그림·같은 cover 맞춤이라 이음새 없음).
   */
  enter?: boolean
  /** 배경 그림 고르기. auto(기본) = 세로 화면은 9:16 그림, 가로 화면은 16:9 그림(영상과 같은 규칙) */
  image?: "auto" | "pc" | "mobile"
  className?: string
  children?: ReactNode
}

/**
 * 어두운 서재 — 대표 납품 정지 이미지를 cover로 깔고 어둡게·약간 흐리게, 가장자리 비네팅, 왼쪽 위 등불 빛 번짐.
 * 배경 세 겹은 position: fixed(스크롤해도 서재는 그대로, 책만 움직인다). 자식은 그 위에 그대로 흐른다.
 * 서버·클라이언트 어디서나(훅 없음).
 */
export function UmStudyBackdrop({ dim = 0.35, blur = 2.5, enter, image = "auto", className, children }: UmStudyBackdropProps) {
  const style = { "--ub-dim": String(dim), "--ub-blur": `${blur}px` } as CSSProperties
  return (
    <div className={cx("ub-backdrop", enter && "ub-backdrop--enter", className)} style={style}>
      <div className="ub-backdrop__img" data-image={image === "auto" ? undefined : image} aria-hidden="true" />
      <div className="ub-backdrop__veil" aria-hidden="true" />
      <div className="ub-backdrop__lamp" aria-hidden="true" />
      <div className="ub-backdrop__content">{children}</div>
    </div>
  )
}
