// 대표 확인용 운명비서 미리보기: 실제 /unmyeong 화면 코드를 그대로 쓰고, /api/unmyeong/free만 브라우저 안에서 같은 서버 함수로 처리한다.
// 서버·DB·AI·외부 전송 없음. 이름·생년월일은 이 브라우저 밖으로 나가지 않는다.
import { createRoot } from "react-dom/client"
import "@/styles/unmyeong.css"
import "@/styles/unmyeong-book.css"
import "@/app/unmyeong/unmyeong-flow.css"
import "@/app/unmyeong/unmyeong-result.css"
import "@/app/unmyeong/unmyeong-stage.css"
import { UnmyeongClient } from "@/app/unmyeong/unmyeong-client"
import { EngineInputError } from "@/engine"
import { SAJU_INPUT_ERROR_MESSAGE } from "@/lib/saju-input"
import { buildUnmyeongFree, validateUnmyeongFreeRequest } from "@/lib/unmyeong/free"

declare const __FREE_COPY__: unknown

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } })
const realFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  if (!url.endsWith("/api/unmyeong/free")) return realFetch(input, init)
  let body: unknown
  try { body = JSON.parse(String(init?.body ?? "")) } catch { return json({ error: "요청 형식이 올바르지 않습니다." }, 400) }
  const v = validateUnmyeongFreeRequest(body)
  if (!v.ok) return json({ error: v.error }, 400)
  try {
    return json(buildUnmyeongFree(v.value, { freeCopy: __FREE_COPY__ }))
  } catch (e) {
    if (e instanceof EngineInputError) return json({ error: SAJU_INPUT_ERROR_MESSAGE }, 400)
    console.error("[preview] 계산 실패", e)
    return json({ error: "계산 중 오류가 났어요(미리보기)." }, 500)
  }
}

const el = document.getElementById("um-app")!
el.className = "um-root um-flow-root"
createRoot(el).render(<UnmyeongClient />)
