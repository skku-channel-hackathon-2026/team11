import { Injectable } from "@nestjs/common";
import type {
  AcademicScheduleListInput,
  AcademicScheduleListOutput,
  AcademicScheduleSyncInput,
  AcademicScheduleSyncOutput,
} from "@tutorial/shared";
import { listAcademicSchedules } from "./features/academic-schedules/academic-schedule.store.js";
import { syncAcademicSchedules } from "./features/academic-schedules/academic-schedule-sync.js";

@Injectable()
export class AcademicScheduleService {
  async listSchedules(
    input: AcademicScheduleListInput = {},
  ): Promise<AcademicScheduleListOutput> {
    return listAcademicSchedules(input);
  }

  async syncSchedules(
    input: AcademicScheduleSyncInput = {},
  ): Promise<AcademicScheduleSyncOutput> {
    return syncAcademicSchedules(input.year);
  }
}
