"use client"

// 입력 화면(D-033): 어두운 서재 위 입체 고서. PC = 펼친 양면(왼쪽 제목·할머니 말·인장 / 오른쪽 기록 칸), 모바일 = 한 쪽 세로.
// 입력 상태·검증·요청 본문은 기존 useBirthForm / build-request 그대로. 인장이 갈라지기 전에 검증(오류는 칸 아래), 통과하면 요청을 시작한다.
import Link from "next/link"
import { useEffect, useRef } from "react"
import {
  UmBook, UmBookTitle, UmInkChoice, UmInkField, UmInkPart, UmInkPartSet, UmStudyBackdrop, UmWaxSeal,
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
  // 대략 시간대는 칸에 쉬운 이름만(「오전 10시경」 — 가장 긴 것 6자), 시진 이름·시간 범위는 아래 도움말 줄에 — 칸이 좁아도 잘리지 않게.
  // 도움말은 「사시(巳時)」「09:30~11:29」 두 덩어리(구분 점 없음 — 줄이 바뀌어도 점이 줄 끝·앞에 매달리지 않는다)
  const sijin = f.timeMode === "sijin" ? SIJIN_OPTIONS.find(o => o.v === f.birthHour) : undefined
  const sijinHint = sijin && <><span className="ub-ink__sentence">{sijin.l}</span> <span className="ub-ink__sentence">{sijin.t}</span></>
  return (
    <div className={`umf-record${pc ? "" : " ub-ledger"}${imprint ? " is-imprint" : ""}`} inert={imprint}>
      <UmInkField label="부를 이름" type="text" name="um-name" autoComplete="off" maxLength={20} placeholder="예: 서연"
        hint="이 책에서만 너를 부를 이름이다." value={f.name} onChange={e => set("name", e.target.value)} />
      <UmInkField as="group" label="태어난 날" requiredMark="꼭" error={errors.date}>
        <UmInkPart aria-label="태어난 연도" inputMode="numeric" autoComplete="off" placeholder="1992" title={`${MIN_BIRTH_YEAR}~${MAX_BIRTH_YEAR}`} chars={4}
          suffix="년" invalid={!!errors.date} value={f.birthYear} onChange={e => set("birthYear", digits(e.target.value, 4))} />
        {/* 월·일은 한 덩어리 — 줄이 모자라면 「8 월 14 일」이 함께 다음 줄로(「14 일」만 떨어지지 않게) */}
        <UmInkPartSet>
          <UmInkPart aria-label="태어난 월" inputMode="numeric" autoComplete="off" placeholder="8" chars={2}
            suffix="월" invalid={!!errors.date} value={f.birthMonth} onChange={e => set("birthMonth", digits(e.target.value, 2))} />
          <UmInkPart aria-label="태어난 일" inputMode="numeric" autoComplete="off" placeholder="14" chars={2}
            suffix="일" invalid={!!errors.date} value={f.birthDay} onChange={e => set("birthDay", digits(e.target.value, 2))} />
        </UmInkPartSet>
      </UmInkField>
      {pc ? <div className="ub-fields-row">{cal}{sex}</div> : cal}
      <UmInkField as="group" label="태어난 시각" error={errors.time}
        hint={f.timeMode === "sijin" ? sijinHint || undefined : "모르면 '모름'으로 둬라. 시는 빼고 본다."}>
        <UmInkPart as="select" aria-label="태어난 시" chars={f.timeMode === "sijin" ? 9 : 4} grow={f.timeMode === "sijin" ? 1 : 0}
          suffix={f.timeMode === "sijin" ? undefined : "시"} invalid={!!errors.time} value={hourValue} onChange={e => onHour(e.target.value)}>
          <option value="">모름</option>
          <optgroup label="정확한 시(24시간제)">
            {HOURS.map(h => <option key={h} value={String(h)}>{h}</option>)}
          </optgroup>
          <optgroup label="대략 시간대">
            {SIJIN_OPTIONS.map(o => <option key={o.v} value={`s${o.v}`}>{o.e}</option>)}
          </optgroup>
        </UmInkPart>
        {/* 대략 시간대를 고르면 분 칸은 쓰지 않으므로 감춘다(시간대 이름이 한 줄을 다 쓴다) */}
        {f.timeMode !== "sijin" && (
          <UmInkPart as="select" aria-label="태어난 분" chars={2} suffix="분" disabled={f.timeMode !== "exact"} value={f.timeMode === "exact" ? f.birthMinute : ""}
            onChange={e => set("birthMinute", e.target.value)}>
            <option value="">—</option>
            {MINUTES.map(m => <option key={m} value={String(m)}>{m}</option>)}
          </UmInkPart>
        )}
      </UmInkField>
      {f.timeMode === "sijin" && f.birthHour === "0" && (
        // 긴 고르기 글이 칸 폭을 넘지 않게 select 대신 짧은 글자 고르기. 값·검증은 그대로(""·night·dawn). 시간 범위는 위 시 칸 도움말에
        // 긴 안내(ZI_HELP)는 장부형에서도 쪽 폭 전체로 읽힌다(umf-zi — 본문 크기 T3)
        <UmInkChoice legend="한밤중" name="um-zi" className="umf-zi" value={f.ziChoice} hint={ZI_HELP}
          options={[{ value: "", label: "모름" }, ...ZI_CHOICES.map(z => ({ value: z.v, label: z.v === "night" ? "자정 전" : "자정 후" }))]}
          onChange={e => set("ziChoice", e.target.value as BirthForm["ziChoice"])} />
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
  // 두 문장을 각각 한 줄 덩어리로(<br> 이 있으면 균형 줄바꿈이 듣지 않아 좁은 화면에서 「된다.」만 남는다)
  const voice = (
    <p className="ub-voice ub-voice--center umf-voice">
      <span className="umf-voice__line">왔구나. 앉거라.</span> <span className="umf-voice__line">네 이름과 난 때만 적으면 된다.</span>
    </p>
  )
  // 고지·개인정보 안내: 양면(PC)은 왼쪽 쪽 인장 아래, 한 쪽(모바일)은 책 바로 아래 서재 위(책 전체가 첫 화면에 들어가도록)
  const notes = (
    <div className={`umf-notes${spread ? "" : " ub-dark"}`}>
      <p className="ub-note umf-note">사주 풀이는 전통 명리 해석에 따른 이야기이며, 미래를 과학적으로 예측한다는 뜻이 아닙니다.</p>
      <p className="ub-note umf-note umf-fine">적은 생년월일은 풀이를 셈하는 데만 쓰고 서버에 남기지 않는다. 이름은 서버로 보내지 않는단다.</p>
      {/* 링크는 한 줄을 따로 — 누르는 높이 44px */}
      <p className="umf-links"><Link href="/unmyeong/privacy" className="um-fine-link">개인정보 처리 안내</Link></p>
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
