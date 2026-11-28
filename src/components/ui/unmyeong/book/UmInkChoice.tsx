import { Fragment, useId, type ChangeEventHandler, type ReactNode } from "react"
import { cx } from "../cx"

export type UmInkChoiceOption = {
  value: string
  /** 고를 글자(짧게: "남", "여", "양력", "음력") */
  label: ReactNode
  /** 글자 아래 작은 풀이(선택) */
  sub?: ReactNode
  disabled?: boolean
}

export type UmInkChoiceProps = {
  /** 작은 명조 라벨 — fieldset의 legend */
  legend: ReactNode
  name: string
  options: UmInkChoiceOption[]
  /** 제어형(onChange와 함께) */
  value?: string
  /** 비제어형 기본값 */
  defaultValue?: string
  onChange?: ChangeEventHandler<HTMLInputElement>
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  /** ring(기본) = 고른 글자 둘레에 주묵 붓 동그라미가 0.3초 그려짐 / dot = 글자 아래 먹점 */
  mark?: "ring" | "dot"
  className?: string
}

// 손으로 그린 동그라미 세 벌(시작점·겹침이 조금씩 다르다). 판 100×60, 늘려 써도 획 굵기는 그대로(non-scaling-stroke)
const RINGS = [
  "M22 9C44 1 84 3 95 23C104 41 79 57 49 57C19 57 2 46 5 28C8 15 26 7 46 6",
  "M70 5C90 8 101 22 96 37C90 53 63 58 40 56C15 54 1 42 4 26C7 11 30 2 58 3C66 3 72 5 77 7",
  "M30 6C52 0 88 5 96 26C102 43 82 56 52 57C24 58 3 48 3 31C3 16 20 8 41 5",
]
// 두 번째 옅은 획(붓이 마르며 갈라진 결)
const RINGS_DRY = [
  "M26 11C47 4 82 6 92 24C99 40 77 54 50 54",
  "M66 8C86 11 97 23 93 36C88 50 63 55 42 54",
  "M33 9C55 3 85 8 93 27C98 42 80 54 54 55",
]

/**
 * 하나 고르기(성별·양력/음력·시각 방식) — 상자 버튼 대신 글자를 나란히("남 · 여").
 * 실제 라디오(fieldset+legend)를 글자 위에 투명하게 겹친다 → 터치 52px · 화살표 키 · 화면낭독기 그대로. 훅은 useId뿐.
 */
export function UmInkChoice({ legend, name, options, value, defaultValue, onChange, required, hint, error, mark = "ring", className }: UmInkChoiceProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const hintId = hint ? `ub-c${uid}-hint` : undefined
  const errId = `ub-c${uid}-err`
  const describedBy = cx(hintId, error ? errId : null) || undefined
  return (
    <fieldset className={cx("ub-choice", error ? "ub-ink--error" : null, className)} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend className="ub-choice__legend">{legend}</legend>
      <div className="ub-choice__row">
        {options.map((o, i) => (
          <Fragment key={o.value}>
            {i > 0 && (
              <span className="ub-choice__sep" aria-hidden="true">
                ·
              </span>
            )}
            <label className="ub-choice__opt">
              <input
                className="ub-choice__input"
                type="radio"
                name={name}
                value={o.value}
                disabled={o.disabled}
                required={required}
                {...(value !== undefined ? { checked: value === o.value, onChange } : { defaultChecked: defaultValue === o.value, onChange })}
              />
              <span className="ub-choice__text">
                {o.label}
                {o.sub && <span className="ub-choice__sub">{o.sub}</span>}
              </span>
              {mark === "ring" ? (
                <svg className="ub-choice__ring" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <path d={RINGS[i % 3]} pathLength={1} />
                  <path d={RINGS_DRY[i % 3]} pathLength={1} />
                </svg>
              ) : (
                <span className="ub-choice__dot" aria-hidden="true" />
              )}
            </label>
          </Fragment>
        ))}
      </div>
      {hint && (
        <p className="ub-ink__hint ub-choice__hint" id={hintId}>
          {hint}
        </p>
      )}
      <p className="ub-ink__error ub-choice__hint" id={errId} aria-live="polite">
        {error}
      </p>
    </fieldset>
  )
}
