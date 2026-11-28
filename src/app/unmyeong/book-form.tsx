"use client"
import Link from "next/link"
import { useState } from "react"
import {
  buildRequest, MAX_BIRTH_YEAR, emptyForm, isDstYear, MIN_BIRTH_YEAR, PLACES, SIJIN_OPTIONS, ZI_CHOICES, ZI_HELP,
  type BirthForm, type TimeMode,
} from "../input/build-request"
import { UmChoiceGroup, UmField, UmLedgerPage, UmSealButton } from "@/components/ui/unmyeong"
import { UNMYEONG_ASSETS } from "@/lib/unmyeong/assets"

type Errors = Partial<Record<"gender" | "date" | "time", string>>

const MODES: { v: TimeMode; l: string }[] = [
  { v: "exact", l: "정확한 시각" },
  { v: "sijin", l: "대략 시간대" },
  { v: "unknown", l: "시각 모름" },
]

export type BirthFormState = ReturnType<typeof useBirthForm>

/** 운명비서 입력 상태·검증. 이름은 화면 표시에만 쓰고 서버 요청 본문에는 들어가지 않는다. 화면(오버레이·대체 장)은 이 상태를 공유한다 */
export function useBirthForm(onSubmit: (name: string, body: Record<string, unknown>) => void, busy: boolean) {
  const [f, setF] = useState<BirthForm>(() => ({ ...emptyForm(), timeMode: "unknown" }))
  const [errors, setErrors] = useState<Errors>({})
  const set = <K extends keyof BirthForm>(k: K, v: BirthForm[K]) => setF(p => ({ ...p, [k]: v }))

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
  return { f, setF, set, errors, submit }
}

const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max)

/** 입력 항목 조각 — 같은 항목·검증을 오버레이와 대체 장이 함께 쓴다. compact = 도움말을 줄여 좁은 종이에 맞춘다 */
export function NameField({ form, compact }: { form: BirthFormState; compact?: boolean }) {
  const { f, set } = form
  return (
    <UmField variant="ledger" label="이름" type="text" autoComplete="off" maxLength={20} placeholder="선택 · 예) 철수"
      help={compact ? undefined : "이름은 이 화면에서 널 부를 때만 쓴단다. 서버로 보내지 않고 저장하지도 않는단다."}
      value={f.name} onChange={e => set("name", e.target.value)} />
  )
}

export function GenderField({ form }: { form: BirthFormState }) {
  const { f, set, errors } = form
  return (
    <UmChoiceGroup variant="ledger" legend="성별" name="gender" value={f.gender}
      options={[{ value: "M", label: "남성" }, { value: "F", label: "여성" }]}
      onChange={e => set("gender", e.target.value as BirthForm["gender"])}
      help={errors.gender ? <span role="alert">{errors.gender}</span> : undefined} />
  )
}

export function CalField({ form, compact }: { form: BirthFormState; compact?: boolean }) {
  const { f, set } = form
  return (
    <>
      <UmChoiceGroup variant="ledger" legend="달력" name="cal" value={f.calType}
        options={[{ value: "SOLAR", label: "양력" }, { value: "LUNAR", label: "음력" }]}
        onChange={e => { const v = e.target.value as BirthForm["calType"]; set("calType", v); if (v === "SOLAR") set("isLeapMonth", false) }}
        help={compact ? undefined : "모르면 보통 양력이란다. 음력 달 앞에 ‘윤’이 붙었다면 윤달을 체크하렴."} />
      {f.calType === "LUNAR" && (
        <label className="um-check um-check-ledger"><input type="checkbox" checked={f.isLeapMonth} onChange={e => set("isLeapMonth", e.target.checked)} />
          <span>윤달에 태어났어요</span></label>
      )}
    </>
  )
}

export function DateField({ form }: { form: BirthFormState }) {
  const { f, set, errors } = form
  const maxYear = MAX_BIRTH_YEAR
  return (
    <div className="um-field um-field--ledger um-datefield" role="group" aria-labelledby="um-date-label">
      <span className="um-field__label" id="um-date-label">생년월일</span>
      <div className="um-datefield__row">
        <input className="um-field__control" aria-label="태어난 해" inputMode="numeric" autoComplete="off" placeholder="1990" title={`${MIN_BIRTH_YEAR}~${maxYear}`}
          aria-invalid={errors.date ? true : undefined} value={f.birthYear} onChange={e => set("birthYear", digits(e.target.value, 4))} />
        <input className="um-field__control" aria-label="태어난 달" inputMode="numeric" autoComplete="off" placeholder="5"
          aria-invalid={errors.date ? true : undefined} value={f.birthMonth} onChange={e => set("birthMonth", digits(e.target.value, 2))} />
        <input className="um-field__control" aria-label="태어난 날" inputMode="numeric" autoComplete="off" placeholder="17"
          aria-invalid={errors.date ? true : undefined} value={f.birthDay} onChange={e => set("birthDay", digits(e.target.value, 2))} />
      </div>
      {errors.date && <p className="um-err-line" role="alert">{errors.date}</p>}
    </div>
  )
}

