// U-03 독립 검증(품질검증 담당) — 화면 출생지 20곳 경도(PLACES) ↔ 공개 좌표 대조 (2026-11-27 웹 검색)
// 기준: 시청(도청 소재 시는 시청) 건물 좌표. 건물 좌표를 못 찾은 곳은 바로 옆 "시청역"·동(洞) 중심 또는 도시 중심 좌표로 대신했고 kind에 적었다.
// 한계: 위키백과(ko/en)·위키데이터는 이 작업 환경에서 접속이 막혀 원문을 열지 못했다. 아래 값은 검색 결과에 나온 수치다.
// 경도 0.05도 = 진태양시 0.2분(12초). 0.05도 이상 차이 나면 보고 대상.
import { describe, expect, it } from "vitest"
import { PLACES } from "@/app/input/build-request"

type Ref = { lon: number; kind: "시청 건물" | "시청역(인접)" | "시청 소재 동 중심" | "도시 중심"; src: string; alt?: { lon: number; kind: string; src: string } }
const REFERENCE: Record<string, Ref> = {
  서울: { lon: 126.9778222, kind: "시청 건물", src: "https://Www.wikipedia.org/wiki/Seoul_City_Hall (37°33′59.06″N 126°58′40.16″E, 검색 결과 인용)" },
  부산: { lon: 129.0767, kind: "시청역(인접)", src: "https://en.wikipedia.com/wiki/City_Hall_Station_(Busan) (35°10′47″N 129°04′36″E)" },
  대구: { lon: 128.6017, kind: "도시 중심", src: "https://wikiwand.com/en/articles/Taegu,_Korea (35°52′18″N 128°36′06″E — 시청 본관 소재 중구 일대)" },
  인천: { lon: 126.70221, kind: "시청역(인접)", src: "https://en.wikipedia.com/wiki/Incheon_City_Hall_station (37°27′26″N 126°42′08″E)" },
  광주: {
    lon: 126.848713, kind: "시청역(인접)", src: "https://en.wikipedia.org/wiki/Sangmu_station (35°08′48″N 126°50′55″E, 시청 소재 서구 치평동 인근)",
    alt: { lon: 126.91556, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/gwangju" },
  },
  대전: { lon: 127.3867, kind: "시청역(인접)", src: "https://mobileapps.wikiwand.com/en/City_Hall_station_(Daejeon_Metro) (36°21′05″N 127°23′12″E)" },
  울산: { lon: 129.307, kind: "시청 소재 동 중심", src: "https://mdwiki.org/wiki/Sinjeong-dong,_Ulsan (35°32′28″N 129°18′25″E)" },
  세종: { lon: 127.282234, kind: "도시 중심", src: "https://wikiwand.com/en/articles/Sejong_City (36.487002°N 127.282234°E)" },
  수원: { lon: 127.030673, kind: "시청역(인접)", src: "https://en.wikipedia.org/wiki/Suwon_City_Hall_station (37°15′43″N 127°01′50″E)" },
  춘천: { lon: 127.73417, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/chuncheon" },
  강릉: { lon: 128.87239, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/gangneung" },
  원주: {
    lon: 127.92083, kind: "도시 중심", src: "https://en.wikipedia.org/wiki/Wonju (37°20′30″N 127°55′15″E, 검색 결과 인용)",
    alt: { lon: 127.94528, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/wonju" },
  },
  청주: {
    lon: 127.48972, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/cheongju-si",
    alt: { lon: 127.4992, kind: "충북도청", src: "https://www.geodatos.net/en/coordinates/south-korea/cheongju-si (도청 36°38'30\"N 127°29'57\"E, 검색 결과 인용)" },
  },
  전주: { lon: 127.14889, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/jeonju" },
  목포: { lon: 126.39181, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/mokpo" },
  여수: { lon: 127.66215, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/yeosu" },
  포항: { lon: 129.36481, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/pohang" },
  안동: { lon: 128.72275, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/andong" },
  창원: { lon: 128.68111, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/changwon" },
  제주: { lon: 126.52194, kind: "도시 중심", src: "https://www.geodatos.net/en/coordinates/south-korea/jeju-city" },
}

describe("출생지 경도 대조", () => {
  it("PLACES 20곳 모두 대조값이 있고, 차이가 0.05도(12초) 미만", () => {
    expect(PLACES.map(p => p.name).sort()).toEqual(Object.keys(REFERENCE).sort())
    const lines: string[] = []
    let max = 0
    for (const p of PLACES) {
      const r = REFERENCE[p.name]
      const diff = p.longitude - r.lon
      max = Math.max(max, Math.abs(diff))
      const sec = Math.abs(diff) * 4 * 60
      lines.push(`${p.name}\t${p.longitude.toFixed(3)}\t${r.lon.toFixed(4)}(${r.kind})\t${diff >= 0 ? "+" : ""}${diff.toFixed(4)}°\t${sec.toFixed(1)}초` +
        (r.alt ? `\t[참고 ${r.alt.kind} ${r.alt.lon.toFixed(4)}: ${(p.longitude - r.alt.lon).toFixed(4)}°]` : ""))
      expect(Math.abs(diff), p.name).toBeLessThan(0.05)
    }
    console.log(`[U-03 QA] 경도 대조 (최대 차이 ${max.toFixed(4)}° = ${(max * 240).toFixed(1)}초)\n` + lines.join("\n"))
  })
  it("영향: 최대 차이로도 표준시 UTC+9에서 시진 대표 시각은 20곳 모두 시지 경계에서 50분 넘게 떨어져 있어 경도 오차(수 초)로 시지가 바뀌지 않는다", () => {
    // 표준시 UTC+9에서 대표 시각(짝수 시+30분)의 보정 후 위치 = 30 + (4×경도 − 540)분. 경계(홀수 정시)까지 최소 거리
    for (const p of PLACES) {
      const corr = 4 * p.longitude - 540
      const pos = 30 + corr + 60 // 시지 시작(홀수 정시)으로부터 분
      const dist = Math.min(pos, 120 - pos)
      expect(dist, p.name).toBeGreaterThan(50)
    }
  })
})
