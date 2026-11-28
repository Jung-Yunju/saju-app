"use client"

// 무료 결과 = 운명비서 한 권. 서버 응답(UnmyeongFreeResponse)을 그대로 보여 준다 — 화면에서 사주를 계산하지 않는다.
import Link from "next/link"
import { useState } from "react"
import { UmBook, UmBookPage, UmStudyBackdrop, UmWaxSeal } from "@/components/ui/unmyeong/book"
import { umButtonClass } from "@/components/ui/unmyeong"
import { archetypeAssets, type ImageAsset } from "@/lib/unmyeong/assets"
import type { UnmyeongFreeChapter, UnmyeongFreeResponse } from "@/lib/unmyeong/free-types"
import { visibleVolumes, type UnmyeongVolume } from "@/lib/unmyeong/volumes"

const TITLES = ["너는 누구인가", "너의 신성과 영물", "하늘이 네게 준 것", "네가 넘어야 할 것", "지금 네게 필요한 말"]
const PILLAR_KO = { year: "연주(年柱)", month: "월주(月柱)", day: "일주(日柱)", hour: "시주(時柱)" } as const

/** {name} 토큰 치환. 이름이 없으면 토큰과 바로 붙은 호격·조사까지 자연스럽게 뺀다 */
export function fillName(text: string, name: string): string {
  if (name) return text.replace(/\{name\}/g, name)
  return text.replace(/\{name\}(아|야|님|은|는|이|가|의)?[,，]?\s*/g, "")
}

