"use client"

import { useState } from "react"
import {
  buildRequest, currentMaxBirthYear, emptyForm, isDstYear, MIN_BIRTH_YEAR, PLACES, SIJIN_OPTIONS, ZI_CHOICES, ZI_HELP,
  type BirthForm, type TimeMode,
} from "../input/build-request"
import { UmField, UmPage, UmSealButton } from "./_fallback"

type Errors = Partial<Record<"gender" | "date" | "time", string>>

const MODES: { v: TimeMode; l: string }[] = [
  { v: "exact", l: "정확한 시각" },
  { v: "sijin", l: "대략 시간대" },
  { v: "unknown", l: "시각 모름" },
]

/** 운명비서 첫 장. 이름은 화면 표시에만 쓰고 서버 요청 본문에는 들어가지 않는다. */
export function BookForm({ onSubmit, onReplay, busy, serverError }: {
  onSubmit: (name: string, body: Record<string, unknown>) => void
  onReplay: () => void
  busy: boolean
  serverError: string
}) {
  const [f, setF] = useState<BirthForm>(() => ({ ...emptyForm(), timeMode: "unknown" }))
  const [errors, setErrors] = useState<Errors>({})
  const set = <K extends keyof BirthForm>(k: K, v: BirthForm[K]) => setF(p => ({ ...p, [k]: v }))
  const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const errs: Errors = {}
    if (!f.gender) errs.gender = "성별을 골라 주렴."
    const y = parseInt(f.birthYear, 10), m = parseInt(f.birthMonth, 10), d = parseInt(f.birthDay, 10)
    if (!f.birthYear || !f.birthMonth || !f.birthDay) errs.date = "태어난 해와 달, 날을 모두 적어 주렴."
    else if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) errs.date = "달은 1~12, 날은 1~31 사이로 적어 주렴."
    else if (f.calType === "SOLAR" && new Date(y, m, 0).getDate() < d) errs.date = `그 해 ${m}월은 ${new Date(y, m, 0).getDate()}일까지 있단다.`
    let body: Record<string, unknown> | null = null
    if (!errs.date && !errs.gender) {
      // 이름은 서버로 보내지 않는다
      const built = buildRequest("BASIC", { ...f, name: "" }, null)
      if ("error" in built) {
        if (/시각|시간대/.test(built.error)) errs.time = built.error
        else errs.date = built.error
      } else body = built.body
    }
    setErrors(errs)
    if (body) onSubmit(f.name.trim(), body)
  }

  const maxYear = currentMaxBirthYear()
  return (
    <main className="um-formwrap">
      <UmPage className="um-book-sheet">
        <form onSubmit={submit} noValidate aria-busy={busy}>
          <header className="um-form-head">
            <p className="um-form-kicker" aria-hidden="true">運命秘書</p>
            <h1>운명비서</h1>
            <p className="um-form-sub">세상에 단 한 권, 오직 너를 위한 기록.</p>
            <p className="um-form-guide">자, 네 이름과 태어난 날을 적어 보거라.</p>
          </header>

          <UmField label="이름" optional id="um-name"
            help="이름은 이 화면에서 널 부를 때만 쓴단다. 서버로 보내지 않고 저장하지도 않아.">
            <input id="um-name" className="um-input" type="text" autoComplete="off" maxLength={20} placeholder="예) 철수"
              value={f.name} onChange={e => set("name", e.target.value)} />
          </UmField>

          <UmField label="성별" asGroup error={errors.gender}>
            <div className="um-choices um-choices-2" role="radiogroup">
              {[{ v: "M", l: "남성" }, { v: "F", l: "여성" }].map(o => (
                <label key={o.v} className="um-choice"><input type="radio" name="gender" value={o.v} checked={f.gender === o.v}
                  onChange={() => set("gender", o.v)} /><span>{o.l}</span></label>
              ))}
            </div>
          </UmField>

          <UmField label="양력 · 음력" asGroup
            help="태어난 날을 어느 달력으로 알고 있는지 고르렴. 모르면 보통 양력이란다. 음력 달 앞에 ‘윤’이 붙었다면 윤달을 체크하렴. 같은 달 숫자라도 윤달은 다른 날이야.">
            <div className="um-choices um-choices-2" role="radiogroup">
              {[{ v: "SOLAR", l: "양력" }, { v: "LUNAR", l: "음력" }].map(o => (
                <label key={o.v} className="um-choice"><input type="radio" name="cal" value={o.v} checked={f.calType === o.v}
                  onChange={() => { set("calType", o.v); if (o.v === "SOLAR") set("isLeapMonth", false) }} /><span>{o.l}</span></label>
              ))}
            </div>
            {f.calType === "LUNAR" && (
              <label className="um-check"><input type="checkbox" checked={f.isLeapMonth} onChange={e => set("isLeapMonth", e.target.checked)} />
                <span>윤달에 태어났어요</span></label>
            )}
          </UmField>

          <UmField label="태어난 날" asGroup error={errors.date}>
            <div className="um-date">
              <label><span className="um-sr">태어난 해</span>
                <input className="um-input" inputMode="numeric" autoComplete="off" placeholder="해 (예 1990)" aria-label="태어난 해"
                  title={`${MIN_BIRTH_YEAR}~${maxYear}`} value={f.birthYear} onChange={e => set("birthYear", digits(e.target.value, 4))} /></label>
              <label><span className="um-sr">태어난 달</span>
                <input className="um-input" inputMode="numeric" autoComplete="off" placeholder="달" aria-label="태어난 달"
                  value={f.birthMonth} onChange={e => set("birthMonth", digits(e.target.value, 2))} /></label>
              <label><span className="um-sr">태어난 날</span>
                <input className="um-input" inputMode="numeric" autoComplete="off" placeholder="날" aria-label="태어난 날"
                  value={f.birthDay} onChange={e => set("birthDay", digits(e.target.value, 2))} /></label>
            </div>
          </UmField>

          <UmField label="태어난 시각" asGroup optional error={errors.time}
            help={<>시각을 모르면 ‘시각 모름’으로 두렴. 태어난 해·달·날만으로도 읽을 수 있단다. 정확한 시각은 24시간제로 적는다(오후 3시 20분은 15시 20분).<br />{ZI_HELP}</>}>
            <div className="um-choices um-choices-3" role="radiogroup">
              {MODES.map(o => (
                <label key={o.v} className="um-choice"><input type="radio" name="tmode" value={o.v} checked={f.timeMode === o.v}
                  onChange={() => setF(p => ({ ...p, timeMode: o.v, birthHour: "", birthMinute: "", ziChoice: "" }))} /><span>{o.l}</span></label>
              ))}
            </div>
            {f.timeMode === "exact" && (
              <div className="um-time">
                <input className="um-input" inputMode="numeric" placeholder="시 (0~23)" aria-label="태어난 시"
                  value={f.birthHour} onChange={e => set("birthHour", digits(e.target.value, 2))} />
                <input className="um-input" inputMode="numeric" placeholder="분 (0~59)" aria-label="태어난 분"
                  value={f.birthMinute} onChange={e => set("birthMinute", digits(e.target.value, 2))} />
              </div>
            )}
            {f.timeMode === "sijin" && (
              <div className="um-time um-time-1">
                <select className="um-input" aria-label="태어난 시간대" value={f.birthHour}
                  onChange={e => setF(p => ({ ...p, birthHour: e.target.value, ziChoice: e.target.value === "0" ? p.ziChoice : "" }))}>
                  <option value="">시간대를 골라 주렴</option>
                  {SIJIN_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.e} · {o.l} ({o.t})</option>)}
                </select>
                {f.birthHour === "0" && (
                  <select className="um-input" aria-label="한밤중 칸 안에서 언제 태어났는지" value={f.ziChoice}
                    onChange={e => set("ziChoice", e.target.value as BirthForm["ziChoice"])}>
                    <option value="">한밤중 안에서는 모르겠어요</option>
                    {ZI_CHOICES.map(z => <option key={z.v} value={z.v}>{z.l}</option>)}
                  </select>
                )}
              </div>
            )}
            {isDstYear(f.birthYear) && f.timeMode !== "unknown" && (
              <p className="um-note">그 무렵엔 서머타임이 있었단다. 출생증명서의 시각을 그대로 적으면 우리가 맞춰 보마.</p>
            )}
          </UmField>

          <UmField label="태어난 곳" optional id="um-place"
            help={f.birthplace === "" ? "해외이거나 모르면 서울 기준으로 계산한단다." : "태어난 곳의 경도에 따라 실제 태양 시각이 달라진단다. 서울은 표준시보다 약 32분 늦지."}>
            <select id="um-place" className="um-input" value={f.birthplace} onChange={e => set("birthplace", e.target.value)}>
              {PLACES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              <option value="">해외 / 모름</option>
            </select>
          </UmField>

          {serverError && <p className="um-err um-err-form" role="alert">{serverError}</p>}
          <UmSealButton type="submit" disabled={busy}>{busy ? "펼치는 중…" : "나의 운명비서 열기"}</UmSealButton>
          <p className="um-fine">입력한 생년월일은 풀이를 계산하는 데만 쓰고 서버에 저장하지 않는단다. 재미와 참고용이야.</p>
          <button type="button" className="um-replay" onClick={onReplay}>인트로 다시 보기</button>
        </form>
      </UmPage>
    </main>
  )
}
