// 운명비서 공통 컴포넌트(D-027) — 스타일은 src/styles/unmyeong.css(레이아웃에서 한 번 import), 글꼴은 src/styles/unmyeong-fonts.ts.
// 모두 "use client" 없이 만든 공용 컴포넌트다(훅은 useId뿐) → 서버·클라이언트 컴포넌트 어디서나 import 가능.
export { UmPage, type UmPageProps } from "./UmPage"
export { UmLedgerPage, type UmLedgerPageProps } from "./UmLedgerPage"
export { UmChapterTitle, type UmChapterTitleProps } from "./UmChapterTitle"
export { UmSealButton, umButtonClass, type UmButtonProps } from "./UmSealButton"
export { UmBrassButton } from "./UmBrassButton"
export { UmField, type UmFieldProps } from "./UmField"
export { UmChoiceGroup, type UmChoiceGroupProps, type UmChoiceOption } from "./UmChoiceGroup"
export { UmFold, type UmFoldProps } from "./UmFold"
export { UmDivider, type UmDividerProps } from "./UmDivider"
export { UmStamp, type UmStampProps } from "./UmStamp"
export { chapterLabels } from "./chapter"
