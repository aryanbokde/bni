-- CreateTable
CREATE TABLE `chapters` (
    `chapter_id` CHAR(36) NOT NULL,
    `chapter_name` VARCHAR(150) NOT NULL,
    `meeting_day` TINYINT NOT NULL,
    `meeting_start_time` VARCHAR(8) NOT NULL,
    `meeting_duration_mins` INTEGER NOT NULL DEFAULT 90,
    `timezone` VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata',
    `quiet_start` VARCHAR(5) NOT NULL DEFAULT '21:00',
    `quiet_end` VARCHAR(5) NOT NULL DEFAULT '07:00',
    `rsvp_reminder_schedule` JSON NOT NULL,
    `lookback_days` INTEGER NOT NULL DEFAULT 180,
    `cooldown_days` INTEGER NOT NULL DEFAULT 60,
    `max_recs_per_cycle` INTEGER NOT NULL DEFAULT 3,
    `post_meeting_delay_mins` INTEGER NOT NULL DEFAULT 120,
    `rec_expiry_days` INTEGER NOT NULL DEFAULT 30,
    `office_lat` DOUBLE NULL,
    `office_lng` DOUBLE NULL,
    `location_display_mode` VARCHAR(20) NOT NULL DEFAULT 'AREA_ONLY',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`chapter_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `members` (
    `member_id` CHAR(36) NOT NULL,
    `chapter_id` CHAR(36) NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `mobile_enc` LONGBLOB NOT NULL,
    `mobile_hash` CHAR(64) NOT NULL,
    `whatsapp_enc` LONGBLOB NOT NULL,
    `whatsapp_hash` CHAR(64) NOT NULL,
    `email_enc` LONGBLOB NOT NULL,
    `email_hash` CHAR(64) NOT NULL,
    `password_hash` VARCHAR(60) NULL,
    `biz_category` VARCHAR(100) NOT NULL,
    `one_line_summary` VARCHAR(250) NOT NULL,
    `intro_text` VARCHAR(400) NULL,
    `office_address` TEXT NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `geocode_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `comm_eligible` BOOLEAN NOT NULL DEFAULT true,
    `rec_active` BOOLEAN NOT NULL DEFAULT true,
    `chapter_role` VARCHAR(30) NOT NULL DEFAULT 'MEMBER',
    `joining_date` DATE NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,

    INDEX `members_chapter_id_status_idx`(`chapter_id`, `status`),
    INDEX `members_chapter_id_chapter_role_idx`(`chapter_id`, `chapter_role`),
    UNIQUE INDEX `members_chapter_id_mobile_hash_key`(`chapter_id`, `mobile_hash`),
    UNIQUE INDEX `members_chapter_id_whatsapp_hash_key`(`chapter_id`, `whatsapp_hash`),
    UNIQUE INDEX `members_chapter_id_email_hash_key`(`chapter_id`, `email_hash`),
    PRIMARY KEY (`member_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shareable_fields` (
    `chapter_id` CHAR(36) NOT NULL,
    `field_name` VARCHAR(50) NOT NULL,
    `is_shareable` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(0) NOT NULL,
    `updated_by` CHAR(36) NULL,

    PRIMARY KEY (`chapter_id`, `field_name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_interactions` (
    `interaction_id` CHAR(36) NOT NULL,
    `chapter_id` CHAR(36) NOT NULL,
    `member_a_id` CHAR(36) NOT NULL,
    `member_b_id` CHAR(36) NOT NULL,
    `interaction_date` DATE NOT NULL,
    `source` VARCHAR(30) NOT NULL,
    `confirmed_by` CHAR(36) NULL,
    `notes` TEXT NULL,
    `rec_id` CHAR(36) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `member_interactions_member_a_id_interaction_date_idx`(`member_a_id`, `interaction_date`),
    INDEX `member_interactions_member_b_id_interaction_date_idx`(`member_b_id`, `interaction_date`),
    INDEX `member_interactions_chapter_id_interaction_date_idx`(`chapter_id`, `interaction_date`),
    UNIQUE INDEX `member_interactions_member_a_id_member_b_id_interaction_date_key`(`member_a_id`, `member_b_id`, `interaction_date`),
    PRIMARY KEY (`interaction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recommendations` (
    `rec_id` CHAR(36) NOT NULL,
    `chapter_id` CHAR(36) NOT NULL,
    `member_a_id` CHAR(36) NOT NULL,
    `member_b_id` CHAR(36) NOT NULL,
    `run_id` CHAR(36) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    `sent_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `expired_at` DATETIME(3) NULL,
    `excluded_at` DATETIME(3) NULL,
    `excluded_by` CHAR(36) NULL,
    `excluded_reason` TEXT NULL,
    `wa_msg_id_a` VARCHAR(100) NULL,
    `wa_msg_id_b` VARCHAR(100) NULL,
    `send_attempts` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `recommendations_chapter_id_status_idx`(`chapter_id`, `status`),
    INDEX `recommendations_member_a_id_status_idx`(`member_a_id`, `status`),
    INDEX `recommendations_member_b_id_status_idx`(`member_b_id`, `status`),
    PRIMARY KEY (`rec_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recommendation_runs` (
    `run_id` CHAR(36) NOT NULL,
    `chapter_id` CHAR(36) NOT NULL,
    `trigger_type` VARCHAR(20) NOT NULL,
    `meeting_id` CHAR(36) NULL,
    `started_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `completed_at` DATETIME(3) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    `pairs_evaluated` INTEGER NOT NULL DEFAULT 0,
    `pairs_sent` INTEGER NOT NULL DEFAULT 0,
    `pairs_skipped` INTEGER NOT NULL DEFAULT 0,
    `error_detail` TEXT NULL,

    PRIMARY KEY (`run_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `log_id` BIGINT NOT NULL AUTO_INCREMENT,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` CHAR(36) NOT NULL,
    `operation` VARCHAR(20) NOT NULL,
    `field_name` VARCHAR(80) NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `actor_id` CHAR(36) NOT NULL,
    `actor_role` VARCHAR(30) NOT NULL,
    `source` VARCHAR(20) NOT NULL,
    `occurred_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_actor_id_idx`(`actor_id`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` CHAR(36) NOT NULL,
    `member_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,

    INDEX `refresh_tokens_token_hash_idx`(`token_hash`),
    INDEX `refresh_tokens_member_id_idx`(`member_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `members` ADD CONSTRAINT `members_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`chapter_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shareable_fields` ADD CONSTRAINT `shareable_fields_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`chapter_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_interactions` ADD CONSTRAINT `member_interactions_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`chapter_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`chapter_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendation_runs` ADD CONSTRAINT `recommendation_runs_chapter_id_fkey` FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`chapter_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
