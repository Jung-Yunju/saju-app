// 운명비서 「펼친 비밀 고서」 부품(D-033) — 스타일 src/styles/unmyeong-book.css(레이아웃에서 unmyeong.css 다음에 한 번 import).
// UmWaxSeal만 "use client"(갈라짐 연출 상태). 나머지는 훅이 useId뿐 → 서버·클라이언트 어디서나.
export { UmStudyBackdrop, type UmStudyBackdropProps } from "./UmStudyBackdrop"
export { UmBook, type UmBookProps } from "./UmBook"
export { UmBookTitle, type UmBookTitleProps } from "./UmBookTitle"
export { UmInkField, UmInkPart, UmInkPartSet, type UmInkFieldProps, type UmInkPartProps } from "./UmInkField"
export { UmInkChoice, type UmInkChoiceProps, type UmInkChoiceOption } from "./UmInkChoice"
export { UmWaxSeal, type UmWaxSealProps } from "./UmWaxSeal"
export { UmChapterHead, type UmChapterHeadProps } from "./UmChapterHead"
export { UmBookPage, type UmBookPageProps } from "./UmBookPage"
