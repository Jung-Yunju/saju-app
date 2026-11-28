"use client"
import { useEffect, useRef, useState } from "react"

/** 가려진 아래쪽이 이보다 적으면 표시하지 않는다 — 그만큼은 쪽 끝에 잘린 글(인장 글 등)이 그대로 보여 그 자체가 단서이고,
 *  표시를 얹으면 오히려 그 글을 덮는다 */
const REST_PX = 48

/**
 * 쪽 안이 넘칠 때만 쪽 아래 끝 흐림 + 오른쪽 여백에 세로로 「아래에 더 있다 ⌄」 표시(2026-11-28 품질검증 N1).
 * UmBook fit="lock" 쪽(스크롤 상자)의 마지막 자식으로 들어가 sticky 로 쪽 아래 끝에 붙는다 — 자리를 차지하지 않고(음수 margin),
 * 누르기를 가로채지 않으며(pointer-events: none), 화면낭독기에는 읽히지 않는다(차례대로 읽으면 다음 칸이 바로 나온다).
 * 쪽 안을 거의 끝까지 내리거나(가려진 높이 48px 이하) 넘치지 않으면 숨는다. 넘침은 쪽·내용 크기가 바뀔 때마다(한밤중 칸이 열림 등) 다시 잰다.
 */
export function UmPageMore({ label = "아래에 더 있다" }: { label?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const page = ref.current?.parentElement
    if (!page) return
    let raf = 0
    const check = () => {
      raf = 0
      // 쪽 아래·오른쪽 여백(% 값이라 CSS 의 bottom·right 에서는 다른 기준으로 풀린다)을 px 로 넘긴다 —
      // 표시를 종이 끝선까지 내리고, 글을 오른쪽 여백 안(글 단 밖)에 세운다
      const cs = getComputedStyle(page)
      ref.current?.style.setProperty("--ub-more-pb", `${parseFloat(cs.paddingBottom) || 0}px`)
      ref.current?.style.setProperty("--ub-more-pr", `${parseFloat(cs.paddingRight) || 0}px`)
      setOn(page.scrollHeight - page.clientHeight - page.scrollTop > REST_PX)
    }
    const req = () => { if (!raf) raf = requestAnimationFrame(check) }
    check()
    page.addEventListener("scroll", req, { passive: true })
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(req)
    ro?.observe(page)
    for (const c of Array.from(page.children)) if (c !== ref.current) ro?.observe(c)
    return () => {
      page.removeEventListener("scroll", req)
      ro?.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <div ref={ref} className="ub-book__more" data-on={on ? "" : undefined} aria-hidden="true">
      <span className="ub-book__more-label">
        {label}
        <svg className="ub-book__more-mark" viewBox="0 0 16 10" focusable="false">
          <path d="M1.5 1.8C4.2 4.6 6.2 6.9 8 8.4C9.9 6.8 12 4.5 14.6 1.6" />
        </svg>
      </span>
    </div>
  )
}
