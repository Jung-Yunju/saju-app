// 운명비서 「펼친 비밀 고서」 부품 견본(D-033) — 실제 컴포넌트를 서버 렌더해 정적 HTML로 굳힌다.
// 만들기: node design/unmyeong/tools/build-book-preview.mjs  → design/unmyeong/book-preview*.html
// (견본 글은 예시다. 실제 화면 문안·흐름은 프론트엔드·콘텐츠 담당.)
import { renderToStaticMarkup } from "react-dom/server"
import fs from "node:fs"
import path from "node:path"
import {
  UmStudyBackdrop, UmBook, UmBookTitle, UmInkField, UmInkPart, UmInkChoice, UmWaxSeal, UmBookPage,
} from "../../../src/components/ui/unmyeong/book"

const [OUT, FONT_MODE = "google", ROOT_ARG] = process.argv.slice(2)
const ROOT = ROOT_ARG ?? path.resolve(path.dirname(OUT), "../..")
const rel = (p: string) => path.relative(path.dirname(OUT), path.join(ROOT, p)).split(path.sep).join("/")
// 이 파일은 design/unmyeong/ 에 놓인다 — CSS의 /unmyeong/… 주소를 public/ 상대 경로로 바꿔 file:// 로도 열리게
const fix = (css: string) => css.replace(/url\("\/unmyeong\//g, `url("${rel("public/unmyeong")}/`)
const css = fix(fs.readFileSync(path.join(ROOT, "src/styles/unmyeong.css"), "utf8")) + "\n" + fix(fs.readFileSync(path.join(ROOT, "src/styles/unmyeong-book.css"), "utf8"))

function fontCss() {
  if (FONT_MODE !== "next") {
    return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Serif+KR:wght@400;700;800&family=Noto+Sans+KR:wght@400;700&display=swap">`
  }
  // 개발 PC 확인용: 빌드 산출물(.next)에 받아 둔 같은 글꼴 조각을 그대로 쓴다(인터넷 없이)
  const dir = path.join(ROOT, ".next/static/chunks")
  const want = /font-family:(Nanum Myeongjo|Noto Serif KR|Noto Sans KR);/
  const faces = new Set<string>()
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".css"))) {
    for (const m of fs.readFileSync(path.join(dir, f), "utf8").match(/@font-face\{[^}]*\}/g) ?? []) if (want.test(m)) faces.add(m)
  }
  return `<style>${[...faces].join("\n").replace(/url\(\.\.\/media\//g, `url(${rel(".next/static/media")}/`)}</style>`
}

