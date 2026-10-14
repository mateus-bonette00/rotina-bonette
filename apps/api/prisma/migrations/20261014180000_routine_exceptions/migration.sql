-- AlterTable
ALTER TABLE "Routine" ADD COLUMN "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "anchorDate" TEXT,
ADD COLUMN "dayTimes" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "RoutineException" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutineException_routineId_idx" ON "RoutineException"("routineId");

-- AddForeignKey
ALTER TABLE "RoutineException" ADD CONSTRAINT "RoutineException_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
