-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "punchInAt" TIMESTAMP(3),
ADD COLUMN     "punchOutAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AttendanceRecord_employeeId_punchInAt_idx" ON "AttendanceRecord"("employeeId", "punchInAt");
