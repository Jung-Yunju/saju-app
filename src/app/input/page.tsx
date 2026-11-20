"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

const READING_LABELS: Record<string, { title: string; emoji: string; twoPersons?: boolean }> = {
  BASIC:    { title: "나는 어떤 사람인가", emoji: "🔮" },
  MONEY:    { title: "나는 왜 돈이 안 모일까", emoji: "💸" },
  LOVE:     { title: "나는 왜 연애가 안 될까", emoji: "💔" },
  CAREER:   { title: "나는 왜 직장이 안 맞을까", emoji: "😤" },
  BULLY:    { title: "이 사람은 왜 나를 괴롭힐까", emoji: "😠", twoPersons: true },
  CONFLICT: { title: "우리는 왜 맨날 싸울까", emoji: "⚡", twoPersons: true },
}

type BirthForm = {
  name: string
  birthYear: string
  birthMonth: string
  birthDay: string
  birthHour: string
  gender: string
  calType: string
}

const emptyForm = (): BirthForm => ({
  name: "", birthYear: "", birthMonth: "", birthDay: "",
  birthHour: "", gender: "", calType: "SOLAR",
})

function InputPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const type = params.get("type") || "BASIC"
  const meta = READING_LABELS[type] || READING_LABELS.BASIC
  const isTwoPerson = !!meta.twoPersons

  const [me, setMe] = useState<BirthForm>(emptyForm())
  const [other, setOther] = useState<BirthForm>(emptyForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const setField = (setter: typeof setMe) => (key: keyof BirthForm) => (val: string) =>
    setter(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!me.birthYear || !me.birthMonth || !me.birthDay || !me.gender) {
      setError("내 생년월일과 성별을 입력해 주세요."); return
    }
    if (isTwoPerson && (!other.birthYear || !other.birthMonth || !other.birthDay || !other.gender)) {
      setError("상대방 생년월일과 성별도 입력해 주세요."); return
    }
    const y = parseInt(me.birthYear)
    if (y < 1900 || y > 2024) { setError("생년을 1900~2024 사이로 입력해 주세요."); return }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        readingType: type,
        name: me.name || undefined,
        birthYear: parseInt(me.birthYear),
        birthMonth: parseInt(me.birthMonth),
        birthDay: parseInt(me.birthDay),
        birthHour: me.birthHour !== "" ? parseInt(me.birthHour) : null,
        gender: me.gender,
        calType: me.calType,
      }
      if (isTwoPerson) {
        body.otherName = other.name || undefined
        body.otherBirthYear = parseInt(other.birthYear)
        body.otherBirthMonth = parseInt(other.birthMonth)
        body.otherBirthDay = parseInt(other.birthDay)
        body.otherBirthHour = other.birthHour !== "" ? parseInt(other.birthHour) : null
        body.otherGender = other.gender
      }

      // Step 1: DB 레코드 생성 (빠름, AI 없음)
      const res1 = await fetch("/api/reading/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data1 = await res1.json()
      if (!res1.ok) { setError(data1.error || "오류가 발생했습니다."); return }

      const readingId = data1.readingId

      // Step 2: AI 단정 생성 (최대 60초)
      const res2 = await fetch(`/api/reading/${readingId}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data2 = await res2.json()
      if (!res2.ok) { setError(data2.error || "AI 분석 중 오류가 발생했습니다."); return }

      router.push(`/verify/${readingId}`)
    } catch (err) {
      console.error("풀이 요청 오류:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`오류: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-14">
      <div className="w-full max-w-[380px]">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px w-10 bg-[#a5603f] opacity-50" />
            <span className="text-[9px] tracking-[0.4em] text-[#a5603f] font-semibold">사주풀이</span>
            <div className="h-px w-10 bg-[#a5603f] opacity-50" />
          </div>
          <div className="text-3xl mb-2">{meta.emoji}</div>
          <h1 className="font-serif font-black text-[#1b2a3a] text-2xl tracking-tight mb-2">
            {meta.title}
          </h1>
          <p className="text-sm text-[#6b7280]">정확할수록 풀이가 더 깊어집니다</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 내 정보 */}
          <BirthCard
            title={isTwoPerson ? "나의 생년월일" : "생년월일"}
            form={me}
            setField={setField(setMe)}
          />

          {/* 상대방 정보 (2인 풀이) */}
          {isTwoPerson && (
            <BirthCard
              title="상대방의 생년월일"
              form={other}
              setField={setField(setOther)}
              accent
            />
          )}

          {error && (
            <div className="bg-[#fff5f5] border border-red-100 rounded-xl px-4 py-3 text-sm text-[#c9553d]">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-[#1b2a3a] text-[#f3ede4] py-4 rounded-xl font-semibold text-sm hover:bg-[#2a3f55] active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {loading ? "풀이 생성 중… (1~2분 소요)" : "풀이 받기 →"}
          </button>
        </form>

        <Link href="/" className="block text-center text-[11px] text-[#9ea3ab] mt-5 hover:text-[#a5603f] transition-colors">
          ← 처음으로
        </Link>
      </div>
    </main>
  )
}

function BirthCard({
  title, form, setField, accent,
}: {
  title: string
  form: BirthForm
  setField: (key: keyof BirthForm) => (val: string) => void
  accent?: boolean
}) {
  const borderColor = accent ? "border-[#a5603f]" : "border-[#e4ddd3]"
  return (
    <div className={`bg-[#faf8f4] rounded-2xl border ${borderColor} shadow-sm p-6 space-y-5`}>
      <p className="text-xs font-bold text-[#1b2a3a] tracking-wide">{title}</p>

      {/* 이름 */}
      <div>
        <Label>이름</Label>
        <input type="text" placeholder="예) 김철수"
          value={form.name} onChange={e => setField("name")(e.target.value)}
          className={inputCls} />
      </div>

      {/* 양력/음력 */}
      <div>
        <Label>양력 / 음력</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[{ v: "SOLAR", l: "양력" }, { v: "LUNAR", l: "음력" }].map(({ v, l }) => (
            <ToggleBtn key={v} active={form.calType === v} onClick={() => setField("calType")(v)}>{l}</ToggleBtn>
          ))}
        </div>
      </div>

      {/* 생년 */}
      <div>
        <Label>태어난 해</Label>
        <input type="number" placeholder="예) 1990" min="1900" max="2024"
          value={form.birthYear} onChange={e => setField("birthYear")(e.target.value)}
          className={inputCls} />
      </div>

      {/* 월·일 */}
      <div>
        <Label>태어난 월 · 일</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input type="number" placeholder="월 (1–12)" min="1" max="12"
            value={form.birthMonth} onChange={e => setField("birthMonth")(e.target.value)}
            className={inputCls} />
          <input type="number" placeholder="일 (1–31)" min="1" max="31"
            value={form.birthDay} onChange={e => setField("birthDay")(e.target.value)}
            className={inputCls} />
        </div>
      </div>

      {/* 시간 */}
      <div>
        <Label optional>태어난 시간</Label>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          <button type="button" onClick={() => setField("birthHour")("")}
            className={`py-2.5 rounded-lg text-[11px] font-medium border transition-colors col-span-3 ${form.birthHour === "" ? "bg-[#1b2a3a] text-white border-[#1b2a3a]" : "bg-white text-[#9ea3ab] border-[#e4ddd3] hover:border-[#1b2a3a]"}`}>
            모름 (시간을 모르면 선택)
          </button>
          {HOUR_OPTIONS.map(({ v, l, t }) => (
            <button key={v} type="button" onClick={() => setField("birthHour")(v)}
              className={`py-2 rounded-lg border transition-colors text-center ${form.birthHour === v ? "bg-[#1b2a3a] text-white border-[#1b2a3a]" : "bg-white text-[#6b7280] border-[#e4ddd3] hover:border-[#1b2a3a]"}`}>
              <span className="block text-[11px] font-semibold">{l}</span>
              <span className={`block text-[9px] mt-0.5 ${form.birthHour === v ? "text-[#c8d8e8]" : "text-[#b9b2a6]"}`}>{t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 성별 */}
      <div>
        <Label>성별</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[{ v: "M", l: "남성" }, { v: "F", l: "여성" }].map(({ v, l }) => (
            <ToggleBtn key={v} accent active={form.gender === v} onClick={() => setField("gender")(v)}>{l}</ToggleBtn>
          ))}
        </div>
      </div>
    </div>
  )
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
      className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${active ? activeCls : "bg-white text-[#6b7280] border-[#e4ddd3] hover:border-[#1b2a3a]"}`}>
      {children}
    </button>
  )
}

const inputCls = "mt-2 w-full border border-[#e4ddd3] rounded-xl px-4 py-2.5 text-sm text-[#1b2a3a] placeholder:text-[#c8bfb0] bg-white focus:outline-none focus:border-[#a5603f] transition-colors"

const HOUR_OPTIONS = [
  { v: "0",  l: "자시(子時)", t: "23:30~01:29" },
  { v: "2",  l: "축시(丑時)", t: "01:30~03:29" },
  { v: "4",  l: "인시(寅時)", t: "03:30~05:29" },
  { v: "6",  l: "묘시(卯時)", t: "05:30~07:29" },
  { v: "8",  l: "진시(辰時)", t: "07:30~09:29" },
  { v: "10", l: "사시(巳時)", t: "09:30~11:29" },
  { v: "12", l: "오시(午時)", t: "11:30~13:29" },
  { v: "14", l: "미시(未時)", t: "13:30~15:29" },
  { v: "16", l: "신시(申時)", t: "15:30~17:29" },
  { v: "18", l: "유시(酉時)", t: "17:30~19:29" },
  { v: "20", l: "술시(戌時)", t: "19:30~21:29" },
  { v: "22", l: "해시(亥時)", t: "21:30~23:29" },
]

export default function InputPage() {
  return (
    <Suspense>
      <InputPageInner />
    </Suspense>
  )
}
