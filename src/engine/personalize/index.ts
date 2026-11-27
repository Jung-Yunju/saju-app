export * from "./types"
export { SURVEY_QUESTIONS, getQuestion, questionsForProduct, validateAnswers } from "./survey"
export {
  LIFE_STAGES, ERA_EVENTS, koreanDateOf, manAge, lifeStageOfAge, stagesInAgeRange, locateDaeun, eraBackgroundOf,
} from "./life-stage"
export { buildUserFacts, answersToUserFacts } from "./user-facts"
export { linkFactToChart, linkFactsToChart } from "./lived-link"
export type { TenGodGroup, GroupCounts, LinkKind, LivedLink } from "./lived-link"
export { buildPersonalContext, GUARDS, MIN_SURVEY_AGE } from "./context"
