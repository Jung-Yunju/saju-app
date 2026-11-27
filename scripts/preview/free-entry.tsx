// 대표 확인용 미리보기: 실제 /free 화면 코드를 그대로 쓰고, /api/free 요청만 브라우저 안에서 같은 서버 함수로 처리한다.
// 서버·DB·AI·외부 전송 없음. 입력값은 이 브라우저 밖으로 나가지 않는다.
import { createRoot } from "react-dom/client"
import { FreeClient } from "@/app/free/free-client"
import { BRAND, THEME_DEFAULT } from "@/app/free/theme"
import { EngineInputError } from "@/engine"
import { buildSajuInputFromRequest, SAJU_INPUT_ERROR_MESSAGE } from "@/lib/saju-input"
import { validateReadingRequest } from "@/lib/validate"
import { buildFreeResult } from "@/app/api/free/_lib/build-result"
import type { RawContent } from "@/app/free/_lib/content"

declare const __RAW_CONTENT__: RawContent

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } })

const realFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  if (!url.endsWith("/api/free")) return realFetch(input, init)
  let body: unknown
  try { body = JSON.parse(String(init?.body ?? "")) } catch { return json({ error: "요청 형식이 올바르지 않습니다." }, 400) }
  const v0 = validateReadingRequest(body)
  if (!v0.ok) return json({ error: v0.error }, 400)
  const v = v0.value
  try {
    const s = buildSajuInputFromRequest({ ...v, year: v.birthYear, month: v.birthMonth, day: v.birthDay, hour: v.birthHour })
    return json(buildFreeResult(s, __RAW_CONTENT__))
  } catch (e) {
    if (e instanceof EngineInputError) return json({ error: SAJU_INPUT_ERROR_MESSAGE }, 400)
    console.error("[preview] 계산 실패", e)
    return json({ error: "계산 중 오류가 났어요(미리보기)." }, 500)
  }
}

const el = document.getElementById("fr-app")!
el.className = "fr-root"
el.dataset.brand = BRAND
el.dataset.theme = THEME_DEFAULT
createRoot(el).render(<FreeClient />)
