import Anthropic from "@anthropic-ai/sdk"
import { SajuInputData } from "@/lib/saju-input"

const client = new Anthropic()

// ─── 시스템 프롬프트 (공유받은 파일 그대로) ───────────────────────────────
const SYSTEM_PROMPT = `너는 사주명리 풀이를 쓰는 사람이다. 이 풀이의 목적은 앞날을 맞히는 것이 아니라, 읽는 사람이 자기 삶의 결정을 스스로 내리도록 돕는 것이다. 사주는 날씨 예보와 같고, 우산을 챙길지는 읽는 사람이 정한다. 이 태도가 모든 문장에 배어 있어야 한다.

여덟 글자, 대운, 공망, 올해 간지는 입력으로 주어진다. 네가 다시 계산하지 말고 주어진 글자를 그대로 써라. 십성, 합·충·형·파·해, 신살(천을귀인, 역마, 도화, 화개, 문창 등)은 주어진 글자에서 네가 뽑는다. 뽑기 전에 일간을 기준으로 여덟 글자의 십성과 오행 개수를 먼저 정리하고, 그 표에 없는 글자를 근거로 삼지 마라.

[원칙 1. 지나온 길을 먼저 맞혀 본다]
앞날을 말하기 전에, 이 사람의 지난 삶에 대해 가려 볼 수 있는 단정 여섯 가지를 쓴다. 읽는 사람이 "맞다" 또는 "아니다"로 답할 수 있어야 한다.
- 각 단정은 특정한 해나 시기, 일어난 일, 근거 글자를 갖는다. "힘든 시기가 있었다"처럼 누구에게나 맞는 말은 단정이 아니다. "2015년에 사는 곳이나 학교가 바뀌었다"가 단정이다.
- 여섯 가지는 서로 다른 글자에 걸어라. 대운에서 하나 이상, 세운의 충·합·형에서 셋 이상을 고른다.
- 여섯 가운데 하나는 시주에만 걸린 단정으로 쓴다. 이것이 태어난 시가 맞는지 가리는 문항이다. hour_unknown이면 이 문항을 빼고 다섯 가지만 쓴다.
- 각 단정에는 맞았을 때와 틀렸을 때의 한 줄 판정을 붙인다.
- 시주 문항이 틀렸을 때의 판정은 "태어난 시가 다를 수 있다. 사주는 생년월일시가 정확한 데서 시작한다"로 쓴다.

[원칙 2. 미리 들은 사실로 맞히지 않는다]
known_facts에 든 사실은 단정으로 쓰지 않는다.

[원칙 3. 누구에게나 맞는 말은 쓰지 않는다]
모든 문장은 이 사람의 글자에서 나와야 하고, 어느 글자에서 나온 말인지 문장 안에 밝힌다.

[원칙 4. 같은 글자도 나이와 시대에 따라 다르게 일한다]
십성을 사전 뜻 그대로 옮기지 말고, 그 글자가 온 때의 나이와 태어난 세대의 사정으로 옮겨라.

[원칙 5. 옛 책의 도덕 판정을 걷어 낸다]
고전의 길흉과 품행 판정은 그 시대의 잣대다. 글자의 작용은 남기고 판정은 지금의 말로 바꾼다.

[원칙 6. 글자의 얼굴을 하나로 못 박지 않는다]
대운과 큰 글자는 얼굴 세 가지를 나란히 적고 "네겐 어느 얼굴로 왔느냐"고 묻는다.

[원칙 7. 정해 주지 않고 고르는 기준을 준다]
이 사람의 글자에서 나오는 갈림길 세 가지를 쓴다.

[원칙 8. 겁주지 않고, 할 수 있는 일을 적는다]
약해지는 곳을 말할 때는 반드시 미리 할 수 있는 일을 같이 적는다.

[원칙 9. 틀릴 수 있음을 숨기지 않는다]
이 풀이는 전통 명리 이론에 따른 해석이고 검증된 예측이 아니다.

[다루지 않는 것]
죽음, 사고, 중병, 이혼, 파산의 시기를 예언하지 않는다. 몸에 관한 말은 체질의 기울기까지만 쓰고, 병 이름을 짚지 않는다. 투자 종목, 복권, 시험 합격 여부는 답하지 않는다.

[말투]
voice가 "할미"이면 할머니가 손주에게 말하듯 쓴다. 이름을 부르고("○○아"), "~야", "~거든", "~해라", "~느냐"로 맺는다. 따뜻하되 할 말은 한다. 어느 쪽이든 문장은 짧게, 한자 글자는 한글 읽기와 함께 "유(酉)"처럼 쓰고, 명리 용어는 처음 나올 때 풀어 준다. 꾸미는 말과 뻔한 위로는 넣지 않는다.

[출력]
사용자 메시지가 지정한 JSON 형식으로만 답한다. JSON 밖에 다른 글을 쓰지 않는다.`

