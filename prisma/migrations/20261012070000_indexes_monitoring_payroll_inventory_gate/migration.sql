-- DropForeignKey
ALTER TABLE `ExamSchedule` DROP FOREIGN KEY `ExamSchedule_termId_fkey`;

-- DropIndex
DROP INDEX `ExamSchedule_termId_subjectId_key` ON `ExamSchedule`;

-- AlterTable
ALTER TABLE `ExamSchedule` ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'END_SEM';

-- AlterTable
ALTER TABLE `Institution` ADD COLUMN `placementFromSemestersLeft` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `promoteMaxBacklogs` INTEGER NULL;

-- AlterTable
ALTER TABLE `SubjectResult` ADD COLUMN `grace` DOUBLE NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `InvigilationDuty` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `session` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `InvigilationDuty_date_session_roomId_key`(`date`, `session`, `roomId`),
    UNIQUE INDEX `InvigilationDuty_date_session_facultyId_key`(`date`, `session`, `facultyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RevaluationRequest` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `offeringId` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `oldExternal` DOUBLE NOT NULL,
    `oldTotal` DOUBLE NOT NULL,
    `oldGrade` VARCHAR(191) NOT NULL,
    `newExternal` DOUBLE NULL,
    `newTotal` DOUBLE NULL,
    `newGrade` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RevaluationRequest_studentId_offeringId_key`(`studentId`, `offeringId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryStructure` (
    `userId` VARCHAR(191) NOT NULL,
    `basic` DOUBLE NOT NULL,
    `hra` DOUBLE NOT NULL DEFAULT 0,
    `da` DOUBLE NOT NULL DEFAULT 0,
    `allowances` DOUBLE NOT NULL DEFAULT 0,
    `pfPercent` DOUBLE NOT NULL DEFAULT 12,
    `otherDeductions` DOUBLE NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payslip` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `month` VARCHAR(191) NOT NULL,
    `workingDays` INTEGER NOT NULL,
    `paidDays` DOUBLE NOT NULL,
    `lopDays` DOUBLE NOT NULL,
    `basic` DOUBLE NOT NULL,
    `hra` DOUBLE NOT NULL,
    `da` DOUBLE NOT NULL,
    `allowances` DOUBLE NOT NULL,
    `gross` DOUBLE NOT NULL,
    `pf` DOUBLE NOT NULL,
    `otherDeductions` DOUBLE NOT NULL,
    `lopDeduction` DOUBLE NOT NULL,
    `net` DOUBLE NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payslip_month_idx`(`month`),
    UNIQUE INDEX `Payslip_userId_month_key`(`userId`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asset` (
    `id` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `condition` VARCHAR(191) NOT NULL DEFAULT 'GOOD',
    `purchaseDate` DATE NULL,
    `cost` DOUBLE NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Asset_tag_key`(`tag`),
    INDEX `Asset_departmentId_idx`(`departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetIssue` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `issuedTo` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueBack` DATE NULL,
    `returnedAt` DATETIME(3) NULL,
    `byId` VARCHAR(191) NULL,

    INDEX `AssetIssue_assetId_idx`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Visitor` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `toMeet` VARCHAR(191) NOT NULL,
    `idProof` VARCHAR(191) NULL,
    `inAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `outAt` DATETIME(3) NULL,
    `byId` VARCHAR(191) NULL,

    INDEX `Visitor_inAt_idx`(`inAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GatePass` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `outAt` DATETIME(3) NOT NULL,
    `expectedBack` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `decidedById` VARCHAR(191) NULL,
    `leftAt` DATETIME(3) NULL,
    `returnedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GatePass_status_outAt_idx`(`status`, `outAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfileChange` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `field` VARCHAR(191) NOT NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `requestedById` VARCHAR(191) NOT NULL,
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProfileChange_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ErrorLog` (
    `id` VARCHAR(191) NOT NULL,
    `signature` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `stack` TEXT NULL,
    `path` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `routeType` VARCHAR(191) NOT NULL,
    `digest` VARCHAR(191) NULL,
    `count` INTEGER NOT NULL DEFAULT 1,
    `firstAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ErrorLog_signature_key`(`signature`),
    INDEX `ErrorLog_lastAt_idx`(`lastAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Enquiry_stage_followUpDate_idx` ON `Enquiry`(`stage`, `followUpDate`);

-- CreateIndex
CREATE UNIQUE INDEX `ExamSchedule_termId_subjectId_kind_key` ON `ExamSchedule`(`termId`, `subjectId`, `kind`);

-- CreateIndex
CREATE INDEX `FeeInvoice_dueDate_idx` ON `FeeInvoice`(`dueDate`);

-- CreateIndex
CREATE INDEX `Payment_paidAt_idx` ON `Payment`(`paidAt`);

-- CreateIndex
CREATE INDEX `Payment_mode_paidAt_idx` ON `Payment`(`mode`, `paidAt`);

-- CreateIndex
CREATE INDEX `Student_status_idx` ON `Student`(`status`);

-- AddForeignKey
ALTER TABLE `InvigilationDuty` ADD CONSTRAINT `InvigilationDuty_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `ExamRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvigilationDuty` ADD CONSTRAINT `InvigilationDuty_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `Faculty`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevaluationRequest` ADD CONSTRAINT `RevaluationRequest_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevaluationRequest` ADD CONSTRAINT `RevaluationRequest_offeringId_fkey` FOREIGN KEY (`offeringId`) REFERENCES `CourseOffering`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryStructure` ADD CONSTRAINT `SalaryStructure_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payslip` ADD CONSTRAINT `Payslip_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetIssue` ADD CONSTRAINT `AssetIssue_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GatePass` ADD CONSTRAINT `GatePass_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileChange` ADD CONSTRAINT `ProfileChange_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamSchedule` ADD CONSTRAINT `ExamSchedule_termId_fkey` FOREIGN KEY (`termId`) REFERENCES `Term`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
