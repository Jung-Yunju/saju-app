import { bokjaInner } from "./bokja"

export function Bokja({ className, edge = "#fffaf2", label = "꾸벅꾸벅 조는 고양이 복자" }: { className?: string; edge?: string; label?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 90" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: bokjaInner(edge) }} />
  )
}