// ─── 1차 호출: 과거 검증 단정 6가지 ─────────────────────────────────────
export interface Claim {
  id: string
  when: string
  claim: string
  basis: string
  era: string
  letter: string
  is_hour_test: boolean
  if_yes: string
  if_no: string
}

export interface DictEntry {
  letter: string
  role: string
  years: number[]
  next: number
  question: string
}

export interface ClaimsResult {
  chart_summary: string
  cover_title: string
  claims: Claim[]
  dictionary: DictEntry[]
}

export async function generateClaims(sajuInput: SajuInputData): Promise<ClaimsResult> {
  const userPrompt = `아래 사람의 지나온 길을 가려 볼 단정 여섯 가지를 써라.

<입력>
${JSON.stringify(sajuInput, null, 2)}
</입력>

다음 형식의 JSON으로만 답하라.
{
  "chart_summary": "여덟 글자를 한 장면으로 그린 두 문장",
  "cover_title": "표지에 쓸 열 자 안팎의 별칭",
  "claims": [
    {
      "id": "p1",
      "when": "시기. 예: 2015년 · 중학교 2학년",
      "claim": "단정 한두 문장",
      "basis": "근거 글자 한두 문장",
      "era": "그때 세상은 한 줄. 모르면 빈 문자열",
      "letter": "글자 딱지. 예: 丑未충",
      "is_hour_test": false,
      "if_yes": "맞았을 때 판정 한 줄",
      "if_no": "틀렸을 때 판정 한 줄"
    }
  ],
  "dictionary": [
    {"letter": "卯", "role": "이 사람에게 이 글자가 하는 일", "years": [2011, 2023], "next": 2035, "question": "그해에 무엇을 물어볼지"}
  ]
}`

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  })

  console.log("[generateClaims] stop_reason:", res.stop_reason, "blocks:", res.content.map(b => b.type))
  const text = res.content.find(b => b.type === "text")?.text ?? ""
  console.log("[generateClaims] raw text length:", text.length)
  if (!text) {
    console.error("[generateClaims] 전체 content:", JSON.stringify(res.content).substring(0, 500))
    throw new Error("Claude가 빈 응답을 반환했습니다.")
  }
  // 코드펜스 제거 후 첫 번째 {...} 블록 추출
  const stripped = text.replace(/^```json\s*/m, "").replace(/\s*```$/m, "").trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) {
    console.error("[generateClaims] 파싱 불가 응답:", text.substring(0, 500))
    throw new Error("Claude 응답에서 JSON을 찾을 수 없습니다.")
  }
  try {
    return JSON.parse(match[0]) as ClaimsResult
  } catch (parseErr) {
    console.error("[generateClaims] JSON.parse 실패, stop_reason:", res.stop_reason)
    console.error("[generateClaims] 응답 일부:", text.substring(0, 500))
    if (res.stop_reason === "max_tokens") throw new Error("응답이 너무 길어 잘렸습니다. 다시 시도해 주세요.")
    throw parseErr
  }
}

// ─── 2차 호출: 본 풀이 ───────────────────────────────────────────────────
export type AnswerMap = Record<string, "맞다" | "아니다" | "모름">

export interface Chapter {
  key: string
  title: string
  sub: string
  chips: { letter: string; element: string; label: string }[]
  body: string[]
  todo: string
  ask: string
}

export interface Part {
  title: string
  chapters: Chapter[]
}

export interface Fork {
  title: string
  sub: string
  left: { name: string; gain: string; loss: string }
  right: { name: string; gain: string; loss: string }
  criteria: string[]
  rule: string
  todo: string
  ask: string
}

export interface YearEntry {
  year: number
  ganzhi: string
  element: string
  title: string
  text: string
}

export interface ReviewEntry {
  id: string
  after: string
  claim: string
  basis: string
}

export interface FullReading {
  reliability_note: string
  quote: string
  parts: Part[]
  forks: Fork[]
  years: YearEntry[]
  review: ReviewEntry[]
  closing: {
    points: { title: string; text: string }[]
    last_words: string
  }
}

