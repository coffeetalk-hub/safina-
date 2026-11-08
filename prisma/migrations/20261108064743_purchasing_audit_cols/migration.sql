-- AlterTable
ALTER TABLE "VendorContract" ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "VendorEvaluation" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "updatedById" TEXT;
