"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function PaymentSuccessContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading")
  const [message, setMessage] = useState("사주 풀이를 생성하고 있습니다...")

  useEffect(() => {
    async function confirm() {
      const paymentKey = params.get("paymentKey")!
      const orderId = params.get("orderId")!
      const amount = parseInt(params.get("amount") || "19900")
      const birthInfo = JSON.parse(decodeURIComponent(params.get("birthInfo") || "{}"))

      try {
        const res = await fetch("/api/payment/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey, orderId, amount, birthInfo }),
        })
        const data = await res.json()

        if (!res.ok) {
          setStatus("error")
          setMessage(data.error || "결제 확인에 실패했습니다.")
          return
        }

        setStatus("done")
        setTimeout(() => router.push(`/reading/${data.readingId}`), 1500)
      } catch {
        setStatus("error")
        setMessage("서버 오류가 발생했습니다.")
      }
    }
    confirm()
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        {status === "loading" && (
          <>
            <div className="font-serif text-4xl mb-4 animate-pulse">✦</div>
            <h1 className="font-serif text-xl font-bold mb-2">풀이를 생성하고 있습니다</h1>
            <p className="text-sm text-[#6b7280]">{message}</p>
            <p className="text-xs text-[#9ea3ab] mt-2">약 20~30초 소요됩니다</p>
          </>
        )}
        {status === "done" && (
          <>
            <div className="text-4xl mb-4">✓</div>
            <h1 className="font-serif text-xl font-bold mb-2">풀이가 완성되었습니다!</h1>
            <p className="text-sm text-[#6b7280]">잠시 후 풀이 화면으로 이동합니다...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-4xl mb-4">⚠</div>
            <h1 className="font-serif text-xl font-bold mb-2">오류가 발생했습니다</h1>
            <p className="text-sm text-[#6b7280]">{message}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 text-sm text-[#a5603f] underline"
            >
              처음으로 돌아가기
            </button>
          </>
        )}
      </div>
    </main>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <PaymentSuccessContent />
    </Suspense>
  )
}
