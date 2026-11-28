"use client"

import { useEffect, useRef, useState } from "react"
import { Intro } from "./intro"
import { BookForm } from "./book-form"
import { LoadingBook } from "./loading-book"
import { UmPage, UmSealButton } from "./_fallback"

const SEEN_KEY = "um-intro-seen"
const MIN_LAST_STEP_MS = 250 // 인위적 대기 상한(300ms 이하)

type Stage = "boot" | "intro" | "form" | "loading" | "result"

function readSeen(): boolean { try { return localStorage.getItem(SEEN_KEY) === "1" } catch { return false } }
function writeSeen() { try { localStorage.setItem(SEEN_KEY, "1") } catch { /* 저장소를 못 써도 동작한다 */ } }

export function UnmyeongClient() {
  const [stage, setStage] = useState<Stage>("boot")
  const [introKey, setIntroKey] = useState(0)
  const [name, setName] = useState("")
  const [step, setStep] = useState(0)
  const [error, setError] = useState("")
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const busy = useRef(false)

  useEffect(() => { setStage(readSeen() ? "form" : "intro") }, []) // eslint-disable-line react-hooks/set-state-in-effect

  async function submit(n: string, body: Record<string, unknown>) {
    if (busy.current) return
    busy.current = true
    setName(n); setError(""); setStep(0); setStage("loading")
    try {
      const res = await fetch("/api/unmyeong/free", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      setStep(1)
      const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { error?: string }) | null
      if (!res.ok || !json || json.error) {
        setError(json?.error || "운명비서를 펼치지 못했단다. 잠시 후 다시 해 보렴.")
        setStage("form"); return
      }
      setStep(2)
      await new Promise(r => setTimeout(r, MIN_LAST_STEP_MS))
      setData(json); setStage("result")
      window.scrollTo(0, 0)
    } catch {
      setError("네트워크에 닿지 못했단다. 연결을 확인하고 다시 해 보렴.")
      setStage("form")
    } finally { busy.current = false }
  }

  if (stage === "boot") return <div className="um-boot" aria-hidden="true" />
  if (stage === "intro") {
    return <Intro key={introKey} onDone={() => { writeSeen(); setStage("form") }} />
  }
  const form = (
    // 로딩 중에도 마운트를 유지해 오류가 나면 적어 둔 내용이 그대로 남는다
    <div hidden={stage !== "form"}>
      <BookForm busy={stage === "loading"} serverError={error} onSubmit={submit}
        onReplay={() => { setIntroKey(k => k + 1); setStage("intro") }} />
    </div>
  )
  if (stage === "loading") return <>{form}<LoadingBook step={step} /></>
  if (stage === "result" && data) {
    return (
      <>{form}<main className="um-formwrap">
        <UmPage className="um-book-sheet">
          <h1 className="um-result-title">{name ? `${name}의 운명비서` : "운명비서"}</h1>
          <ResultPlain data={data} />
          <UmSealButton type="button" onClick={() => setStage("form")}>다시 적어 보기</UmSealButton>
        </UmPage>
      </main></>
    )
  }
  return form
}

/** 임시 출력(다음 작업에서 5장 화면으로 교체): 응답의 문자열·배열을 그대로 보여 준다 */
function ResultPlain({ data }: { data: Record<string, unknown> }) {
  return (
    <pre className="um-result-raw">{JSON.stringify(data, null, 2)}</pre>
  )
}
