// 무료 화면 글꼴. 시안 B「등잔 아래 찻상」: 고운 바탕(제목·버튼) + 고운 돋움(본문), 한자는 Noto Serif KR.
// 시안 A로 바꿀 때는 아래를 Hahmlet / IBM_Plex_Sans_KR 로 교체하고 free.css 맨 위 글꼴 매핑 변수 이름만 맞춘다.
import { Gowun_Batang, Gowun_Dodum, Noto_Serif_KR } from "next/font/google"

// preload: false — 한글 글리프가 큰 파일이라 첫 화면 미리 받기를 끄고, 쓰는 글자 조각만 받게 한다.
const display = Gowun_Batang({ weight: ["400", "700"], subsets: ["latin"], preload: false, variable: "--fx-display", display: "swap" })
const body = Gowun_Dodum({ weight: "400", subsets: ["latin"], preload: false, variable: "--fx-body", display: "swap" })
const hanja = Noto_Serif_KR({ weight: ["700"], subsets: ["latin"], preload: false, variable: "--fx-hanja", display: "swap" })

export const fontClassName = `${display.variable} ${body.variable} ${hanja.variable}`