export async function generateFullReading(
  sajuInput: SajuInputData,
  claims: Claim[],
  answers: AnswerMap,
): Promise<FullReading> {
  const userPrompt = `아래 사람의 본 풀이를 써라. 지나온 길의 답을 반영하라.

<입력>
${JSON.stringify(sajuInput, null, 2)}
</입력>

<지나온_길>
${JSON.stringify(claims, null, 2)}
</지나온_길>

<답>
${JSON.stringify(answers)}
</답>

답을 이렇게 반영하라.
- "아니다"인 글자에 걸린 풀이는 줄이거나 빼고, 뺐다고 밝혀라.
- "맞다"인 글자는 앞으로의 풀이에서 근거로 쓰고, 그 글자가 다시 오는 해를 짚어라.
- 시주 문항이 "아니다"이면 시주에 걸린 풀이를 모두 보류하고, 태어난 시를 다시 확인하라고 맨 앞에 적어라.
- 맞은 것이 절반이 안 되면 그 사실을 먼저 말하고, 전체를 가볍게 들으라고 적어라.
- body 문단에 "p1", "p2", "p3" 같은 단정 ID를 절대 쓰지 마라. ID는 내부 참조용이고 읽는 사람은 모른다.
- "맞다"인 단정은 그 단정의 when·claim 내용을 풀이 본문에 직접 녹여 써라. 예: 단정이 "2015년에 사는 곳이 바뀌었다"이고 맞았다면, "그 해 이사했다고 했지, 그게 丙午 대운이 열린 신호였다"처럼 구체적인 내용을 가져와라. "앞서 맞힌 것처럼"처럼 뭉뚱그리지 마라.

다음 형식의 JSON으로만 답하라. 모든 장(chapter)은 같은 꼴이다.
{
  "reliability_note": "답을 본 뒤의 한두 문장",
  "quote": "표지 하단에 들어갈 운명 인용구. 이 사람의 중심 상징(일간·중심 오행)을 녹인 한두 문장. 명언처럼 간결하게.",
  "parts": [
    {
      "title": "타고난 나",
      "chapters": [
        {
          "key": "뼈대",
          "title": "장 제목. 이 사람만의 장면으로",
          "sub": "부제",
          "chips": [{"letter": "乙酉", "element": "metal", "label": "칼날 위의 꽃 · 섬세하고 깔끔하다"}],
          "body": ["문단. 중요한 구절은 <b></b>로 감싼다", "문단"],
          "todo": "오늘부터 할 일 한 문장",
          "ask": "너에게 묻는 말 한 문장"
        }
      ]
    }
  ],
  "forks": [
    {
      "title": "갈림길 제목",
      "sub": "어떤 글자를 가진 사람의 갈림길인지",
      "left":  {"name": "", "gain": "", "loss": ""},
      "right": {"name": "", "gain": "", "loss": ""},
      "criteria": ["예/아니오 물음", "예/아니오 물음", "예/아니오 물음"],
      "rule": "기준에 따른 한 줄 권고",
      "todo": "", "ask": ""
    }
  ],
  "years": [
    {"year": 2026, "ganzhi": "丙午", "element": "fire", "title": "여덟 자 안팎의 이름", "text": "약해지는 곳과 미리 할 일. 두 문장"}
  ],
  "review": [
    {"id": "r1", "after": "2026년을 보내고", "claim": "일 년 뒤에 가려 볼 단정", "basis": "근거 글자"}
  ],
  "closing": {
    "points": [{"title": "", "text": ""}, {"title": "", "text": ""}, {"title": "", "text": ""}],
    "last_words": "마지막 말 세 문장 안팎"
  }
}

parts는 이 순서로 쓴다.
1. "타고난 나": 뼈대, 가장 큰 힘, 가장 큰 구멍, 살과 귀인 (4장)
2. "앞으로": 지금 10년(얼굴 셋), 다음 10년, 몸 (3장)
years는 올해부터 여섯 해. review는 올해부터 세 해. forks는 세 개.
element는 wood, fire, earth, metal, water 가운데 하나.
body의 문단은 장마다 둘이나 셋, 문단 하나는 두세 문장.`

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  })

  console.log("[generateFullReading] stop_reason:", res.stop_reason)

  const text = res.content.find(b => b.type === "text")?.text ?? ""
  console.log("[generateFullReading] raw text length:", text.length)
  if (!text) throw new Error("Claude가 빈 응답을 반환했습니다.")
  const stripped = text.replace(/^```json\s*/m, "").replace(/\s*```$/m, "").trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) {
    console.error("[generateFullReading] 파싱 불가 응답:", text.substring(0, 300))
    throw new Error("Claude 응답에서 JSON을 찾을 수 없습니다.")
  }
  return JSON.parse(match[0]) as FullReading
}
