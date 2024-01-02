/*
  Warnings:

  - You are about to drop the column `authorId` on the `Comments` table. All the data in the column will be lost.
  - You are about to alter the column `createdAt` on the `Post` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `Comments` DROP COLUMN `authorId`;

-- AlterTable
ALTER TABLE `Post` MODIFY `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
