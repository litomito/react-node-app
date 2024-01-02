/*
  Warnings:

  - You are about to drop the column `authorId` on the `Comments` table. All the data in the column will be lost.
  - You are about to drop the column `user` on the `Comments` table. All the data in the column will be lost.
  - Added the required column `postId` to the `Comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Comments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Comments` DROP FOREIGN KEY `Comments_authorId_fkey`;

-- AlterTable
ALTER TABLE `Comments` DROP COLUMN `authorId`,
    DROP COLUMN `user`,
    ADD COLUMN `postId` INTEGER NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
