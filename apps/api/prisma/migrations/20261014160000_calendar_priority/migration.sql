-- AlterTable
ALTER TABLE "CalendarBlock" ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'P3';

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'P3';
