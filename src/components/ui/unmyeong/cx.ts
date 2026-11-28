/** 클래스 이름 합치기(빈 값·false 제거) */
export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ")
