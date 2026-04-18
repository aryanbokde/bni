-- DropForeignKey (must drop FK before its backing index in MySQL)
ALTER TABLE `recommendation_runs` DROP FOREIGN KEY `recommendation_runs_chapter_id_fkey`;

-- DropIndex
DROP INDEX `recommendation_runs_chapter_id_fkey` ON `recommendation_runs`;

-- AlterTable
ALTER TABLE `members` ADD COLUMN `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `locked_until` DATETIME(0) NULL;

-- AddForeignKey
ALTER TABLE `recommendation_runs` ADD CONSTRAINT `recommendation_runs_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`chapter_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
