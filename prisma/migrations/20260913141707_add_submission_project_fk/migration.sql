-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "Submission_projectId_idx" ON "Submission"("projectId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
