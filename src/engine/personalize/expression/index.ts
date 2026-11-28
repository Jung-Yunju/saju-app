// 사주 발현 분석 엔진(expression@0.2.0, D-035) 공개 API. 계약: docs/redesign/30-expression-engine.md
// 명리 규칙: docs/knowledge/personalization/expression-dimensions.md · 유지관리: docs/knowledge/personalization/expression-engine.md
export * from "./types"
export { buildExpressionReport } from "./engine"
export type { ExpressionInput, ExpressionOptions } from "./engine"
export {
  parseMbtiInput, mbtiFromUserFacts, selfReportFromUserFacts, factLinkOf, styleHintsOf, LIVED_LINK_GROUP, USER_FACT_ID_PATTERN,
} from "./self-report"
export type { MbtiAxisChoice, MbtiAxesInput, MbtiParseResult } from "./self-report"
export {
  expressionTables, makeExpressionTables, validateDimensionTable, validateMbtiBridge, findForbiddenPhrases, forbiddenHitsOf,
  normalizeForbiddenText, expressionTablesHash, ExpressionTableError, EXPRESSION_FORBIDDEN_PHRASES, EXPRESSION_FORBIDDEN_PATTERNS,
  MBTI_AXES, MBTI_POLES, MBTI_SIGNAL_LINKS, MBTI_SIGNAL_AXES,
} from "./tables"
export type { ExpressionTables, ForbiddenPattern } from "./tables"
export { LEVEL_RULE_IDS, potentialsOf, deriveChart, grainMeasure } from "./chart-rules"
export type { ChartDerived, GrainMeasure } from "./chart-rules"
