// 임시 대체: 디자인 실장의 src/styles/unmyeong.css · src/components/ui/unmyeong/** · 백엔드의 src/lib/unmyeong/assets.ts가
// 들어오면 이 파일을 지우고 import만 바꾼다. 이름은 계약(UmPage/UmSealButton/UmField/UmFold, assets)과 같다.
// :where() 로 감싸 실제 토큰(.um-root)이 있으면 그쪽이 이기게 했다.
import type { ReactNode, ButtonHTMLAttributes } from "react"

export const assets: {
  intro: { video: { src: string; poster?: string; duration?: number } | null; fallback: "scene" }
} = { intro: { video: null, fallback: "scene" } }

export function UmFallbackStyle() {
  return (
    <style>{`
:where(.um-root){--um-bg:#141310;--um-study:#211C17;--um-wood:#382B21;--um-paper:#C9B898;--um-text:#E2D8C5;--um-brass:#B9A17A;--um-line:#504335;--um-seal:#702F2B;--um-text-ink:#2a2018;
--um-font-title:"Nanum Myeongjo","Noto Serif KR","Batang",serif;--um-font-body:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;
--um-fs-xs:.875rem;--um-fs-sm:1rem;--um-fs-md:1.125rem;--um-fs-lg:1.375rem;--um-fs-xl:1.75rem;--um-fs-2xl:2.25rem;
--um-space-1:4px;--um-space-2:8px;--um-space-3:12px;--um-space-4:16px;--um-space-5:24px;--um-space-6:32px;--um-space-7:48px;--um-space-8:64px;
--um-radius-s:4px;--um-radius-m:8px;--um-shadow-page:0 10px 40px rgba(0,0,0,.55);--um-shadow-lamp:0 0 80px rgba(220,170,90,.25)}
.um-page{background:var(--um-paper);color:var(--um-text-ink);border-radius:var(--um-radius-s);box-shadow:var(--um-shadow-page);
background-image:radial-gradient(ellipse at 20% 10%,rgba(255,255,255,.18),transparent 60%),radial-gradient(ellipse at 90% 100%,rgba(90,60,30,.18),transparent 60%)}
.um-seal-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:56px;padding:12px 20px;border:1px solid #4a1d1a;border-radius:var(--um-radius-m);
background:var(--um-seal);color:#f1e3d0;font:700 var(--um-fs-md)/1.3 var(--um-font-title);cursor:pointer;box-shadow:inset 0 0 0 2px rgba(0,0,0,.18),0 2px 0 rgba(0,0,0,.35)}
.um-seal-btn:disabled{opacity:.6;cursor:default}.um-seal-btn:focus-visible,.um-root a:focus-visible,.um-root button:focus-visible,.um-root input:focus-visible,.um-root select:focus-visible,.um-root summary:focus-visible{outline:3px solid var(--um-brass);outline-offset:2px}
.um-field{margin:0 0 var(--um-space-5);padding:0;border:0;min-width:0}.um-field>legend,.um-field>label.um-label{display:block;padding:0;font:700 var(--um-fs-sm)/1.4 var(--um-font-title);color:var(--um-text-ink);margin-bottom:var(--um-space-2)}
.um-field .um-opt{font-weight:400;opacity:.7;margin-left:6px}
.um-err{margin:var(--um-space-2) 0 0;color:#7a1f18;font:700 var(--um-fs-xs)/1.5 var(--um-font-body)}
.um-fold{margin-top:var(--um-space-2)}.um-fold>summary{display:inline-flex;align-items:center;min-height:44px;cursor:pointer;font:var(--um-fs-xs)/1.4 var(--um-font-body);color:#5a4630;text-decoration:underline}
.um-fold>div{font:var(--um-fs-xs)/1.7 var(--um-font-body);color:#4a3a2a;padding:4px 0 8px}
`}</style>
  )
}

export function UmPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`um-page ${className}`}>{children}</div>
}

export function UmSealButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`um-seal-btn ${props.className ?? ""}`} />
}

export function UmField({ label, optional, error, id, help, children, asGroup }: {
  label: string; optional?: boolean; error?: string; id?: string; help?: ReactNode; children: ReactNode; asGroup?: boolean
}) {
  const inner = (
    <>
      {children}
      {help && <UmFold summary="자세히 보기">{help}</UmFold>}
      {error && <p className="um-err" role="alert" id={id ? `${id}-err` : undefined}>{error}</p>}
    </>
  )
  const lab = <>{label}{optional && <span className="um-opt">(선택)</span>}</>
  return asGroup
    ? <fieldset className="um-field"><legend>{lab}</legend>{inner}</fieldset>
    : <div className="um-field"><label className="um-label" htmlFor={id}>{lab}</label>{inner}</div>
}

export function UmFold({ summary, children }: { summary: string; children: ReactNode }) {
  return <details className="um-fold"><summary>{summary}</summary><div>{children}</div></details>
}