function Pic({ a, className }: { a: ImageAsset; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={a.src} alt={a.alt} className={className} onError={e => { const t = e.currentTarget; if (t.src !== a.fallback) t.src = a.fallback }} />
}

function Pending() {
  return <p className="umr-pending">이 장은 아직 먹을 갈고 있단다. 글이 다 적히면 여기 펼쳐질 것이다.</p>
}

function Body({ text }: { text: string }) {
  return <>{text.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}</>
}

function Wongook({ data }: { data: UnmyeongFreeResponse }) {
  const cur = data.daeun.items[data.daeun.currentIndex]
  const order = ["hour", "day", "month", "year"] as const
  const items = data.basis.elements.items
  return (
    <>
      <div className="umr-pillars" role="list">
        {order.map(k => {
          const p = data.pillars.find(x => x.key === k)
          return p ? (
            <div key={k} role="listitem" className={p.me ? "is-me" : ""}>
              <span className="umr-p-label">{PILLAR_KO[k]}</span>
              <span className="umr-wg-tag">{p.me ? "나(일간)" : "\u00a0"}</span>
              <span className="umr-gz">
                <span className="umr-wg-cell"><b data-el={p.element} lang="zh">{p.stemHanja}</b><i>{p.stemKo}</i></span>
                <span className="umr-wg-cell"><b data-el={p.branchEl} lang="zh">{p.branchHanja}</b><i>{p.branchKo}</i></span>
              </span>
            </div>
          ) : (
            <div key={k} role="listitem" className="is-unknown">
              <span className="umr-p-label">{PILLAR_KO[k]}</span>
              <span className="umr-wg-tag">{"\u00a0"}</span>
              <span className="umr-gz umr-wg-unknown">모름</span>
            </div>
          )
        })}
      </div>
      {data.hourUnknown && <p className="umr-wg-note">태어난 시각을 몰라 시주는 비워 두었단다.</p>}
      <p className="umr-wg-line">나를 나타내는 글자(일간)는 <b lang="zh">{data.dayMaster.hanja}</b>({data.dayMaster.ko}), {data.dayMaster.element}의 기운이란다.</p>

      <h3>오행 다섯 기운</h3>
      <div className="umr-els-bar" role="img" aria-label={items.map(e => `${e.ko} ${Math.round(e.share * 100)}%`).join(", ")}>
        {items.filter(e => e.share > 0).map(e => <i key={e.el} data-el={e.el} style={{ flexGrow: e.share }} />)}
      </div>
      <ul className="umr-els-legend" aria-hidden="true">
        {items.map(e => <li key={e.el} data-el={e.el}><b>{e.ko}</b><span lang="zh">{e.hanja}</span> {Math.round(e.share * 100)}%</li>)}
      </ul>

      <p className="umr-wg-line">
        {cur ? <>지금은 <b lang="zh">{cur.hanja}</b>({cur.ko}) 대운, </> : null}
        올해({data.thisYear.year}년)는 <b lang="zh">{data.thisYear.ganzhi.hanja}</b>({data.thisYear.ganzhi.ko})년이란다.
      </p>
    </>
  )
}

function Basis({ data }: { data: UnmyeongFreeResponse }) {
  const b = data.basis
  return (
    <div className="umr-basis">
      <h3>십성 — 글자들이 맺은 관계</h3>
      <ul className="umr-list">
        {b.tenGods.groups.map(g => (
          <li key={g.group}><b>{g.ko}</b> <span lang="zh">({g.hanja})</span> {Math.round(g.share * 100)}% — {g.plain}</li>
        ))}
      </ul>

      <h3>신강·신약 — 내 힘의 세기</h3>
      <p><b>{b.strength.verdict}</b> — {b.strength.label.plain}</p>
      {b.strength.sensitive && <p className="um-note">보는 방식에 따라 판정이 달라질 수 있는 사주란다. 세 가지 방식의 판정: {b.strength.models.map(m => `${m.name} ${m.verdict}`).join(" · ")}</p>}

      <h3>격국 — 사주의 틀</h3>
      {b.structure
        ? <p><b>{b.structure.label.ko}</b> <span lang="zh">({b.structure.label.hanja})</span> — {b.structure.label.plain}{b.structure.sensitive ? " (경계에 가까워 다르게 읽힐 수 있다)" : ""}</p>
        : <p>뚜렷한 틀 하나로 정하기 어려운 사주란다.</p>}

      <h3>용신 — 도움이 되는 기운(관점별)</h3>
      <ul className="umr-list">
        {b.usefulGods.map(u => (
          <li key={u.method} data-el={u.element.el}><b>{u.header}</b>: <span className="umr-eltxt">{u.element.ko} <span lang="zh">{u.element.hanja}</span></span> — {u.element.plain}</li>
        ))}
      </ul>
      <p className="umr-fine">관점마다 답이 다를 수 있어 하나로 합치지 않고 나란히 놓았다.</p>
      {b.caveats.map(c => <p key={c} className="umr-fine">{c}</p>)}
      {data.warnings.map(w => <p key={w} className="umr-fine">{w}</p>)}
    </div>
  )
}


function Shelf() {
  const vols = visibleVolumes()
  const [sel, setSel] = useState(0)
  if (!vols.length) return null
  const v: UnmyeongVolume = vols[Math.min(sel, vols.length - 1)]
  return (
    <section className="umb-shelf ub-dark" aria-labelledby="umb-shelf-h">
      <h2 id="umb-shelf-h">아직 펼쳐지지 않은 장</h2>
      <p className="umb-shelf-lead">네 운명비서에는 이어지는 다섯 권이 있단다. 읽고 싶은 때에 펼쳐 보렴.</p>
      <ol className="umb-spines" aria-label="이어지는 책">
        {vols.map((x, i) => (
          <li key={x.key}>
            <button type="button" className="umb-spine" data-i={i % 5} aria-pressed={i === sel} onClick={() => setSel(i)}>
              <span className="umb-spine__no">{x.no}</span>
              <span className="umb-spine__title">{x.title}</span>
              <span className="umb-visually-hidden">제{x.no}권 {x.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="umb-plank" aria-hidden="true" />
      <div className="umb-shelf-card" aria-live="polite">
        <span className="umb-shelf-card__no">제{v.no}권</span>
        <b className="umb-shelf-card__title">{v.title}</b>
        <span className="umb-shelf-card__sub">{v.subtitle}</span>
        <span className="umb-shelf-card__intro">{v.intro}</span>
      </div>
      <p className="umb-shelf-cta"><Link className={umButtonClass("brass")} href="/input">운명비서 전권 보기</Link></p>
    </section>
  )
}

function Chapter({ c, no, name, folio, children }: { c?: UnmyeongFreeChapter; no: number; name: string; folio: string; children?: React.ReactNode }) {
  const title = c?.title || TITLES[no - 1]
  if (no === 1) {
    const text = c ? fillName(c.text, name) : ""
    const m = text.match(/^(.+?[.!?。])\s+([\s\S]*)$/)
    return (
      <UmBookPage no={1} title={`${name ? name + ", " : ""}${title}`} folio={folio} id="umb-ch-1">
        {c ? (m ? <><p className="umb-essence">{m[1]}</p><Body text={m[2]} /></> : <p className="umb-essence">{text}</p>) : <Pending />}
      </UmBookPage>
    )
  }
  return (
    <UmBookPage no={no} title={title} folio={folio} id={`umb-ch-${no}`}>
      {children}
      {c ? <Body text={fillName(c.text, name)} /> : <Pending />}
    </UmBookPage>
  )
}

export function ResultBook({ data, name, onRetry }: { data: UnmyeongFreeResponse; name: string; onRetry: () => void }) {
  const ch = (n: number) => data.chapters?.find(c => c.no === n)
  const a = data.archetype
  const art = a ? archetypeAssets(a.id) : null
  const water = (
    <>
      <figure className="umb-water">
        {art && a ? (
          <>
            <Pic a={art.human} className="umb-water-top" />
            <span className="umb-ripple" aria-hidden="true" />
            <Pic a={art.beast} className="umb-water-bottom" />
            {art.human.src.includes("placeholder") && <span className="umb-water-tag">그림 준비 중</span>}
            <figcaption><b>{a.name}</b>{a.secondaryName ? <> · 곁에 {a.secondaryName}</> : null}</figcaption>
          </>
        ) : (
          <figcaption className="umb-seeking">영물을 찾는 중이란다. 물결이 가라앉으면 모습이 비칠 것이다.</figcaption>
        )}
      </figure>
      {a && <p className="ub-note umb-notice">{a.disclaimerText}</p>}
    </>
  )
  return (
    <UmStudyBackdrop dim={0.3}>
      <main className="umb">
        <header className="umb-cover ub-dark">
          <p className="umb-cover-kicker">운명비서 <span lang="zh" aria-hidden="true">運命秘書</span></p>
          <h1 className="umb-cover-name">{name ? `${name}의 기록` : "너의 기록"}</h1>
        </header>

        {/* 읽는 순서: 원국 · 1 / 2 · 3 / 4 · 5 — PC는 펼친 양면, 모바일은 한 쪽에 이어서 */}
        <UmBook layout="auto" fit="grow" label="운명비서 — 첫째 펼침"
          left={
            <UmBookPage title="네 여덟 글자" kicker={<span lang="zh">四柱八字</span>} titleAs="h2" className="umb-wongook" id="umb-wongook" folio="序">
              <Wongook data={data} />
            </UmBookPage>
          }
          right={<Chapter c={ch(1)} no={1} name={name} folio="一" />} />
        <UmBook layout="auto" fit="grow" label="운명비서 — 둘째 펼침"
          left={<Chapter c={ch(2)} no={2} name={name} folio="二">{water}</Chapter>}
          right={<Chapter c={ch(3)} no={3} name={name} folio="三" />} />
        <UmBook layout="auto" fit="grow" label="운명비서 — 셋째 펼침"
          left={<Chapter c={ch(4)} no={4} name={name} folio="四" />}
          right={<Chapter c={ch(5)} no={5} name={name} folio="五" />} />

        <UmBook layout="single" label="운명비서 — 근거" className="umb-bookfold">
          <UmBookPage as="section" id="umb-how">
            <details className="umb-fold">
              <summary className="umb-fold__summary">
                <span className="umb-fold__mark" aria-hidden="true" />
                <span>할미는 어떻게 알았을까?</span>
                <span className="umb-fold__hint">근거 보기</span>
              </summary>
              <div className="umb-fold__body"><Basis data={data} /></div>
            </details>
          </UmBookPage>
        </UmBook>

        <Shelf />

        <div className="umb-end ub-dark">
          <UmWaxSeal type="button" label="다시 입력하기" size="sm" beforeActivate={() => true} onActivate={onRetry} />
          <p className="umb-fine"><Link href="/unmyeong/privacy" className="um-fine-link">개인정보 처리 안내</Link></p>
          <p className="umb-fine umb-foot">풀이는 옛 명리의 해석을 빌려 경향을 짚는 것이며 미래를 확정하지 않는다. 재미와 참고용으로 읽어 주렴.</p>
        </div>
      </main>
    </UmStudyBackdrop>
  )
}
