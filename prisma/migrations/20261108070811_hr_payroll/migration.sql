-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('UNLIMITED', 'LIMITED', 'PART_TIME');

-- CreateEnum
CREATE TYPE "EmployeeContractStatus" AS ENUM ('ACTIVE', 'ENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PayComponentType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayComponentCalc" AS ENUM ('FIXED', 'PERCENT_OF_BASIC');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE', 'REMOTE', 'HOLIDAY', 'WEEKEND');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EosReason" AS ENUM ('RESIGNATION', 'TERMINATION', 'END_OF_CONTRACT', 'ARTICLE_80', 'RETIREMENT', 'DEATH', 'MUTUAL');

-- CreateEnum
CREATE TYPE "EosStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HrDocumentType" AS ENUM ('IQAMA', 'PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENCE', 'MEDICAL_INSURANCE', 'WORK_PERMIT', 'CONTRACT', 'CERTIFICATE', 'VISA', 'OTHER');

-- CreateTable
CREATE TABLE "HrSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workStart" TEXT NOT NULL DEFAULT '08:00',
    "workEnd" TEXT NOT NULL DEFAULT '17:00',
    "dailyHours" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "weekendDays" TEXT NOT NULL DEFAULT 'FRI,SAT',
    "graceMinutes" INTEGER NOT NULL DEFAULT 10,
    "overtimeMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
    "daysPerMonth" INTEGER NOT NULL DEFAULT 30,
    "annualLeaveDays" INTEGER NOT NULL DEFAULT 21,
    "annualLeaveDaysAfter5y" INTEGER NOT NULL DEFAULT 30,
    "sickFullPayDays" INTEGER NOT NULL DEFAULT 30,
    "sickPartialPayDays" INTEGER NOT NULL DEFAULT 60,
    "sickPartialPayPct" INTEGER NOT NULL DEFAULT 75,
    "sickUnpaidDays" INTEGER NOT NULL DEFAULT 30,
    "eosbWageBasis" TEXT NOT NULL DEFAULT 'BASIC_HOUSING',
    "gosiWageBasis" TEXT NOT NULL DEFAULT 'BASIC_HOUSING',
    "gosiMinWage" DECIMAL(18,4) NOT NULL DEFAULT 1500,
    "gosiMaxWage" DECIMAL(18,4) NOT NULL DEFAULT 45000,
    "wpsEstablishmentId" TEXT,
    "wpsBankCode" TEXT,
    "payDay" INTEGER NOT NULL DEFAULT 27,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "HrSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GosiRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "employeePension" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "employerPension" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "employeeSaned" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "employerSaned" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "employerHazard" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "GosiRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeContract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "ContractType" NOT NULL DEFAULT 'UNLIMITED',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "probationEndDate" DATE,
    "workingHoursWeek" INTEGER NOT NULL DEFAULT 48,
    "noticeDays" INTEGER NOT NULL DEFAULT 60,
    "jobTitleAr" TEXT,
    "jobTitleEn" TEXT,
    "status" "EmployeeContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "EmployeeContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "HrDocumentType" NOT NULL DEFAULT 'IQAMA',
    "number" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE,
    "alertDays" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "lastAlertAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayComponent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "type" "PayComponentType" NOT NULL DEFAULT 'EARNING',
    "calc" "PayComponentCalc" NOT NULL DEFAULT 'FIXED',
    "defaultValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isHousing" BOOLEAN NOT NULL DEFAULT false,
    "accountId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "PayComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "basic" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'SAR',
    "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "effectiveFrom" DATE NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructureLine" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "SalaryStructureLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "entitlementDays" INTEGER NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "payPct" INTEGER NOT NULL DEFAULT 100,
    "deductsBalance" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "maxDaysPerRequest" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" DECIMAL(6,2) NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'DRAFT',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carried" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "adjusted" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "taken" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "checkIn" TEXT,
    "checkOut" TEXT,
    "workedHrs" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lateMin" INTEGER NOT NULL DEFAULT 0,
    "earlyMin" INTEGER NOT NULL DEFAULT 0,
    "overtimeHrs" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLoan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "loanDate" DATE NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "installments" INTEGER NOT NULL,
    "installmentAmount" DECIMAL(18,4) NOT NULL,
    "firstMonth" DATE NOT NULL,
    "reason" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "EmployeeLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "dueMonth" DATE NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "payslipId" TEXT,

    CONSTRAINT "LoanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "number" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "payDate" DATE NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "employeesCount" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalGosiEmployee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalGosiEmployer" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalLoans" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "paymentEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "number" TEXT NOT NULL,
    "basic" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "net" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "gosiWage" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "gosiEmployee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "gosiEmployer" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "loanDeduction" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "absenceDeduction" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "overtimePay" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "workingDays" INTEGER NOT NULL DEFAULT 30,
    "absentDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "unpaidLeaveDays" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "overtimeHrs" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "bankName" TEXT,
    "iban" TEXT,
    "notes" TEXT,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipLine" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "type" "PayComponentType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PayslipLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WpsFile" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "records" INTEGER NOT NULL,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,

    CONSTRAINT "WpsFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndOfServiceCalc" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "terminationDate" DATE NOT NULL,
    "reason" "EosReason" NOT NULL DEFAULT 'RESIGNATION',
    "serviceYears" DECIMAL(8,4) NOT NULL,
    "monthlyWage" DECIMAL(18,4) NOT NULL,
    "fullEntitlement" DECIMAL(18,4) NOT NULL,
    "eosbPct" INTEGER NOT NULL DEFAULT 100,
    "eosbAmount" DECIMAL(18,4) NOT NULL,
    "leaveDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "leaveEncashment" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "otherAdditions" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "loanBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,4) NOT NULL,
    "status" "EosStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" TEXT,
    "paymentEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "EndOfServiceCalc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HrSettings_companyId_key" ON "HrSettings"("companyId");

