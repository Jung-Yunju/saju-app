"use client"

import { useEffect, useRef, useState } from "react"
import { Intro, introHasPlayed } from "./intro"
import { useBirthForm } from "./book-form"
import { BookInput } from "./book-input"
import { BookStill, StillBackdrop } from "./book-still"
import { EntryVideo } from "./entry-video"
import { LoadingBook } from "./loading-book"
import { ResultBook } from "./result-book"
import { canPlayMedia, kindOf, playSfx, useViewport } from "./media-utils"
import type { UnmyeongFreeResponse } from "@/lib/unmyeong/free-types"

const SEEN_KEY = "um-intro-seen"
const MIN_LAST_STEP_MS = 250 // 인위적 대기 상한(300ms 이하)
// 장면 08 이름 각인(책 쪽 위) 타임라인(ms): 0~600 기록 칸 걷힘 · 600~2200 이름 번짐 · 2700 결과 진입 영상 크로스페이드(300) → 3000
const ENTRY_AT = 2700
const DISSOLVE_MS = 800

type Stage = "boot" | "intro" | "form" | "imprint" | "entry" | "result"

function readSeen(): boolean { try { return localStorage.getItem(SEEN_KEY) === "1" } catch { return false } }
function writeSeen() { try { localStorage.setItem(SEEN_KEY, "1") } catch { /* 저장소를 못 써도 동작한다 */ } }

export function UnmyeongClient() {
  const vp = useViewport()
  const kind = vp ? kindOf(vp.w, vp.h) : "mobile"
  const [stage, setStage] = useState<Stage>("boot")
  const [introKey, setIntroKey] = useState(0)
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [data, setData] = useState<UnmyeongFreeResponse | null>(null)
  const [ready, setReady] = useState(false)
  const [fromIntro, setFromIntro] = useState(false) // 인트로 직후 — 영상 마지막 프레임에서 서재가 어두워진다
  const [entryFailed, setEntryFailed] = useState(false) // 영상 실패 → 기존 로딩 연출
  const [veil, setVeil] = useState(false) // 결과로 디졸브하는 동안 영상 마지막 프레임 유지
  const busy = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => { if (vp && stage === "boot") setStage(readSeen() ? "form" : "intro") }, [vp, stage]) // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)) }
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  async function submit(n: string, body: Record<string, unknown>) {
    if (busy.current) return
    busy.current = true
    clearTimers()
    setFromIntro(false)
    setName(n); setError(""); setData(null); setReady(false); setEntryFailed(false); setVeil(false)
    playSfx() // 클릭 직후 — 실패해도 진행
    // 움직임 줄이기·느린 연결이면 각인·영상 없이 곧바로 다음 단계(기존 로딩 연출)
    if (canPlayMedia()) {
      setStage("imprint")
      later(() => setStage(s => (s === "imprint" ? "entry" : s)), ENTRY_AT)
    } else { setEntryFailed(true); setStage("entry") }
    try {
      const res = await fetch("/api/unmyeong/free", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { error?: string }) | null
      if (!res.ok || !json || json.error) { fail(json?.error || "운명비서를 펼치지 못했단다. 잠시 후 다시 해 보렴."); return }
      setData(json as unknown as UnmyeongFreeResponse); setReady(true)
    } catch {
      fail("네트워크에 닿지 못했단다. 연결을 확인하고 다시 해 보렴.")
    } finally { busy.current = false }
  }
  // API 오류 → 입력 화면으로(입력값은 form 상태에 그대로 남아 있다)
  function fail(msg: string) { clearTimers(); setError(msg); setStage("form") }

  const form = useBirthForm(submit, stage === "imprint" || stage === "entry")

  function toResult(dissolve: boolean) {
    setStage("result"); window.scrollTo(0, 0)
    if (dissolve) { setVeil(true); later(() => setVeil(false), DISSOLVE_MS) }
  }
  // 영상 없이 기다리는 경로: 응답이 오면 곧 결과로
  useEffect(() => {
    if (stage !== "entry" || !entryFailed || !ready) return
    const t = setTimeout(() => toResult(false), MIN_LAST_STEP_MS)
    return () => clearTimeout(t)
  }, [stage, entryFailed, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  if (stage === "boot") return <div className="um-boot" aria-hidden="true" />
  if (stage === "intro") {
    return <Intro key={introKey} kind={kind} onDone={() => { writeSeen(); setFromIntro(true); setStage("form") }} />
  }

  const replay = () => { setIntroKey(k => k + 1); setStage("intro") }
  const isBusy = stage === "imprint" || stage === "entry"
  const showResult = stage === "result" && !!data
  const showEntry = (stage === "entry" && !entryFailed) || (showResult && veil)

  const spread = !!vp && vp.w >= 960
  const scene = (
    <BookInput form={form} spread={spread} enter={fromIntro} opening busy={isBusy} imprint={stage === "imprint" || stage === "entry"} name={name}
      serverError={error} showReplay={introHasPlayed} onReplay={replay} />
  )
  return (
    <>
      {showResult && data ? (
        <div key="result" className="um-dissolve-in"><ResultBook data={data} name={name} onRetry={() => { setStage("form"); window.scrollTo(0, 0) }} /></div>
      ) : (
        <div key="scene" hidden={stage === "entry" && entryFailed}>{scene}</div>
      )}
      {/* 인트로 마지막 프레임(같은 정지 그림)을 0.8초에 걸쳐 걷어 내며 어두운 서재로 이어 준다 */}
      {fromIntro && stage === "form" && (
        <div className="um-ghost" aria-hidden="true" onAnimationEnd={() => setFromIntro(false)}>
          <StillBackdrop kind={kind} /><BookStill kind={kind} />
        </div>
      )}
      {showEntry && <EntryVideo key="entry" kind={kind} ready={ready} fading={showResult} zoomFrom={null}
        onEnd={() => { if (stage === "entry") toResult(true) }} onFail={() => { if (stage === "entry") setEntryFailed(true) }} />}
      {stage === "entry" && entryFailed && <div className="um-layer"><LoadingBook step={ready ? 2 : 0} /></div>}
    </>
  )
}
