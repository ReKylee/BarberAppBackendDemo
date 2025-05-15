import { TimeslotDateProps } from "../../Domain/ValueObjects/TimeslotDate";
import { UniqueEntityIDProps } from "../../Domain/ValueObjects/UniqueEntityID";

export interface TimeSlotDTO extends TimeslotDateProps, UniqueEntityIDProps {
    isBooked: boolean;
    barberId: string;
}

export type CreateTimeSlotDTO = Omit<TimeSlotDTO, "id">;

// For bulk creation of time slots
export interface WeeklyScheduleDTO {
    startDate: Date; // The start date of the schedule
    endDate: Date; // The end date of the schedule
    dailySlots: DailyScheduleDTO[];
}

export interface DailyScheduleDTO {
    dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    duration: number; // Duration in minutes
    interval?: number; // Optional interval between slots (defaults to duration)
}
