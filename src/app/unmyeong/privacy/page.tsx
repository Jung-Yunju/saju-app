import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "개인정보 처리 안내 · 운명비서" }

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px 64px", fontSize: 16, lineHeight: 1.8, wordBreak: "keep-all" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>개인정보 처리 안내</h1>
      <p><strong>법률 검토 전 초안이란다.</strong> 정식 방침은 검토를 마친 뒤 바뀔 수 있다.</p>
      <h2 style={{ fontSize: 18, marginTop: 24 }}>무료 풀이</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li>생년월일·성별·출생지는 풀이를 셈하는 데만 쓰고 저장하지 않는다.</li>
        <li>이름은 서버로 보내지 않는다. 화면에서 너를 부를 때만 쓴다.</li>
        <li>서버 기록(로그)에는 네가 적은 입력값을 남기지 않는다.</li>
        <li>요청을 지나치게 많이 보내는 일을 막으려고 접속 주소(IP)를 잠시 서버 메모리에만 둔다. 약 1분이 지나면 쓸모가 없어지고, 디스크나 데이터베이스에는 쓰지 않는다.</li>
        <li>외부 인공지능(AI) 서비스에는 아무것도 보내지 않는다.</li>
      </ul>
      <p style={{ marginTop: 24 }}>풀이는 재미와 참고를 위한 것이며, 앞날을 과학적으로 맞힌다고 말하지 않는다.</p>
      <p style={{ marginTop: 24 }}><Link href="/unmyeong">운명비서로 돌아가기</Link></p>
    </main>
  )
}
