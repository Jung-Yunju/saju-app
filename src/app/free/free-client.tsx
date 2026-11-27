"use client"

import { useRef, useState } from "react"
import { BirthCard } from "../input/birth-card"
import { buildRequest, emptyForm, type BirthForm } from "../input/build-request"
import { Bokja } from "./bokja"
import { ResultView } from "./result-view"
import type { FreeResult } from "./_lib/types"
import { SITE_NAME } from "./theme"

export function FreeClient() {
  const [form, setForm] = useState<BirthForm>(emptyForm())
  const [result, setResult] = useState<FreeResult | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  const setField = <K extends keyof BirthForm>(key: K, val: BirthForm[K]) => setForm((f) => ({ ...f, [key]: val }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError("")
    // 이름은 쓰지 않는다(입력 칸도 숨김) — 서버로 보내지 않는다
    const built = buildRequest("BASIC", { ...form, name: "" }, null)
    if ("error" in built) { setError(built.error); return }
    setLoading(true)
    try {
      const res = await fetch("/api/free", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(built.body),
      })
      const data = (await res.json().catch(() => null)) as (FreeResult & { error?: string }) | null
      if (!res.ok || !data || data.error) {
        setError(data?.error || "결과를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.")
        return
      }
      setResult(data)
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }))
    } catch {
      setError("네트워크에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main ref={topRef}>
      <div className={`fr-wrap ${result ? "fr-wrap-wide" : ""}`}>
        <div className="fr-top"><span>{SITE_NAME}</span></div>

        {!result ? (
          <div className="fr-form-col">
            <section className="fr-hero">
              <Bokja className="fr-hero-cat" />
              <h1>생년월일만 넣으면,<br />바로 나와요</h1>
              <p>가입도 결제도 없이. <b>계산은 옛 달력(만세력)</b>으로 정확히 하고, 한마디는 할미가 얹어 줘요.</p>
            </section>
            <form onSubmit={submit} noValidate>
              <div className="fr-birth">
                <BirthCard title="" form={form} setField={setField} />
              </div>
              {error && <p className="fr-err" role="alert">{error}</p>}
              <div className="fr-btn-row">
                <button type="submit" className="fr-btn fr-btn-primary" disabled={loading}>
                  {loading ? "계산하는 중…" : "내 사주 보기"}
                </button>
              </div>
              <p className="fr-fine">입력한 생년월일은 결과를 계산하는 데만 쓰고 서버에 저장하지 않아요.<br />재미와 참고용이에요.</p>
            </form>
          </div>
        ) : (
          <ResultView result={result} onReset={() => setResult(null)} />
        )}
      </div>
    </main>
  )
}
