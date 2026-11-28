"use client"

// 고서 읽는 연출 + 실제 진행 단계 문구. step: 0 요청 시작 · 1 응답 도착 · 2 화면 준비
export const LOADING_STEPS = [
  "네가 태어난 날의 하늘을 살펴보는 중이란다.",
  "네 안에 숨겨진 기운을 살펴보고 있구나.",
  "이제 네 이야기를 읽어 보자꾸나.",
]

export function LoadingBook({ step }: { step: number }) {
  return (
    <main className="um-loadwrap" role="status" aria-live="polite">
      <div className="um-loadbook" aria-hidden="true">
        <div className="um-loadbook-left" />
        <div className="um-loadbook-right">
          {[0, 1, 2, 3, 4].map(i => <span key={i} className="um-loadline" style={{ animationDelay: `${i * 0.35}s` }} />)}
        </div>
        <div className="um-flip" />
        <div className="um-flip um-flip-2" />
      </div>
      <ol className="um-steps">
        {LOADING_STEPS.map((s, i) => (
          <li key={s} className={i === step ? "is-now" : i < step ? "is-past" : ""} aria-current={i === step ? "step" : undefined}>{s}</li>
        ))}
      </ol>
    </main>
  )
}
