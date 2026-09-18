-- CreateTable
CREATE TABLE `registrations` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `festival_id` VARCHAR(191) NOT NULL,
    `participant_name` VARCHAR(191) NOT NULL,
    `participant_email` VARCHAR(191) NOT NULL,
    `participant_cpf` VARCHAR(191) NOT NULL,
    `song_name` VARCHAR(191) NOT NULL,
    `performers` TEXT NOT NULL,
    `music_composer` VARCHAR(191) NULL,
    `lyrics_composer` VARCHAR(191) NULL,
    `video_url` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `registrations` ADD CONSTRAINT `registrations_festival_id_fkey` FOREIGN KEY (`festival_id`) REFERENCES `festivals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
