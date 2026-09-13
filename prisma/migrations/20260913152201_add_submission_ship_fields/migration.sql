-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "aiUseDeclaration" TEXT,
ADD COLUMN     "aiUsed" BOOLEAN,
ADD COLUMN     "noteForReviewer" TEXT;