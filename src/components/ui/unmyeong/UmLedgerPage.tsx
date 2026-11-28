import { useId, type ReactNode } from "react"
import { cx } from "./cx"
import { UmStamp } from "./UmStamp"

export type UmLedgerPageProps = {
  /** 도장 위 붉은 한 줄(기본 "너의 운명을 바꿔 줄 1급 비밀") */
  kicker?: ReactNode
  /** 큰 한자 제목(기본 "運命秘書") — 화면낭독기는 ko를 읽는다 */
  hanja?: string
  /** 한글 제목(기본 "운명비서") */
  ko?: string
  /** 도장 글자(기본 "1급 비밀"). null이면 도장 없음 */
  stamp?: string | null
  /** 제목 아래 할머니 한마디 등(선택) */
  intro?: ReactNode
  /** 기록부 제목(기본 "오늘의 대상자") */
  recordTitle?: ReactNode
  /** 기록부 오른쪽 작은 표기(예: "기록 제 1128호") */
  recordMeta?: ReactNode
  /** 제목 단계 — 입력 화면에서는 h1(기본) */
  headingLevel?: 1 | 2
  /** 기록부 줄들: <UmField variant="ledger"> / <UmChoiceGroup variant="ledger"> */
  children: ReactNode
  /** 기록부 아래(봉인 버튼·고지) */
  footer?: ReactNode
  className?: string
}

/**
 * 펼친 고서 한 쪽 = 입력 화면. 인트로 영상 마지막 장면(할머니가 운명비서를 펼침)의 책장과 같은 모양이다(DESIGN_SYSTEM 8-6).
 * - 모바일(<900px): 오른쪽 장 한 쪽. 왼쪽 가장자리에 책 가운데 접힘 그림자 + 왼쪽 장 끝자락. 제목·도장이 위, 기록부가 아래.
 * - 900px 이상: 양쪽 장 — 왼쪽 제목 장(제목·도장·한마디), 오른쪽 기록부 장.
 * <form>은 넣지 않는다 — 폼 로직은 프론트엔드가 이 컴포넌트를 감싸거나 children 안에 둔다.
 * 제목 묶음은 화면 폭에 따라 한쪽만 보이도록 두 번 그리되, 안 보이는 쪽은 aria-hidden 이 아니라 CSS display:none 이라 화면낭독기도 한 번만 읽는다.
 */
export function UmLedgerPage({
  kicker = "너의 운명을 바꿔 줄 1급 비밀",
  hanja = "運命秘書",
  ko = "운명비서",
  stamp = "1급 비밀",
  intro,
  recordTitle = "오늘의 대상자",
  recordMeta,
  headingLevel = 1,
  children,
  footer,
  className,
}: UmLedgerPageProps) {
  const uid = useId()
  const recId = `um-l${uid}-rec`
  const H = `h${headingLevel}` as const
  const R = headingLevel === 1 ? "h2" : "h3"

  const mast = (where: "title" | "record") => (
    <div className="um-ledger__mast">
      <p className="um-ledger__kicker">{kicker}</p>
      <H className="um-ledger__title" id={`um-l${uid}-${where}`}>
        <span className="um-ledger__han" lang="ko-Hani" aria-hidden="true">
          {hanja}
        </span>
        <span className="um-ledger__ko">
          {ko}
          <span className="um-visually-hidden">({hanja})</span>
        </span>
      </H>
      {stamp && (
        <span className="um-ledger__stamp">
          <UmStamp size={where === "title" ? "lg" : "md"}>{stamp}</UmStamp>
        </span>
      )}
      {intro && <div className="um-ledger__intro">{intro}</div>}
    </div>
  )

  return (
    <section className={cx("um-ledger", className)} aria-labelledby={recId}>
      <div className="um-ledger__leaf um-ledger__leaf--title um-paper">{mast("title")}</div>
      <div className="um-ledger__leaf um-ledger__leaf--record um-paper">
        <div className="um-ledger__record-inner">
          {mast("record")}
          <div className="um-ledger__rec-head">
            <R className="um-ledger__rec-title" id={recId}>
              {recordTitle}
            </R>
            {recordMeta && <span className="um-ledger__rec-meta">{recordMeta}</span>}
          </div>
          <div className="um-ledger__rows">{children}</div>
          {footer && <div className="um-ledger__foot">{footer}</div>}
        </div>
      </div>
    </section>
  )
}
