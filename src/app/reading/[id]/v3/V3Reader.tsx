"use client"

// v3 풀이 쪽 넘김 리더 — 장 하나가 한 쪽. 모바일 우선(390 폭 기준), 디자인 토큰은 design/tokens.css(시안 B).
import { Fragment, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { StoredReadingV3 } from "@/lib/generate-reading-v3"
import { LAST_WORDS, RELIABILITY_NOTICE, crisisMessage } from "@/engine/content/prompts/persona"
import { planOf, type ChapterView, type ChipView } from "./model"

export type V3ReaderProps = {
  stored: StoredReadingV3
  userName: string
  readingName: string
  birthInfo: string
  createdAt: string
  /** 있으면 일부 장만 완성된 풀이에서 "나머지 장 이어서 만들기" 버튼을 보인다 */
  readingId?: string
  /** 처음 보일 쪽: "toc"(목차) 또는 장 번호(0부터). 테스트·스크린샷용, 기본은 목차 */
  initialPage?: "toc" | number
}

/** <b>…</b>만 굵게. 그 밖의 글자는 React가 이스케이프한다(HTML을 직접 넣지 않는다) */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(<b>[\s\S]*?<\/b>)/g)
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^<b>([\s\S]*?)<\/b>$/)
        return m ? <b key={i}>{m[1]}</b> : <Fragment key={i}>{p.replace(/<\/?b>/g, "")}</Fragment>
      })}
    </>
  )
}

function Chip({ chip, open, onToggle, id }: { chip: ChipView; open: boolean; onToggle: () => void; id: string }) {
  return (
    <li className="v3-chip" data-open={open || undefined}>
      <button type="button" className="v3-chip-btn" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className="v3-chip-easy">{chip.easy}</span>
        <span className="v3-chip-more" aria-hidden="true">{open ? "접기" : "글자 보기"}</span>
      </button>
      {open && (
        <div id={id} className="v3-chip-detail">
          {chip.letter && <span className="v3-hanja v3-chip-letter">{chip.letter}</span>}
          {chip.label && <span className="v3-chip-label">{chip.label}</span>}
          {chip.pos && <span className="v3-chip-code">{chip.pos}</span>}
        </div>
      )}
    </li>
  )
}

