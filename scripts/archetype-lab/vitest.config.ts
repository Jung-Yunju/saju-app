// 원형 실험 도구 전용 테스트 설정 (npm test 범위 밖 — 제품 테스트와 섞지 않음)
// 실행: npx vitest run --config scripts/archetype-lab/vitest.config.ts
import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } },
  test: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
    include: ["scripts/archetype-lab/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
  },
})
