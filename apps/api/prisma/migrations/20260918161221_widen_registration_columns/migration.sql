-- AlterTable
ALTER TABLE `registrations` MODIFY `participant_name` VARCHAR(255) NOT NULL,
    MODIFY `participant_email` VARCHAR(255) NOT NULL,
    MODIFY `song_name` VARCHAR(255) NOT NULL,
    MODIFY `music_composer` VARCHAR(255) NULL,
    MODIFY `lyrics_composer` VARCHAR(255) NULL,
    MODIFY `video_url` VARCHAR(2048) NULL;
