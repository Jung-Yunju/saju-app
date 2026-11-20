"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { loadTossPayments, TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk"

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!

function PaymentContent() {
  const router = useRouter()
  const params = useSearchParams()
  const orderId = params.get("orderId")!
  const amount = parseInt(params.get("amount") || "19900")
  const widgetRef = useRef<TossPaymentsWidgets | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function init() {
      const toss = await loadTossPayments(CLIENT_KEY)
      const widgets = toss.widgets({ customerKey: "GUEST" })
      widgetRef.current = widgets

      await widgets.setAmount({ currency: "KRW", value: amount })
      await widgets.renderPaymentMethods({
        selector: "#payment-widget",
        variantKey: "DEFAULT",
      })
      await widgets.renderAgreement({ selector: "#agreement-widget" })
      setReady(true)
    }
    init()
  }, [amount])

  const handlePay = async () => {
    const birthInfo = JSON.parse(sessionStorage.getItem("birthInfo") || "{}")
    await widgetRef.current?.requestPayment({
      orderId,
      orderName: "AI 사주풀이",
      successUrl: `${window.location.origin}/payment/success?birthInfo=${encodeURIComponent(JSON.stringify(birthInfo))}`,
      failUrl: `${window.location.origin}/payment/fail`,
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="bg-[#faf8f4] rounded-2xl shadow-lg p-8 max-w-sm w-full border border-[#e4ddd3]">
        <div className="mb-6">
          <p className="text-xs tracking-[0.3em] text-[#a5603f] font-medium mb-2">결제</p>
          <h1 className="font-serif text-2xl font-black">AI 사주풀이</h1>
        </div>

        <div className="bg-white rounded-xl border border-[#e4ddd3] p-4 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-[#6b7280]">AI 사주 풀이 (1회)</span>
            <span className="font-semibold">19,900원</span>
          </div>
        </div>

        <div id="payment-widget" className="mb-4" />
        <div id="agreement-widget" className="mb-6" />

        <button
          onClick={handlePay}
          disabled={!ready}
          className="w-full bg-[#1b2a3a] text-[#f3ede4] py-3.5 rounded-xl font-semibold text-sm hover:bg-[#2a3f55] transition-colors disabled:opacity-50"
        >
          {ready ? "19,900원 결제하기" : "결제 준비 중..."}
        </button>
      </div>
    </main>
  )
}

export default function PaymentPage() {
  return (
    <Suspense>
      <PaymentContent />
    </Suspense>
  )
}
