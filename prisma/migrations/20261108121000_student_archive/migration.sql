ALTER TABLE `Student` ADD COLUMN `archivedAt` DATETIME(3) NULL;
CREATE INDEX `Student_archivedAt_idx` ON `Student`(`archivedAt`);
