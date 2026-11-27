-- reading_v3_safety — 적용 전 대표 승인 필요 (docs/DATABASE.md 4절, docs/MAINTENANCE.md "DB 마이그레이션 적용 절차")
-- 성격: 추가만 한다(열 추가·새 표). 기존 열·데이터를 바꾸거나 지우지 않는다.
--   - 새 열은 모두 NULL 허용 또는 상수 기본값 → 기존 행은 그대로(PostgreSQL 11+는 상수 기본값 열 추가 시 표 재작성 없음)
--   - 이 마이그레이션 이전 코드는 새 열을 모르고도 그대로 동작한다(추가만 하므로)
--   - 반대로 새 schema로 만든 Prisma 클라이언트(이 변경 이후 코드)는 DB_SCHEMA_V3 스위치와 무관하게
--     새 열이 DB에 있어야 한다(전체 열 조회) → 반드시 '마이그레이션 적용 → 새 코드 배포 → 스위치 켬' 순서
-- 되돌리기: 같은 폴더 down.sql (prisma가 자동 실행하지 않음 — 절차 문서 참고)
-- 생성: prisma migrate diff --from-schema-datamodel(이전 schema) --to-schema-datamodel(현 schema) --script (DB 연결 없이 생성)

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "birthInfo" JSONB;

-- AlterTable
ALTER TABLE "Reading" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "birthMinute" INTEGER,
ADD COLUMN     "birthplaceLongitude" DOUBLE PRECISION,
ADD COLUMN     "isLeapMonth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "otherBirthMinute" INTEGER,
ADD COLUMN     "otherBirthplaceLongitude" DOUBLE PRECISION,
ADD COLUMN     "otherCalType" TEXT,
ADD COLUMN     "otherIsLeapMonth" BOOLEAN,
ADD COLUMN     "otherTimeMode" TEXT,
ADD COLUMN     "otherZiNight" BOOLEAN,
ADD COLUMN     "timeMode" TEXT,
ADD COLUMN     "ziNight" BOOLEAN;

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "readingId" TEXT,
    "chapterId" TEXT,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_readingId_idx" ON "AiUsage"("readingId");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "Reading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