export function TimeField({ form, compact }: { form: BirthFormState; compact?: boolean }) {
  const { f, setF, set, errors } = form
  return (
    <>
      <UmChoiceGroup variant="ledger" legend="태어난 시각" name="tmode" value={f.timeMode}
        options={MODES.map(o => ({ value: o.v, label: o.l }))}
        onChange={e => { const v = e.target.value as TimeMode; setF(p => ({ ...p, timeMode: v, birthHour: "", birthMinute: "", ziChoice: "" })) }}
        help={errors.time ? <span role="alert">{errors.time}</span> : compact ? undefined : "시각을 모르면 ‘시각 모름’으로 두렴. 해·달·날만으로도 읽을 수 있단다. 정확한 시각은 24시간제로 적는다(오후 3시 20분은 15시 20분)."} />
      {f.timeMode === "exact" && (
        <>
          <UmField variant="ledger" label="태어난 시" inputMode="numeric" placeholder="0~23" value={f.birthHour}
            onChange={e => set("birthHour", digits(e.target.value, 2))} />
          <UmField variant="ledger" label="태어난 분" inputMode="numeric" placeholder="0~59" value={f.birthMinute}
            onChange={e => set("birthMinute", digits(e.target.value, 2))} />
        </>
      )}
      {f.timeMode === "sijin" && (
        <>
          <UmField as="select" variant="ledger" label="시간대" value={f.birthHour}
            onChange={e => setF(p => ({ ...p, birthHour: e.target.value, ziChoice: e.target.value === "0" ? p.ziChoice : "" }))}>
            <option value="">시간대를 골라 주렴</option>
            {SIJIN_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.e} · {o.l} ({o.t})</option>)}
          </UmField>
          {f.birthHour === "0" && (
            <UmField as="select" variant="ledger" label="한밤중" help={ZI_HELP} value={f.ziChoice}
              onChange={e => set("ziChoice", e.target.value as BirthForm["ziChoice"])}>
              <option value="">한밤중 안에서는 모르겠어요</option>
              {ZI_CHOICES.map(z => <option key={z.v} value={z.v}>{z.l}</option>)}
            </UmField>
          )}
        </>
      )}
      {isDstYear(f.birthYear) && f.timeMode !== "unknown" && (
        <p className="um-note">그 무렵엔 서머타임이 있었단다. 출생증명서의 시각을 그대로 적으면 우리가 맞춰 보마.</p>
      )}
    </>
  )
}

export function PlaceField({ form, compact }: { form: BirthFormState; compact?: boolean }) {
  const { f, set } = form
  return (
    <UmField as="select" variant="ledger" label="출생지" value={f.birthplace} onChange={e => set("birthplace", e.target.value)}
      help={compact ? undefined : f.birthplace === "" ? "해외이거나 모르면 서울 기준으로 계산한단다." : "태어난 곳의 경도에 따라 실제 태양 시각이 달라진단다."}>
      {PLACES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
      <option value="">해외 / 모름</option>
    </UmField>
  )
}

/** 정지 이미지를 못 불러올 때의 대체 입력 장(예전 화면 그대로) */
export function BookFormLegacy({ form, onReplay, showReplay, busy, serverError }: {
  form: BirthFormState; onReplay: () => void; showReplay: boolean; busy: boolean; serverError: string
}) {
  return (
    <main className="um-formwrap">
      <form onSubmit={form.submit} noValidate aria-busy={busy} className="um-formbook">
        <UmLedgerPage
          intro={<p>세상에 단 한 권, 오직 너를 위한 기록.</p>}
          footer={
            <>
              {serverError && <p className="um-err-form" role="alert">{serverError}</p>}
              <UmSealButton type="submit" block disabled={busy}>{busy ? "펼치는 중…" : "나의 운명비서 열기"}</UmSealButton>
              <p className="um-fine">적은 생년월일은 풀이를 셈하는 데만 쓰고 서버에 남기지 않는다. 재미 삼아, 참고로만 읽거라. <Link href="/unmyeong/privacy" className="um-fine-link">개인정보 처리 안내</Link></p>
              {showReplay && UNMYEONG_ASSETS.media && <button type="button" className="um-replay" onClick={onReplay}>인트로 다시 보기</button>}
            </>
          }
        >
          <NameField form={form} />
          <GenderField form={form} />
          <CalField form={form} />
          <DateField form={form} />
          <TimeField form={form} />
          <PlaceField form={form} />
        </UmLedgerPage>
      </form>
    </main>
  )
}
