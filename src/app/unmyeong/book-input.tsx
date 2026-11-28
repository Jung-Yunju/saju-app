"use client"

// 입력 화면(D-033): 어두운 서재 위 입체 고서. PC = 펼친 양면(왼쪽 제목·할머니 말·인장 / 오른쪽 기록 칸), 모바일 = 한 쪽 세로.
// 입력 상태·검증·요청 본문은 기존 useBirthForm / build-request 그대로. 인장이 갈라지기 전에 검증(오류는 칸 아래), 통과하면 요청을 시작한다.
import Link from "next/link"
import { useEffect, useRef } from "react"
import {
  UmBook, UmBookTitle, UmInkChoice, UmInkField, UmInkPart, UmStudyBackdrop, UmWaxSeal,
} from "@/components/ui/unmyeong/book"
import { isDstYear, MAX_BIRTH_YEAR, MIN_BIRTH_YEAR, PLACES, SIJIN_OPTIONS, ZI_CHOICES, ZI_HELP, type BirthForm } from "../input/build-request"
import type { BirthFormState } from "./book-form"

const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max)
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function Fields({ form, imprint, pc }: { form: BirthFormState; imprint: boolean; pc: boolean }) {
  const { f, setF, set, errors } = form
  const calValue = f.calType === "SOLAR" ? "solar" : f.isLeapMonth ? "leap" : "lunar"
  const cal = (
    <UmInkChoice legend="달력" name="um-cal" value={calValue}
      options={[{ value: "solar", label: "양력" }, { value: "lunar", label: "음력" }, { value: "leap", label: "윤달" }]}
      onChange={e => {
        const v = e.target.value
        setF(p => ({ ...p, calType: v === "solar" ? "SOLAR" : "LUNAR", isLeapMonth: v === "leap" }))
      }} />
  )
  const sex = (
    <UmInkChoice legend="성별" name="um-gender" value={f.gender} error={errors.gender}
      options={[{ value: "M", label: "남" }, { value: "F", label: "여" }]}
      onChange={e => set("gender", e.target.value as BirthForm["gender"])} />
  )
  // 시 칸 하나로 세 방식을 고른다: 모름(빈 값) · 정확한 시(0~23) · 대략 시간대(s + 짝수 시). 시간 방식·검증은 기존 useBirthForm 그대로
  const hourValue = f.timeMode === "exact" ? f.birthHour : f.timeMode === "sijin" ? (f.birthHour === "" ? "" : `s${f.birthHour}`) : ""
  const onHour = (v: string) => {
    if (v === "") setF(p => ({ ...p, timeMode: "unknown", birthHour: "", birthMinute: "", ziChoice: "" }))
    else if (v.startsWith("s")) setF(p => ({ ...p, timeMode: "sijin", birthHour: v.slice(1), birthMinute: "", ziChoice: "" }))
    else setF(p => ({ ...p, timeMode: "exact", birthHour: v, birthMinute: p.timeMode === "exact" && p.birthMinute !== "" ? p.birthMinute : "0", ziChoice: "" }))
  }
  return (
    <div className={`umf-record${pc ? "" : " ub-ledger"}${imprint ? " is-imprint" : ""}`} inert={imprint}>
      <UmInkField label="부를 이름" type="text" name="um-name" autoComplete="off" maxLength={20} placeholder="예: 서연"
        hint="이 책에서만 너를 부를 이름이다." value={f.name} onChange={e => set("name", e.target.value)} />
      <UmInkField as="group" label="태어난 날" requiredMark="꼭" error={errors.date}>
        <UmInkPart aria-label="태어난 연도" inputMode="numeric" autoComplete="off" placeholder="1992" title={`${MIN_BIRTH_YEAR}~${MAX_BIRTH_YEAR}`} chars={4}
          suffix="년" invalid={!!errors.date} value={f.birthYear} onChange={e => set("birthYear", digits(e.target.value, 4))} />
        <UmInkPart aria-label="태어난 월" inputMode="numeric" autoComplete="off" placeholder="8" chars={2}
          suffix="월" invalid={!!errors.date} value={f.birthMonth} onChange={e => set("birthMonth", digits(e.target.value, 2))} />
        <UmInkPart aria-label="태어난 일" inputMode="numeric" autoComplete="off" placeholder="14" chars={2}
          suffix="일" invalid={!!errors.date} value={f.birthDay} onChange={e => set("birthDay", digits(e.target.value, 2))} />
      </UmInkField>
      {pc ? <div className="ub-fields-row">{cal}{sex}</div> : cal}
      <UmInkField as="group" label="태어난 시각" error={errors.time}
        hint={f.timeMode === "sijin" ? undefined : "모르면 '모름'으로 둬라. 시는 빼고 본다."}>
        <UmInkPart as="select" aria-label="태어난 시" chars={3} suffix="시" invalid={!!errors.time} value={hourValue} onChange={e => onHour(e.target.value)}>
          <option value="">모름</option>
          <optgroup label="정확한 시(24시간제)">
            {HOURS.map(h => <option key={h} value={String(h)}>{h}</option>)}
          </optgroup>
          <optgroup label="대략 시간대">
            {SIJIN_OPTIONS.map(o => <option key={o.v} value={`s${o.v}`}>{o.e} · {o.l} ({o.t})</option>)}
          </optgroup>
        </UmInkPart>
        <UmInkPart as="select" aria-label="태어난 분" chars={2} suffix="분" disabled={f.timeMode !== "exact"} value={f.timeMode === "exact" ? f.birthMinute : ""}
          onChange={e => set("birthMinute", e.target.value)}>
          <option value="">—</option>
          {MINUTES.map(m => <option key={m} value={String(m)}>{m}</option>)}
        </UmInkPart>
      </UmInkField>
      {f.timeMode === "sijin" && f.birthHour === "0" && (
        <UmInkField as="select" label="한밤중" hint={ZI_HELP} value={f.ziChoice}
          onChange={e => set("ziChoice", e.target.value as BirthForm["ziChoice"])}>
          <option value="">한밤중 안에서는 모르겠어요</option>
          {ZI_CHOICES.map(z => <option key={z.v} value={z.v}>{z.l}</option>)}
        </UmInkField>
      )}
      {isDstYear(f.birthYear) && f.timeMode !== "unknown" && (
        <p className="ub-note umf-dst">그 무렵엔 서머타임이 있었단다. 출생증명서의 시각을 그대로 적으면 우리가 맞춰 보마.</p>
      )}
      {!pc && sex}
      <UmInkField as="select" label="태어난 곳" name="um-place" value={f.birthplace} onChange={e => set("birthplace", e.target.value)}>
        {PLACES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        <option value="">해외 / 모름</option>
      </UmInkField>
    </div>
  )
}

export function BookInput({ form, spread, enter, opening, busy, imprint, name, serverError, showReplay, onReplay }: {
  form: BirthFormState
  spread: boolean
  enter: boolean
  opening: boolean
  busy: boolean
  imprint: boolean
  name: string
  serverError: string
  showReplay: boolean
  onReplay: () => void
}) {
  const pending = useRef<ReturnType<BirthFormState["validate"]>>(null)
  const wrap = useRef<HTMLDivElement>(null)
  // 각인 때 이름이 보이는 자리(기록 칸 가운데)가 화면 밖이면 그만큼만 옮긴다(책이 화면에 맞으면 움직이지 않는다)
  useEffect(() => {
    if (imprint) wrap.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [imprint])
  const voice = <p className="ub-voice ub-voice--center umf-voice">왔구나. 앉거라.<br />네 이름과 난 때만 적으면 된다.</p>
  // 고지·개인정보 안내: 양면(PC)은 왼쪽 쪽 인장 아래, 한 쪽(모바일)은 책 바로 아래 서재 위(책 전체가 첫 화면에 들어가도록)
  const notes = (
    <div className={`umf-notes${spread ? "" : " ub-dark"}`}>
      <p className="ub-note umf-note">사주 풀이는 전통 명리 해석에 따른 이야기이며, 미래를 과학적으로 예측한다는 뜻이 아닙니다.</p>
      <p className="ub-note umf-note umf-fine">
        적은 생년월일은 풀이를 셈하는 데만 쓰고 서버에 남기지 않는다. 이름은 서버로 보내지 않는단다.{" "}
        <Link href="/unmyeong/privacy" className="um-fine-link">개인정보 처리 안내</Link>
      </p>
      {showReplay && <button type="button" className="um-replay" onClick={onReplay}>인트로 다시 보기</button>}
    </div>
  )
  const seal = (
    <div className="umf-seal">
      {serverError && <p className="ub-ink__error umf-server-error" role="alert">{serverError}</p>}
      <UmWaxSeal busy={busy} busyLabel="펼치는 중…"
        beforeActivate={() => { pending.current = form.validate(); return !!pending.current }}
        onActivate={() => { const r = pending.current; pending.current = null; if (r) form.onSubmit(r.name, r.body) }} />
    </div>
  )
  const fields = <Fields form={form} imprint={imprint} pc={spread} />
  const stamp = imprint && <p className="umf-imprint" aria-hidden="true">{name || "너"}</p>
  return (
    <UmStudyBackdrop enter={enter}>
      <main className="umf-stage">
        <form noValidate aria-busy={busy} onSubmit={e => e.preventDefault()}>
          {spread ? (
            <UmBook layout="spread" fit="lock" opening={opening} label="운명비서 — 적는 쪽" leftAlign="center"
              left={<><UmBookTitle />{voice}{seal}{notes}</>}
              right={<div className="umf-rightwrap" ref={wrap}>{fields}{stamp}</div>} />
          ) : (
            <>
              <UmBook layout="single" fit="lock" opening={opening} label="운명비서 — 적는 쪽">
                <UmBookTitle />
                {voice}
                <div className="umf-rightwrap" ref={wrap}>{fields}{stamp}</div>
                {seal}
              </UmBook>
              {notes}
            </>
          )}
        </form>
      </main>
    </UmStudyBackdrop>
  )
}
