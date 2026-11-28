// 장 번호 표기: 1 → "第一章" / "첫째 장". 11 이상은 숫자로("제11장").
const HAN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
const KO = ["", "첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째", "일곱째", "여덟째", "아홉째", "열째"]

export function chapterLabels(no: number): { han: string; ko: string } {
  if (Number.isInteger(no) && no >= 1 && no <= 10) return { han: `第${HAN[no]}章`, ko: `${KO[no]} 장` }
  return { han: `第${no}章`, ko: `제${no}장` }
}
