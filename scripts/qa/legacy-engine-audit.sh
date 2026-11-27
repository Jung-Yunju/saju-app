#!/usr/bin/env bash
# ============================================================================
# 폐기 (2026-11-27, 품질검증 담당 · P4-04) — 대체 테스트 경로:
#     npx vitest run tests/verify/consistency.test.ts
#   (새 엔진 computeChart ↔ AI 입력 buildSajuInput ↔ 결과 화면 resolveDisplaySaju ↔ 규칙 엔진 analyzeRules
#    ↔ 검증기 글자 집합 일치 + 화면이 옛 src/lib/saju.ts를 쓰지 않는지 정적 확인)
#   이 스크립트는 saju-input.ts가 @/engine 별칭을 쓰게 된 뒤 tsc 단독 컴파일이 깨져 더는 돌지 않는다.
#   파일 삭제는 대표 승인 사항이라 남겨 둔다. 기본 실행 시 안내만 출력하고 실패(1)로 끝난다.
#   옛 동작을 굳이 돌려 보려면: LEGACY_AUDIT_FORCE=1 bash scripts/qa/legacy-engine-audit.sh
# ============================================================================
if [ "${LEGACY_AUDIT_FORCE:-}" != "1" ]; then
  echo "[폐기] legacy-engine-audit.sh 는 더 이상 쓰지 않습니다. 대체: npx vitest run tests/verify/consistency.test.ts" >&2
  exit 1
fi
# 기존(레거시) 사주 계산 코드 감사 스크립트 — 품질검증 담당 관리
# 사용법: bash scripts/qa/legacy-engine-audit.sh   (npm ci 후 실행)
# 하는 일: src/lib/saju.ts(화면 표시용)와 src/lib/saju-input.ts(AI 입력용)를
#          임시 폴더에 컴파일해 같은 생년월일에서 결과가 일치하는지 비교한다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
cd "$ROOT"
npx tsc src/lib/saju.ts src/lib/saju-input.ts --outDir "$OUT" --module commonjs --target es2020 --esModuleInterop --skipLibCheck
NODE_PATH="$ROOT/node_modules" AUDIT_OUT="$OUT" node "$ROOT/scripts/qa/legacy-engine-audit.cjs"
