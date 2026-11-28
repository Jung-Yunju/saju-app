// 사주 발현 분석 엔진(expression@0.1.0, D-035) 공개 API. 계약: docs/redesign/30-expression-engine.md
// 명리 규칙: docs/knowledge/personalization/expression-dimensions.md · 유지관리: docs/knowledge/personalization/expression-engine.md
export * from "./types"
export { buildExpressionReport } from "./engine"
export type { ExpressionInput, ExpressionOptions } from "./engine"
export { parseMbtiInput, mbtiFromUserFacts, selfReportFromUserFacts, factLinkOf, styleHintsOf, LIVED_LINK_GROUP } from "./self-report"
export type { MbtiAxisChoice, MbtiAxesInput, MbtiParseResult } from "./self-report"
export {
  expressionTables, makeExpressionTables, validateDimensionTable, validateMbtiBridge, findForbiddenPhrases,
  expressionTablesHash, ExpressionTableError, EXPRESSION_FORBIDDEN_PHRASES, MBTI_AXES, MBTI_POLES, MBTI_LOW_ALLOWED, MBTI_SIGNAL_AXES,
} from "./tables"
export type { ExpressionTables } from "./tables"
export { LEVEL_RULE_IDS, potentialsOf, deriveChart } from "./chart-rules"
export type { ChartDerived } from "./chart-rules"
