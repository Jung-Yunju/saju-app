-- CreateEnum
CREATE TYPE "ReadingType" AS ENUM ('BASIC', 'MONEY', 'LOVE', 'CAREER', 'BULLY', 'CONFLICT');

-- AlterTable
ALTER TABLE "Reading" ADD COLUMN     "otherBirthDay" INTEGER,
ADD COLUMN     "otherBirthHour" INTEGER,
ADD COLUMN     "otherBirthMonth" INTEGER,
ADD COLUMN     "otherBirthYear" INTEGER,
ADD COLUMN     "otherGender" TEXT,
ADD COLUMN     "readingType" "ReadingType" NOT NULL DEFAULT 'BASIC';
