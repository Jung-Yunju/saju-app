"use client"

// 무료 결과 = 운명비서 한 권. 서버 응답(UnmyeongFreeResponse)을 그대로 보여 준다 — 화면에서 사주를 계산하지 않는다.
import Link from "next/link"
import { UmDivider, UmFold, UmPage, UmSealButton, umButtonClass } from "@/components/ui/unmyeong"
import { archetypeAssets, type ImageAsset } from "@/lib/unmyeong/assets"
import type { UnmyeongFreeChapter, UnmyeongFreeResponse } from "@/lib/unmyeong/free-types"
import { visibleVolumes } from "@/lib/unmyeong/volumes"

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

function ChapterBlock({ c, no, name, children }: { c?: UnmyeongFreeChapter; no: number; name: string; children?: React.ReactNode }) {
  const title = c?.title || TITLES[no - 1]
  return (
    <UmPage no={no} title={title} className="umr-chapter" id={`umr-ch-${no}`}>
      {children}
      {c ? <Body text={fillName(c.text, name)} /> : <Pending />}
    </UmPage>
  )
}

function Wongook({ data }: { data: UnmyeongFreeResponse }) {
  const cur = data.daeun.items[data.daeun.currentIndex]
  const order = ["hour", "day", "month", "year"] as const
  const items = data.basis.elements.items
  return (
    <section className="umr-wongook um-page um-paper" aria-labelledby="umr-wg-h">
      <h2 id="umr-wg-h">네 여덟 글자 <span lang="zh">四柱八字</span></h2>
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
    </section>
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
  if (!vols.length) return null
  return (
    <section className="umr-shelf" aria-labelledby="umr-shelf-h">
      <h2 id="umr-shelf-h">아직 펼쳐지지 않은 장</h2>
      <p className="umr-shelf-lead">네 운명비서에는 이어지는 다섯 권이 있단다. 읽고 싶은 때에 펼쳐 보렴.</p>
      <ol className="umr-books">
        {vols.map(v => (
          <li key={v.key} className="umr-book">
            <span className="umr-book-no">제{v.no}권</span>
            <b className="umr-book-title">{v.title}</b>
            <span className="umr-book-sub">{v.subtitle}</span>
            <span className="umr-book-intro">{v.intro}</span>
          </li>
        ))}
      </ol>
      <p className="um-fine"><Link href="/unmyeong/privacy" className="um-fine-link">개인정보 처리 안내</Link></p>
      <p className="umr-shelf-cta"><Link className={umButtonClass("brass")} href="/input">운명비서 전권 보기</Link></p>
    </section>
  )
}

export function ResultBook({ data, name, onRetry }: { data: UnmyeongFreeResponse; name: string; onRetry: () => void }) {
  const ch = (n: number) => data.chapters?.find(c => c.no === n)
  const a = data.archetype
  const art = a ? archetypeAssets(a.id) : null
    const first = ch(1)
  const firstText = first ? fillName(first.text, name) : ""
  const m = firstText.match(/^(.+?[.!?。])\s+([\s\S]*)$/)
  return (
    <main className="umr">
      <header className="umr-cover">
        <p className="umr-cover-kicker">운명비서 <span lang="zh">運命秘書</span></p>
        <p className="umr-cover-name">{name ? `${name}의 기록` : "오늘의 대상자의 기록"}</p>
      </header>

      <Wongook data={data} />

      <div className="umr-spread">
        <UmPage no={1} title={`${name ? name + ", " : ""}${first?.title || TITLES[0]}`} className="umr-chapter" id="umr-ch-1">
          {first ? (m ? <><p className="umr-essence">{m[1]}</p><Body text={m[2]} /></> : <p className="umr-essence">{firstText}</p>) : <Pending />}
        </UmPage>

        <ChapterBlock c={ch(2)} no={2} name={name}>
          <figure className="umr-water">
            {art && a ? (
              <>
                <Pic a={art.human} className="umr-water-top" />
                <span className="umr-ripple" aria-hidden="true" />
                <Pic a={art.beast} className="umr-water-bottom" />
                {art.human.src.includes("placeholder") && <span className="umr-water-tag">그림 준비 중</span>}
                <figcaption><b>{a.name}</b>{a.secondaryName ? <> · 곁에 {a.secondaryName}</> : null}</figcaption>
              </>
            ) : (
              <figcaption className="umr-seeking">영물을 찾는 중이란다. 물결이 가라앉으면 모습이 비칠 것이다.</figcaption>
            )}
          </figure>
          {a && <p className="umr-notice">{a.disclaimerText}</p>}
        </ChapterBlock>

        <ChapterBlock c={ch(3)} no={3} name={name} />
        <ChapterBlock c={ch(4)} no={4} name={name} />
      </div>

      <div className="umr-spread umr-spread-one">
        <ChapterBlock c={ch(5)} no={5} name={name} />
      </div>

      <section className="umr-howwrap um-page um-paper">
        <UmFold summary="할미는 어떻게 알았을까?" hint="근거 보기" className="umr-fold"><Basis data={data} /></UmFold>
      </section>

      <UmDivider />
      <Shelf />

      <p className="umr-retry"><UmSealButton type="button" onClick={onRetry}>다시 입력하기</UmSealButton></p>
      <p className="umr-fine umr-foot">풀이는 옛 명리의 해석을 빌려 경향을 짚는 것이며 미래를 확정하지 않는다. 재미와 참고용으로 읽어 주렴.</p>
    </main>
  )
}
