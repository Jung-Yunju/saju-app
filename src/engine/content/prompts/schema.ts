// 출력 JSON 스키마 조각 (P4-03) — 담당: 콘텐츠 작가
// 생성기는 이 스키마로 구조화 출력을 강제한다. 여러 모델·SDK에서 같이 쓰이도록 좁은 부분집합만 쓴다:
//   type(object·array·string·integer·boolean), properties, required(모든 칸), additionalProperties:false, items, enum, description.
//   길이·개수 제한(maxLength, maxItems, minimum 등)은 구조화 출력에서 지원이 고르지 않아 쓰지 않고 description에 적는다.
// 칸 이름은 검증기(src/engine/verify)가 이미 아는 이름과 맞췄다:
//   body·text = 서술(바넘 비율 검사 대상), letter·ganzhi = 간지 칸, year·years = 문맥 연도, <b>는 body에서만 허용.

export type JsonSchema = Record<string, unknown>

export function str(description: string): JsonSchema {
  return { type: "string", description }
}

export function int(description: string): JsonSchema {
  return { type: "integer", description }
}

export function enumStr(values: readonly string[], description: string): JsonSchema {
  return { type: "string", enum: [...values], description }
}

export function arr(items: JsonSchema, description: string): JsonSchema {
  return { type: "array", items, description }
}

/** 모든 칸 필수 + 정의 밖 칸 금지. 비울 수 있는 칸은 description에 "없으면 빈 문자열"이라고 적는다 */
export function obj(properties: Record<string, JsonSchema>, description?: string): JsonSchema {
  return {
    type: "object",
    ...(description ? { description } : {}),
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }
}

// ─────────────────────────────── 장마다 쓰는 공통 칸

export const TITLE = str("이 사람의 글자로 그린 장 제목. 20자 이내. 그림 말로 쓰고, 근거 글자 한자는 괄호로만. 공포·과장 낱말 금지")
export const SUB = str("부제. 30자 이내. 어떤 글자를 보고 쓴 장인지 그림 말로 한 줄")

export function chips(howMany: string): JsonSchema {
  return arr(
    obj({
      letter: str("사실표에 있는 한자 글자만. 한 글자(예: 酉), 기둥(예: 乙酉), 관계 두 글자(예: 子午)"),
      pos: str("사실표의 위치 코드 그대로(예: day.branch). 관계면 +로 잇는다(예: year.branch+day.branch). 운 글자면 사실표에 적힌 운 위치 코드"),
      label: str("그림 말 한 줄. 20자 이내. 용어보다 그림 말이 먼저. 예: '곁자리 한가을 쇠 · 나를 다듬는 가위'"),
    }),
    `근거 칩 ${howMany}개. 본문에서 실제로 근거로 쓴 글자만`,
  )
}

export function body(paragraphs: string): JsonSchema {
  return arr(
    str("문단 하나. 2~4문장, 문장은 50자 안팎(길어도 70자). 그림 말이 먼저, 명리 용어는 문단에 하나까지 뒤 괄호로. 판정 문장마다 근거를 문장 안에 남긴다(처음엔 '한가을 쇠(유 酉)', 다시 나오면 '그 쇠 기운'). 강조는 <b></b>만"),
    `본문 문단 ${paragraphs}`,
  )
}

export const TODO = str("바꿔 볼 것 — 오늘부터 해 볼 실천 한 문장. 40자 이내. 이 사람의 근거 글자에서 나온 구체적 행동(언제·무엇을). 효과 단정·물건·색·방향 없이")
export const ASK = str("너에게 묻는 말 한 문장. 40자 이내. 읽는 사람이 자기 삶에 비춰 답할 수 있는 물음")
export const CAVEAT = str("이 장에서 밝힐 불확실성 한 줄(엔진 경고·태어난 시 모름 등). 밝힐 것이 없으면 빈 문자열")

/** 얼굴 세 가지(기존 원칙 6) */
export const THREE_FACES = obj(
  {
    best: str("잘 오면 어떤 얼굴인지 한 문장. 40자 이내"),
    half: str("반쯤 오면 어떤 얼굴인지 한 문장. 40자 이내"),
    worst: str("잘못 오면 어떤 얼굴인지와 미리 할 일 한 문장. 50자 이내. 공포·병명·사고·이별 단정 금지"),
  },
  "같은 글자가 올 수 있는 얼굴 세 가지. '좋을 수도 나쁠 수도'처럼 빠져나가지 말고 장면으로",
)
