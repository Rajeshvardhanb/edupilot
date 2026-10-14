-- AlterTable
ALTER TABLE `Institution` ADD COLUMN `attendanceCondonable` INTEGER NOT NULL DEFAULT 65,
    ADD COLUMN `attendanceRequired` INTEGER NOT NULL DEFAULT 75,
    ADD COLUMN `gradeScale` JSON NULL,
    ADD COLUMN `minExternalPercent` INTEGER NOT NULL DEFAULT 35,
    ADD COLUMN `passPercent` INTEGER NOT NULL DEFAULT 40;

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `note` VARCHAR(191) NULL,
    ADD COLUMN `refundOfId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `twoStep` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `role` ENUM('ADMIN', 'HOD', 'FACULTY', 'STUDENT', 'ACCOUNTANT', 'PARENT', 'OFFICE') NOT NULL;

-- CreateTable
CREATE TABLE `LoginCode` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoginCode_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParentContact` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `byId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ParentContact_studentId_createdAt_idx`(`studentId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashClosing` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `expectedCash` DOUBLE NOT NULL,
    `countedCash` DOUBLE NOT NULL,
    `note` TEXT NULL,
    `closedById` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CashClosing_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LoginCode` ADD CONSTRAINT `LoginCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParentContact` ADD CONSTRAINT `ParentContact_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParentContact` ADD CONSTRAINT `ParentContact_byId_fkey` FOREIGN KEY (`byId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashClosing` ADD CONSTRAINT `CashClosing_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_refundOfId_fkey` FOREIGN KEY (`refundOfId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