function ChapterPage({ ch }: { ch: ChapterView }) {
  const [openChips, setOpenChips] = useState<Set<number>>(() => new Set())
  const toggle = (i: number) =>
    setOpenChips((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <article className="v3-chapter" aria-labelledby={`v3-h-${ch.id}`}>
      <header>
        <h2 id={`v3-h-${ch.id}`} className="v3-title">{ch.title}</h2>
        {ch.sub && <p className="v3-sub">{ch.sub}</p>}
      </header>

      {ch.chips.length > 0 && (
        <section aria-label="이 장을 읽은 근거 자리">
          <p className="v3-label">이 이야기를 읽은 자리</p>
          <ul className="v3-chips">
            {ch.chips.map((c, i) => (
              <Chip key={i} chip={c} open={openChips.has(i)} onToggle={() => toggle(i)} id={`v3-chip-${ch.id}-${i}`} />
            ))}
          </ul>
        </section>
      )}

      <div className="v3-body">
        {ch.body.map((p, i) => (
          <p key={i}><Rich text={p} /></p>
        ))}
      </div>

      {ch.extras.map((ex, i) => (
        <section key={i} className="v3-extra" aria-label={ex.heading}>
          <h3 className="v3-h3">{ex.heading}</h3>
          <ul className="v3-cards">
            {ex.items.map((it, j) => (
              <li key={j} className="v3-card">
                {it.name && <p className="v3-card-name">{it.name}</p>}
                {it.text && <p><Rich text={it.text} /></p>}
                {it.rows && it.rows.length > 0 && (
                  <dl className="v3-rows">
                    {it.rows.map((r, k) => (
                      <div key={k}>
                        <dt>{r.label}</dt>
                        <dd><Rich text={r.text} /></dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {ch.todo && (
        <aside className="v3-todo" aria-label="바꿔 볼 것">
          <p className="v3-todo-label">바꿔 볼 것</p>
          <p className="v3-todo-text"><Rich text={ch.todo} /></p>
        </aside>
      )}
      {ch.ask && (
        <p className="v3-ask"><span className="v3-label">너에게 묻는다</span><Rich text={ch.ask} /></p>
      )}
      {ch.caveat && <p className="v3-caveat">{ch.caveat}</p>}
    </article>
  )
}

export default function V3Reader({ stored, userName, readingName, birthInfo, createdAt, readingId, initialPage = "toc" }: V3ReaderProps) {
  const plan = planOf(stored)
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const resume = async () => {
    if (!readingId || retrying) return
    setRetrying(true)
    try {
      await fetch(`/api/reading/${readingId}/generate`, { method: "POST" })
    } catch {
      // 실패해도 화면은 그대로 둔다 — 다시 누를 수 있다
    } finally {
      setRetrying(false)
      router.refresh()
    }
  }
  const [page, setPage] = useState<"toc" | number>(initialPage)
  const goTo = (p: "toc" | number) => {
    setPage(p)
    if (typeof window !== "undefined") window.scrollTo({ top: 0 })
  }

  // 위기: 저장된 상담 안내만. 풀이 내용·근거·진행 막대 없음
  if (plan.mode === "crisis") {
    return (
      <div className="v3-root" data-brand="b" data-theme="light">
        <main className="v3-wrap v3-crisis" role="main">
          <h1 className="v3-title">잠깐 쉬어 가요</h1>
          <p className="v3-crisis-msg">{stored.crisis?.message?.trim() || crisisMessage("halmi", "")}</p>
          <Link href="/" className="v3-btn v3-btn-ghost">처음으로</Link>
        </main>
      </div>
    )
  }

  const count = plan.pages.length
  const current = typeof page === "number" && page >= 0 && page < count ? page : null
  const pct = current === null ? 0 : Math.round(((current + 1) / count) * 100)
  const isLast = current !== null && current === count - 1
  const lastWords = LAST_WORDS.halmi

  return (
    <div className="v3-root" data-brand="b" data-theme="light">
      <main className="v3-wrap" role="main">
        <nav className="v3-top" aria-label="풀이 이동">
          <Link href="/" className="v3-top-link">홈</Link>
          <button type="button" className="v3-top-link" onClick={() => goTo("toc")} aria-current={current === null ? "page" : undefined}>
            목차
          </button>
        </nav>

        {current !== null && (
          <div className="v3-progress" role="progressbar" aria-valuemin={1} aria-valuemax={count} aria-valuenow={current + 1} aria-label="읽은 장">
            <div className="v3-progress-bar"><span style={{ width: `${pct}%` }} /></div>
            <p className="v3-progress-text">{current + 1}/{count}</p>
          </div>
        )}

        {current === null ? (
          <section className="v3-toc" aria-labelledby="v3-toc-h">
            <p className="v3-label">{readingName}</p>
            <h1 id="v3-toc-h" className="v3-title">{userName}님의 사주 풀이</h1>
            <p className="v3-meta">{birthInfo}<br />{createdAt}</p>
            <p className="v3-notice">{RELIABILITY_NOTICE.halmi}</p>

            {plan.mode === "partial" && (
              <p className="v3-partial" role="status">
                나머지 장을 만드는 중이에요. 지금은 완성된 {count}장을 먼저 보여 드려요
                {plan.total > count ? ` (전체 ${plan.total}장 중)` : ""}.
                {readingId && (
                  <button type="button" className="v3-btn v3-btn-ghost v3-resume" onClick={resume} disabled={retrying}>
                    {retrying ? "이어서 만드는 중…" : "나머지 장 이어서 만들기"}
                  </button>
                )}
              </p>
            )}

            {count > 0 && (
              <ol className="v3-toc-list">
                {plan.pages.map((c, i) => (
                  <li key={c.id}>
                    <button type="button" className="v3-toc-item" onClick={() => goTo(i)}>
                      <span className="v3-toc-no">{i + 1}</span>
                      <span className="v3-toc-name">{c.title}</span>
                    </button>
                  </li>
                ))}
                {plan.pendingTitles.map((t) => (
                  <li key={t}>
                    <span className="v3-toc-item v3-toc-wait" aria-disabled="true">
                      <span className="v3-toc-no">…</span>
                      <span className="v3-toc-name">{t}</span>
                      <span className="v3-toc-tag">만드는 중</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {count > 0 && (
              <button type="button" className="v3-btn v3-btn-main" onClick={() => goTo(0)}>첫 장부터 읽기</button>
            )}
          </section>
        ) : (
          <>
            <ChapterPage key={plan.pages[current].id} ch={plan.pages[current]} />
            {isLast && plan.mode === "complete" && <p className="v3-last-words">{lastWords}</p>}
            {isLast && plan.mode === "partial" && (
              <p className="v3-partial" role="status">나머지 장을 만드는 중이에요. 완성되면 이어서 읽을 수 있어요.</p>
            )}
          </>
        )}
      </main>

      {current !== null && (
        <div className="v3-pager">
          <div className="v3-wrap v3-pager-in">
            <button type="button" className="v3-btn v3-btn-ghost" onClick={() => goTo(current === 0 ? "toc" : current - 1)}>
              {current === 0 ? "목차" : "이전"}
            </button>
            <button type="button" className="v3-btn v3-btn-main" onClick={() => goTo(isLast ? "toc" : current + 1)}>
              {isLast ? "목차로" : "다음"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
