CREATE TABLE "RoutineOccurrenceOverride" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "type" "CalendarType",
    "priority" "Priority",
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "projectId" TEXT,
    "taskId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoutineOccurrenceOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoutineOccurrenceOverride_routineId_date_key" ON "RoutineOccurrenceOverride"("routineId", "date");
CREATE INDEX "RoutineOccurrenceOverride_startAt_endAt_idx" ON "RoutineOccurrenceOverride"("startAt", "endAt");
ALTER TABLE "RoutineOccurrenceOverride" ADD CONSTRAINT "RoutineOccurrenceOverride_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineOccurrenceOverride" ADD CONSTRAINT "RoutineOccurrenceOverride_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutineOccurrenceOverride" ADD CONSTRAINT "RoutineOccurrenceOverride_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
