// 규칙 엔진 버전. 규칙 계산 결과(표·판정·출력 구조)가 바뀌면 올리고 CHANGELOG에 기록한다.
// 0.1.0: 공망(xunKongOf) · 0.2.0: analyzeRules(지장간·십성·12운성·합충형파해·공망 hits·오행 분포)
// 0.3.0: P3-06 신강약·격국·용신·간이 조후·기세 + D-019(두 글자 관계를 지우지 않고 subsumedBy 표시)
// 0.3.1: Q-306-1 신강약 표시 score 반올림을 정수 산술로(0.5125 → 51.3). 판정·ratio는 그대로
// 0.4.0: 명세 정정(2026-11-28, D-022 — docs/knowledge/reviews/2026-11-28-p306-decisions.md E1~E8). 출력 호환 깨짐:
//        격국 상신·꺼림 hiddenOnly → hiddenPositions(값 같음) + presence 추가 · tableSensitive를 {선택 표, kr, cn} 비교로 바꾸고
//        세 표 비교는 tableSensitiveIncludingMainOnly(신강약·격국) · 옵션 earthRokgeop("luTable" 예약 → EngineInputError)·
//        tonggwanMinShare·tonggwanMinRatio 추가(기본값 결과 불변, 통관 basis values에 기준값 기록)
export const RULES_ENGINE_VERSION = "rules@0.4.0"
