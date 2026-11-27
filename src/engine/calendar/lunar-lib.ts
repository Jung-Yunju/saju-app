// lunar-javascript(6tail, v1.7.x) 최소 타입 래퍼.
// 이 라이브러리는 타입 선언을 제공하지 않으므로, 엔진이 쓰는 기능만 여기서 타입을 붙인다.
// 주의: 라이브러리의 모든 "시각"은 중국 표준시(UTC+8, 北京时间) 기준이다.
//       절기 시각은 반드시 solarterms.ts 의 변환을 거쳐 UTC로만 다룬다.
// 주의: 라이브러리 농력(農曆)은 중국 음력(UTC+8 날짜 판정)이라 한국 음력과 다를 수 있다.
//       엔진은 농력 날짜를 쓰지 않고, 천문 계산(절기·합삭 시각)만 쓴다(lunar.ts 참고).

// @ts-expect-error lunar-javascript 패키지는 .d.ts를 제공하지 않는다(아래 인터페이스로 최소 타입 부여)
import lunarJs from "lunar-javascript"

export interface LibSolar {
  getYear(): number
  getMonth(): number
  getDay(): number
  getHour(): number
  getMinute(): number
  getSecond(): number
  getLunar(): LibLunar
  toYmdHms(): string
}

export interface LibLunar {
  getYear(): number
  /** 윤달이면 음수 */
  getMonth(): number
  getDay(): number
  getSolar(): LibSolar
  /** 키: 절기명(간체자, 일부는 병음 대문자), 값: 북경시 Solar */
  getJieQiTable(): Record<string, LibSolar>
}

export interface LibShouXing {
  /** 日月黄经差 w(라디안)가 되는 순간. J2000 기준 역학시(TT) 율리우스 세기, 정밀식 */
  msaLonT(w: number): number
  /** ΔT(=TT−UT, 일). 인수: J2000 기준 일수 */
  dtT(t: number): number
}

interface LunarJsModule {
  Lunar: { fromYmd(y: number, m: number, d: number): LibLunar }
  ShouXingUtil: LibShouXing
}

export const lunarLib = lunarJs as unknown as LunarJsModule