const head = (title: string, extra = "") => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>${fontCss()}
<style>${css}
html,body{margin:0;background:#141310}
.um-root{--um-ff-title:"Nanum Myeongjo";--um-ff-hanja:"Noto Serif KR";--um-ff-body:"Noto Sans KR"}
.pv-stage{padding:clamp(28px,6vw,52px) clamp(12px,3vw,40px) 72px}
.pv-only-d{display:none}@media (min-width:960px){.pv-only-m{display:none}.pv-only-d{display:block}}
.pv-grandma{margin:0 auto clamp(28px,7vw,40px);max-width:26rem}
.pv-form{display:block}

.pv-actions{display:flex;flex-direction:column;align-items:center;margin-top:clamp(28px,6vw,40px)}
.pv-note{margin:14px auto 0;max-width:24rem;text-align:center}
${extra}</style></head><body>`
const write = (file: string, title: string, body: React.ReactNode, extra?: string) =>
  fs.writeFileSync(path.join(path.dirname(OUT), file), head(title, extra) + renderToStaticMarkup(<>{body}</>) + "</body></html>\n")

// ── 입력 화면 견본 ──
// 모바일 = single 한 쪽(제목 → 할머니 한마디 → 적는 칸 → 인장), PC = spread(왼쪽: 제목·한마디·인장 / 오른쪽: 적는 칸).
// 견본은 두 벌을 그려 화면 폭으로 하나만 보인다(실제 화면은 프론트엔드가 layout 하나를 고른다).
const Voice = () => <p className="ub-voice ub-voice--center pv-grandma">왔구나. 앉거라.<br />네 이름과 난 때만 적으면 된다.</p>
const Seal = () => (
  <div className="pv-actions">
    <UmWaxSeal />
    <p className="ub-note pv-note">사주 풀이는 전통 명리 해석에 따른 이야기이며, 미래를 과학적으로 예측한다는 뜻이 아닙니다.</p>
  </div>
)
const Fields = ({ err = false, pc = false }: { err?: boolean; pc?: boolean }) => {
  const cal = <UmInkChoice legend="달력" name={`cal${pc}`} defaultValue="solar" options={[{ value: "solar", label: "양력" }, { value: "lunar", label: "음력" }, { value: "leap", label: "윤달" }]} />
  const sex = <UmInkChoice legend="성별" name={`sex${pc}`} defaultValue="f" error={err ? "하나를 골라 다오." : undefined} options={[{ value: "m", label: "남" }, { value: "f", label: "여" }]} />
  return (
    <div className="pv-form">
      <UmInkField label="부를 이름" name="name" placeholder="예: 서연" autoComplete="given-name" hint="이 책에서만 너를 부를 이름이다." />
      <UmInkField as="group" label="태어난 날" requiredMark="꼭" error={err ? "날을 끝까지 적어 주거라." : undefined}>
        <UmInkPart aria-label="태어난 해" inputMode="numeric" placeholder="1992" chars={4} defaultValue={err ? "1992" : undefined} suffix="년" />
        <UmInkPart aria-label="태어난 달" inputMode="numeric" placeholder="8" chars={2} defaultValue={err ? "8" : undefined} suffix="월" />
        <UmInkPart aria-label="태어난 날" inputMode="numeric" placeholder="14" chars={2} invalid={err} suffix="일" />
      </UmInkField>
      {pc ? <div className="ub-fields-row">{cal}{sex}</div> : cal}
      <UmInkField as="group" label="태어난 시각" hint="모르면 '모름'으로 둬라. 시는 빼고 본다.">
        <UmInkPart as="select" aria-label="시" defaultValue="" chars={3} suffix="시">
          <option value="">모름</option>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}</option>)}
        </UmInkPart>
        <UmInkPart as="select" aria-label="분" defaultValue="" chars={2} suffix="분">
          <option value="">—</option>
          {[0, 10, 20, 30, 40, 50].map((m) => <option key={m} value={m}>{m}</option>)}
        </UmInkPart>
      </UmInkField>
      {!pc && sex}
      <UmInkField as="select" label="태어난 곳" name="place" defaultValue="seoul">
        <option value="seoul">서울</option><option value="busan">부산</option><option value="other">그 밖</option>
      </UmInkField>
      {pc ? null : <Seal />}
    </div>
  )
}

const input = (err: boolean, opening = false) => (
  <div className="um-root">
    <UmStudyBackdrop>
      <main className="pv-stage">
        <form noValidate className="pv-only-m">
          <UmBook layout="single" opening={opening} label="운명비서 — 적는 쪽">
            <UmBookTitle />
            <Voice />
            <Fields err={err} />
          </UmBook>
        </form>
        <form noValidate className="pv-only-d">
          <UmBook layout="spread" opening={opening} label="운명비서 — 적는 쪽" leftAlign="center"
            left={<><UmBookTitle /><Voice /><Seal /></>} right={<Fields err={err} pc />} />
        </form>
      </main>
    </UmStudyBackdrop>
  </div>
)
write("book-preview.html", "운명비서 고서 부품 견본 — 입력", input(false))
write("book-preview-error.html", "운명비서 고서 부품 견본 — 오류 상태", input(true))
write("book-preview-opening.html", "운명비서 고서 부품 견본 — 열림 연출", input(false, true))
write("book-preview-enter.html", "운명비서 고서 부품 견본 — 영상 끝 → 서재 어두워짐",
  <div className="um-root"><UmStudyBackdrop enter><main className="pv-stage" /></UmStudyBackdrop></div>)

// ── 결과 쪽 견본 ──
write("book-preview-result.html", "운명비서 고서 부품 견본 — 결과 쪽",
  <div className="um-root">
    <UmStudyBackdrop dim={0.3}>
      <main className="pv-stage">
        <UmBook layout="single">
          <UmBookPage no={1} title="물 위에 선 사람" lead="여덟 글자를 펴 놓고 할미가 처음 본 것부터." titleAs="h1" folio="一">
            <p>겉으로는 말이 적고, 한 번 마음먹은 건 오래 쥐고 있는 사람이다. 사람들이 너를 차갑다고 하면, 그건 네가 아직 속을 안 보여 줘서다.</p>
            <blockquote>음. 물이 많은 사주로구나. 겉은 고요한데 속은 쉬지를 않지.</blockquote>
            <p><strong>할미가 보기엔</strong> 너는 깊은 물이다. 서두르지 않아도 된다.</p>
            <h3>네 여덟 글자</h3>
            <ul><li>날의 글자 — 임수(壬水)</li><li>달의 글자 — 신금(申金)</li></ul>
          </UmBookPage>
          <UmBookPage no={2} title="올해의 물길" folio="二" footer={<p className="ub-note">이건 계산으로 나온 경향이고, 네가 겪은 일은 네가 더 잘 안다.</p>}>
            <p>올해는 흐름이 바뀌는 해다. 막혔던 일이 풀리기보다는, 길이 하나 더 열리는 쪽에 가깝다.</p>
          </UmBookPage>
        </UmBook>
      </main>
    </UmStudyBackdrop>
  </div>)
console.log("ok")
