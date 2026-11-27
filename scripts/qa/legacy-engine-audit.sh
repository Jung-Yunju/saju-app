#!/usr/bin/env bash
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
