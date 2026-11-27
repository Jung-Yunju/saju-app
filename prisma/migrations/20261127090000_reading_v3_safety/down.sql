-- reading_v3_safety 되돌리기 (수동 실행 전용 — prisma migrate는 이 파일을 실행하지 않는다)
-- 주의: 아래 열·표에 쌓인 데이터(시도 횟수·잠금 시각·정확도 입력 열·주문 birthInfo·AI 사용 기록)는 지워진다.
--       실행 전 반드시 백업(Neon 브랜치 또는 pg_dump)을 만들고, DB_SCHEMA_V3 스위치를 먼저 끈다(배포 반영 확인 후).
--       윤달·분·출생지 경도는 Reading.sajuInput(JSON)에도 남아 있으므로 풀이 화면·재생성에는 영향이 없다.
-- 실행 뒤 이력 정리: npx prisma migrate resolve --rolled-back 20261127090000_reading_v3_safety
-- 한 번에 적용되도록 트랜잭션으로 감싼다.

BEGIN;

-- DropForeignKey
ALTER TABLE "AiUsage" DROP CONSTRAINT "AiUsage_readingId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "birthInfo";

-- AlterTable
ALTER TABLE "Reading" DROP COLUMN "attemptCount",
DROP COLUMN "birthMinute",
DROP COLUMN "birthplaceLongitude",
DROP COLUMN "isLeapMonth",
DROP COLUMN "lockedAt",
DROP COLUMN "otherBirthMinute",
DROP COLUMN "otherBirthplaceLongitude",
DROP COLUMN "otherCalType",
DROP COLUMN "otherIsLeapMonth",
DROP COLUMN "otherTimeMode",
DROP COLUMN "otherZiNight",
DROP COLUMN "timeMode",
DROP COLUMN "ziNight";

-- DropTable
DROP TABLE "AiUsage";


COMMIT;
