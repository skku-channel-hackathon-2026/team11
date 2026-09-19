import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  ACADEMIC_SCHEDULE_FUNCTIONS,
  AcademicScheduleListInputSchema,
  AcademicScheduleListOutputSchema,
  AcademicScheduleSyncInputSchema,
  AcademicScheduleSyncOutputSchema,
  type AcademicScheduleListInput,
  type AcademicScheduleSyncInput,
} from "@tutorial/shared";
import {
  Description,
  Func,
  Input,
  InputSchema,
  OutputSchema,
} from "@channel.io/app-sdk-server";
import { AcademicScheduleService } from "./academic-schedule.service.js";

@Injectable()
export class AcademicScheduleFunctions {
  constructor(private readonly academicScheduleService: AcademicScheduleService) {}

  @Func(ACADEMIC_SCHEDULE_FUNCTIONS.listSchedules)
  @Description("List academic schedules for a selected year and month")
  @InputSchema(AcademicScheduleListInputSchema)
  @OutputSchema(AcademicScheduleListOutputSchema)
  async listSchedules(
    @Input() input: AcademicScheduleListInput,
  ): Promise<z.infer<typeof AcademicScheduleListOutputSchema>> {
    return this.academicScheduleService.listSchedules(input);
  }

  @Func(ACADEMIC_SCHEDULE_FUNCTIONS.syncSchedules)
  @Description("Sync SKKU CSE academic schedules for a selected year")
  @InputSchema(AcademicScheduleSyncInputSchema)
  @OutputSchema(AcademicScheduleSyncOutputSchema)
  async syncSchedules(
    @Input() input: AcademicScheduleSyncInput,
  ): Promise<z.infer<typeof AcademicScheduleSyncOutputSchema>> {
    return this.academicScheduleService.syncSchedules(input);
  }
}
