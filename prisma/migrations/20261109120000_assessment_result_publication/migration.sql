-- Mid/internal assessment results can be released independently of final course grades.
ALTER TABLE `Assessment` ADD COLUMN `publishedAt` DATETIME(3) NULL;
