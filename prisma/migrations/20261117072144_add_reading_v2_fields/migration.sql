-- AlterTable
ALTER TABLE "Reading" ADD COLUMN     "claims" JSONB,
ADD COLUMN     "fullReading" JSONB,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "otherName" TEXT,
ADD COLUMN     "sajuInput" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'COMPLETE',
ADD COLUMN     "userAnswers" JSONB,
ALTER COLUMN "content" SET DEFAULT '';