-- CreateIndex
CREATE INDEX "GosiRate_companyId_nationality_effectiveFrom_idx" ON "GosiRate"("companyId", "nationality", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_companyId_date_key" ON "PublicHoliday"("companyId", "date");

-- CreateIndex
CREATE INDEX "EmployeeContract_companyId_employeeId_idx" ON "EmployeeContract"("companyId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeContract_companyId_number_key" ON "EmployeeContract"("companyId", "number");

-- CreateIndex
CREATE INDEX "EmployeeDocument_companyId_expiryDate_idx" ON "EmployeeDocument"("companyId", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayComponent_companyId_code_key" ON "PayComponent"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_employeeId_key" ON "SalaryStructure"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureLine_structureId_componentId_key" ON "SalaryStructureLine"("structureId", "componentId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_companyId_code_key" ON "LeaveType"("companyId", "code");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_employeeId_startDate_idx" ON "LeaveRequest"("companyId", "employeeId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_companyId_number_key" ON "LeaveRequest"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_leaveTypeId_year_key" ON "LeaveBalance"("employeeId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "AttendanceRecord_companyId_day_idx" ON "AttendanceRecord"("companyId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_day_key" ON "AttendanceRecord"("employeeId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeLoan_companyId_number_key" ON "EmployeeLoan"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LoanInstallment_loanId_dueMonth_key" ON "LoanInstallment"("loanId", "dueMonth");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_companyId_number_key" ON "PayrollRun"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_companyId_periodYear_periodMonth_branchId_key" ON "PayrollRun"("companyId", "periodYear", "periodMonth", "branchId");

-- CreateIndex
CREATE INDEX "Payslip_companyId_employeeId_idx" ON "Payslip"("companyId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_runId_employeeId_key" ON "Payslip"("runId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "WpsFile_runId_key" ON "WpsFile"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "EndOfServiceCalc_companyId_number_key" ON "EndOfServiceCalc"("companyId", "number");

-- AddForeignKey
ALTER TABLE "SalaryStructureLine" ADD CONSTRAINT "SalaryStructureLine_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureLine" ADD CONSTRAINT "SalaryStructureLine_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "EmployeeLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WpsFile" ADD CONSTRAINT "WpsFile_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
