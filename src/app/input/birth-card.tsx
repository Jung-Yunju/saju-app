"use client"

import { type BirthForm, MIN_BIRTH_YEAR, currentMaxBirthYear, PLACES, SIJIN_OPTIONS, ZI_CHOICES, ZI_HELP, isDstYear, type TimeMode } from "./build-request"

type SetField = <K extends keyof BirthForm>(key: K, val: BirthForm[K]) => void

export function BirthCard({
  title, form, setField, accent,
}: {
  title: string
  form: BirthForm
  setField: SetField
  accent?: boolean
}) {
  const borderColor = accent ? "border-[#a5603f]" : "border-[#e4ddd3]"
  const modes: { v: TimeMode; l: string }[] = [
    { v: "exact", l: "정확한 시각" },
    { v: "sijin", l: "시진만 알아요" },
    { v: "unknown", l: "모름" },
  ]
  return (
    <div className={`bg-[#faf8f4] rounded-2xl border ${borderColor} shadow-sm p-6 space-y-5`}>
      <p className="text-xs font-bold text-[#1b2a3a] tracking-wide">{title}</p>

      <div>
        <Label>이름</Label>
        <input type="text" placeholder="예) 김철수"
          value={form.name} onChange={e => setField("name", e.target.value)}
          className={inputCls} />
      </div>

      <div>
        <Label>양력 / 음력</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[{ v: "SOLAR", l: "양력" }, { v: "LUNAR", l: "음력" }].map(({ v, l }) => (
            <ToggleBtn key={v} active={form.calType === v} onClick={() => setField("calType", v)}>{l}</ToggleBtn>
          ))}
        </div>
        {form.calType === "LUNAR" && (
          <label className="mt-3 flex items-center gap-2 text-xs text-[#1b2a3a]">
            <input type="checkbox" checked={form.isLeapMonth}
              onChange={e => setField("isLeapMonth", e.target.checked)} />
            윤달에 태어났어요
          </label>
        )}
        {form.calType === "LUNAR" && <Help>음력 달 앞에 &apos;윤&apos;이 붙은 달이면 체크해 주세요. 같은 달 숫자라도 윤달은 다른 날이에요.</Help>}
      </div>

      <div>
        <Label>태어난 해</Label>
        <input type="number" placeholder="예) 1990" min={MIN_BIRTH_YEAR} max={currentMaxBirthYear()}
          value={form.birthYear} onChange={e => setField("birthYear", e.target.value)}
          className={inputCls} />
      </div>

      <div>
        <Label>태어난 월 · 일</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input type="number" placeholder="월 (1–12)" min="1" max="12"
            value={form.birthMonth} onChange={e => setField("birthMonth", e.target.value)}
            className={inputCls} />
          <input type="number" placeholder="일 (1–31)" min="1" max="31"
            value={form.birthDay} onChange={e => setField("birthDay", e.target.value)}
            className={inputCls} />
        </div>
      </div>

      <div>
        <Label optional>태어난 시간</Label>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {modes.map(({ v, l }) => (
            <button key={v} type="button" onClick={() => { setField("timeMode", v); setField("birthHour", ""); setField("birthMinute", ""); setField("ziChoice", "") }}
              className={`min-h-[44px] py-2.5 rounded-lg text-xs font-medium border transition-colors ${form.timeMode === v ? "bg-[#1b2a3a] text-white border-[#1b2a3a]" : "bg-white text-[#6b7280] border-[#e4ddd3] hover:border-[#1b2a3a]"}`}>
              {l}
            </button>
          ))}
        </div>

        {form.timeMode === "exact" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" inputMode="numeric" placeholder="시 (0–23)" min="0" max="23"
                aria-label="태어난 시"
                value={form.birthHour} onChange={e => setField("birthHour", e.target.value)}
                className={inputCls} />
              <input type="number" inputMode="numeric" placeholder="분 (0–59)" min="0" max="59"
                aria-label="태어난 분"
                value={form.birthMinute} onChange={e => setField("birthMinute", e.target.value)}
                className={inputCls} />
            </div>
            <Help>24시간제로 적어 주세요(오후 3시 20분은 15시 20분). 분까지 알면 시주 경계가 더 정확해져요. 밤 11시 30분 전후 출생도 날짜가 바르게 계산돼요.</Help>
          </>
        )}

        {form.timeMode === "sijin" && (
          <>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {SIJIN_OPTIONS.map(({ v, l, t }) => (
                <button key={v} type="button"
                  onClick={() => { setField("birthHour", v); if (v !== "0") setField("ziChoice", "") }}
                  className={`py-2 rounded-lg border transition-colors text-center ${form.birthHour === v ? "bg-[#1b2a3a] text-white border-[#1b2a3a]" : "bg-white text-[#6b7280] border-[#e4ddd3] hover:border-[#1b2a3a]"}`}>
                  <span className="block text-[11px] font-semibold">{l}</span>
                  <span className={`block text-[9px] mt-0.5 ${form.birthHour === v ? "text-[#c8d8e8]" : "text-[#b9b2a6]"}`}>{t}</span>
                </button>
              ))}
            </div>
            {form.birthHour === "0" && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-[#1b2a3a]">자시 중 언제 태어났나요? <span className="text-[#b9b2a6] font-normal">(선택)</span></p>
                <div className="grid grid-cols-1 gap-1.5 mt-2">
                  {ZI_CHOICES.map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setField("ziChoice", form.ziChoice === v ? "" : (v as "night" | "dawn"))}
                      className={`py-2 rounded-lg text-[11px] font-medium border transition-colors ${form.ziChoice === v ? "bg-[#1b2a3a] text-white border-[#1b2a3a]" : "bg-white text-[#6b7280] border-[#e4ddd3] hover:border-[#1b2a3a]"}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <Help>{ZI_HELP}</Help>
              </div>
            )}
          </>
        )}

        {form.timeMode === "unknown" && (
          <Help>시간을 모르면 연·월·일 기둥만으로 풀이합니다.</Help>
        )}

        {isDstYear(form.birthYear) && form.timeMode !== "unknown" && (
          <p className="mt-2 text-[11px] text-[#a5603f] bg-[#f6efe4] rounded-lg px-3 py-2">
            당시 서머타임이 있었어요. 출생증명서에 적힌 시각을 그대로 넣으면 저희가 보정합니다.
          </p>
        )}
      </div>

      <div>
        <Label optional>태어난 곳</Label>
        <select value={form.birthplace} onChange={e => setField("birthplace", e.target.value)}
          className={inputCls}>
          {PLACES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          <option value="">해외 / 모름</option>
        </select>
        {form.birthplace === "" ? (
          <Help>해외이거나 모르면 서울 기준으로 계산돼요.</Help>
        ) : (
          <Help>태어난 곳의 경도에 따라 실제 태양 시각이 달라져요. 서울은 표준시보다 약 32분 늦습니다.</Help>
        )}
      </div>

      <div>
        <Label>성별</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[{ v: "M", l: "남성" }, { v: "F", l: "여성" }].map(({ v, l }) => (
            <ToggleBtn key={v} accent active={form.gender === v} onClick={() => setField("gender", v)}>{l}</ToggleBtn>
          ))}
        </div>
      </div>
    </div>
  )
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[11px] leading-relaxed text-[#9ea3ab]">{children}</p>
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <p className="text-xs font-semibold text-[#1b2a3a] tracking-wide">
      {children}
      {optional && <span className="ml-1 text-[#b9b2a6] font-normal">(선택)</span>}
    </p>
  )
}

function ToggleBtn({ children, active, accent, onClick }: {
  children: React.ReactNode; active: boolean; accent?: boolean; onClick: () => void
}) {
  const activeCls = accent ? "bg-[#a5603f] text-white border-[#a5603f]" : "bg-[#1b2a3a] text-white border-[#1b2a3a]"
  return (
    <button type="button" onClick={onClick}
      className={`min-h-[44px] py-2.5 rounded-lg text-sm font-medium border transition-colors ${active ? activeCls : "bg-white text-[#6b7280] border-[#e4ddd3] hover:border-[#1b2a3a]"}`}>
      {children}
    </button>
  )
}

const inputCls = "mt-2 w-full border border-[#e4ddd3] rounded-xl px-4 py-2.5 min-h-[44px] text-base text-[#1b2a3a] placeholder:text-[#9a8f80] bg-white focus:outline-none focus:border-[#a5603f] transition-colors"
