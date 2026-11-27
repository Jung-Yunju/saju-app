// 6. MORAL_JUDGEMENT · GENDER_STEREOTYPE — 옛 책의 도덕·성별 판정(원칙 5·8·11)
// 문장 단위 사전. 옛 판정을 "그렇게 읽지 않는다"고 걷어 내는 문장(원칙 5가 시키는 꼴)은 info로 낮춘다:
//   "드세다가 아니라 …", "옛 책은 … 했지만", "그 시대의 잣대", "~라는 말은 …" 등(REFRAME_RE).
import type { Finding, TextSegment } from "../types"
import { excerptAt, splitSentences } from "../text"

interface MoralRule {
  id: string
  code: "MORAL_JUDGEMENT" | "GENDER_STEREOTYPE"
  severity: "block" | "warn"
  re: RegExp
  label: string
}

const WOMAN = "(?:여자|여성|아내|며느리|딸|여자애|계집|처자|부인|새댁)"
const MAN = "(?:남자|남성|사내|남편|아들|사위|가장)"

export const MORAL_RULES: readonly MoralRule[] = [
  // 성별 판정
  { id: "woman-strong", code: "GENDER_STEREOTYPE", severity: "block", label: "여자가 드세다류", re: new RegExp(`${WOMAN}[^.!?]{0,10}(드세|기가 세|기 센|팔자가 세|사납|억세|설친|나댄)|(드센|기 센|기가 센|사나운|억센) ${WOMAN}`) },
  { id: "woman-role", code: "GENDER_STEREOTYPE", severity: "block", label: "여자의 역할 고정", re: new RegExp(`${WOMAN}(는|란|라면|로서|답게)[^.!?]{0,12}(집안일|살림|순종|남편을 (받들|따르|섬기)|내조|참아야|조신)|현모양처|여자 팔자는 뒤웅박|시집 잘 가|남자를 잘 만나야|팔자 고친다|팔자를 고친다`) },
  { id: "man-role", code: "GENDER_STEREOTYPE", severity: "warn", label: "남자의 역할 고정", re: new RegExp(`${MAN}(는|란|라면|로서|답게|가)[^.!?]{0,12}(울면 안|돈을 벌어야|집안을 책임져야|가장 노릇|약한 모습)|남자답지 못|여자 같은 남자|남자 같은 여자`) },
  { id: "woman-no-officer", code: "GENDER_STEREOTYPE", severity: "block", label: "여자 무관·관살 판정", re: /(여자|여성)[^.!?]{0,10}(관|관성|관살|상관|괴강|비겁)[^.!?]{0,8}(많으면|강하면|없으면|있으면)[^.!?]{0,12}(남편|과부|재혼|팔자|드세|박복)/ },
  // 도덕·복 판정
  { id: "fate-strong", code: "MORAL_JUDGEMENT", severity: "block", label: "팔자가 세다·박복", re: /팔자가 (세|드세|사납|기구|박하|나쁘|사나)|센 팔자|드센 팔자|기구한 (팔자|운명)|박복|복이 박|팔자가 (사납|기구)/ },
  { id: "spouse-luck", code: "MORAL_JUDGEMENT", severity: "block", label: "배우자·부모·자식 복 판정", re: /(남편|아내|부인|처|배우자|부모|자식|자녀|형제|윗사람)\s?(복|덕)이 (없|박하|약하|모자라)|(남편|아내|처|배우자|자식)\s?복이 많|(남편|아내|처)을? 잡아먹|(극부|극처|상부|상처할|과부 팔자|홀아비 팔자|과부가 될|과부 될)/ },
  { id: "marriage-fate", code: "MORAL_JUDGEMENT", severity: "block", label: "결혼·재혼 팔자 판정", re: /(결혼을? 못 할|결혼 못 할|시집을? 못|장가를? 못|두 번 결혼|재혼할 팔자|이혼할 팔자|혼자 살 팔자|독수공방|외로울 팔자|고독한 팔자|첩이 될|첩살이|소실)/ },
  { id: "lust", code: "MORAL_JUDGEMENT", severity: "block", label: "음란·바람기 판정", re: /(음란|색을 밝|바람기|바람둥이|화냥|헤프|이성 문제가 끊이지|도화[^.!?]{0,8}(바람|이성 문제|색정|문란))/ },
  { id: "low-character", code: "MORAL_JUDGEMENT", severity: "block", label: "천하다·못됐다류 품성 판정", re: /(천한 (사주|팔자|사람)|천박|못된 (성격|사주|팔자)|성격이 (나쁘|못됐|더럽)|인덕이 없|재수가 없|살이 끼었|흉한 사주|나쁜 사주|독한 팔자|악한 기운)/ },
  { id: "bad-luck-label", code: "MORAL_JUDGEMENT", severity: "warn", label: "나쁜 운·흉한 해 낙인(원칙 8)", re: /(나쁜 운|흉한 (해|운|시기)|흉운|악운|운이 나쁜 해|최악의 해|재앙)/ },
  { id: "stubborn", code: "MORAL_JUDGEMENT", severity: "warn", label: "고집 낙인(원칙 11)", re: /고집(이|이가)? (세|세다|불통|쟁이)|고집불통|고집쟁이|드세다|드센 편/ },
]

/** 옛 판정을 걷어 내는 문장 표지 */
export const REFRAME_RE = /(가 아니라|이 아니라|는 말이 아니|란 말이 아니|아니다|아니야|아냐|그 시대|옛 잣대|옛날 잣대|시대의 잣대|옛 책은|옛 책에서는|옛날 책|옛사람|옛 어른들은|예전엔|옛날엔|이라지만|라지만|라고들 하지만|라고 했던|던 말|잣대|걷어)/

export function checkMoral(segments: TextSegment[]): Finding[] {
  const out: Finding[] = []
  for (const seg of segments) {
    const sentences = splitSentences(seg.text)
    sentences.forEach((s, si) => {
      const loc = sentences.length > 1 ? { ...seg.location, sentence: si } : seg.location
      const reframed = REFRAME_RE.test(s.text)
      for (const r of MORAL_RULES) {
        const m = r.re.exec(s.text)
        if (!m) continue
        out.push({
          severity: reframed ? "info" : r.severity,
          code: r.code,
          location: loc,
          excerpt: excerptAt(s.text, m.index, m[0].length),
          rule: r.id,
          message: reframed
            ? `${r.label} 표현이 있으나 옛 판정을 걷어 내는 문장으로 보임 — 사람 확인 권장`
            : `${r.label}: 옛 책의 도덕·성별 판정은 지금의 말로 바꿔야 함(원칙 5·8·11)`,
        })
      }
    })
  }
  return out
}
