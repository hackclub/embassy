-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "JournalEntry_projectId_idx" ON "JournalEntry"("projectId");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
