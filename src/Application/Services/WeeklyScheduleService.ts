// src/Application/Services/WeeklyScheduleService.ts
import { Result } from "typescript-result";
import { AppDataSource } from "../../Infra/Database/DataSource";
import { TimeSlotORM } from "../../Infra/ORM/TimeSlotORM";
import { BarberORM } from "../../Infra/ORM/BarberORM";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";
import { WeeklyScheduleDTO, DailyScheduleDTO } from "../DTO/TimeSlotDTO";
import {
    BusinessRuleError,
    NotFoundError,
} from "../../Domain/Shared/DomainError";
import { Between } from "typeorm";

interface TimeSlotGenerated {
    id: string;
    startTime: Date;
    endTime: Date;
    duration: number;
}

export class WeeklyScheduleService {
    /**
     * Creates a batch of timeslots for a weekly schedule with overlap validation
     */
    public async createWeeklySchedule(
        barberId: UniqueEntityID,
        schedule: WeeklyScheduleDTO
    ): Promise<Result<TimeSlotORM[], Error>> {
        return Result.try(async () => {
            // Get barber using the Result type for better error handling
            const barberResult = await this.getBarber(barberId);
            if (!barberResult.isOk()) {
                return Result.error(barberResult.error);
            }
            const barber = barberResult.value;

            // Validate dates using Result
            const datesValidResult = this.validateDates(
                schedule.startDate,
                schedule.endDate
            );
            if (datesValidResult.isError()) {
                return Result.error(datesValidResult.error);
            }

            const startDate = new Date(schedule.startDate);
            const endDate = new Date(schedule.endDate);

            // Generate all potential timeslots
            const timeslotsResult = this.generateTimeSlots(
                barberId.toString(),
                startDate,
                endDate,
                schedule.dailySlots
            );

            if (!timeslotsResult.isOk()) {
                return Result.error(timeslotsResult.error);
            }

            const timeSlots = timeslotsResult.value;

            // Check for overlaps with existing timeslots
            const overlapCheckResult = await this.checkForOverlaps(
                barberId.toString(),
                startDate,
                endDate,
                timeSlots
            );

            if (!overlapCheckResult.isOk()) {
                return Result.error(overlapCheckResult.error);
            }

            // Save timeslots in a transaction
            return await this.saveTimeSlotsInTransaction(barber, timeSlots);
        });
    }

    /**
     * Gets a barber by ID using Result type
     */
    private async getBarber(
        barberId: UniqueEntityID
    ): Promise<Result<BarberORM, Error>> {
        const barberRepository = AppDataSource.getRepository(BarberORM);
        const barber = await barberRepository.findOneBy({
            barberId: barberId.toString(),
        });

        if (!barber) {
            return Result.error(
                new NotFoundError("Barber", barberId.toString())
            );
        }

        return Result.ok(barber);
    }

    /**
     * Validates date range using Result type
     */
    private validateDates(
        startDate: Date,
        endDate: Date
    ): Result<boolean, Error> {
        if (new Date(endDate) <= new Date(startDate)) {
            return Result.error(
                new BusinessRuleError("End date must be after start date")
            );
        }

        return Result.ok(true);
    }

    /**
     * Generates timeslots from schedule
     */
    private generateTimeSlots(
        barberIdStr: string,
        startDate: Date,
        endDate: Date,
        dailySlots: DailyScheduleDTO[]
    ): Result<TimeSlotGenerated[], Error> {
        const timeSlots: TimeSlotGenerated[] = [];
        const currentDate = new Date(startDate);

        // Create all potential timeslots
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            const daySchedule = dailySlots.find(
                (slot) => slot.dayOfWeek === dayOfWeek
            );

            if (daySchedule) {
                const [startHour, startMinute] = daySchedule.startTime
                    .split(":")
                    .map(Number);
                const [endHour, endMinute] = daySchedule.endTime
                    .split(":")
                    .map(Number);

                const duration = daySchedule.duration;
                const interval = daySchedule.interval || duration;

                let currentTime = new Date(currentDate);
                currentTime.setHours(startHour, startMinute, 0, 0);

                const endDateTime = new Date(currentDate);
                endDateTime.setHours(endHour, endMinute, 0, 0);

                while (
                    currentTime.getTime() + duration * 60 * 1000 <=
                    endDateTime.getTime()
                ) {
                    const startTime = new Date(currentTime);
                    const endTime = new Date(startTime);
                    endTime.setMinutes(endTime.getMinutes() + duration);

                    timeSlots.push({
                        id: UniqueEntityID.create().toString(),
                        startTime,
                        endTime,
                        duration,
                    });

                    currentTime.setMinutes(currentTime.getMinutes() + interval);
                }
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (timeSlots.length === 0) {
            return Result.error(
                new BusinessRuleError(
                    "No valid timeslots could be created with the provided schedule"
                )
            );
        }

        return Result.ok(timeSlots);
    }

    /**
     * Optimized overlap check using interval tree algorithm concept
     */
    private async checkForOverlaps(
        barberIdStr: string,
        startDate: Date,
        endDate: Date,
        newTimeSlots: TimeSlotGenerated[]
    ): Promise<Result<boolean, Error>> {
        // Efficiently get existing timeslots
        const repository = AppDataSource.getRepository(TimeSlotORM);
        const existingSlots = await repository.find({
            where: {
                barber: { barberId: barberIdStr },
                startTime: Between(startDate, endDate),
            },
            order: { startTime: "ASC" },
        });

        if (existingSlots.length === 0) {
            return Result.ok(true); // No existing slots, so no overlaps
        }

        // Convert existing slots to interval format for faster comparison
        const existingIntervals = existingSlots.map((slot) => {
            const slotStart = new Date(slot.startTime);
            const slotEnd = new Date(slotStart);
            slotEnd.setMinutes(slotEnd.getMinutes() + slot.duration);

            return {
                id: slot.timeSlotId,
                start: slotStart,
                end: slotEnd,
                timeslot: slot,
            };
        });

        // Sort all intervals by start time for efficient sweep line algorithm
        const allEvents: Array<{
            time: Date;
            isStart: boolean;
            isNew: boolean;
            slotId: string;
            slot: any;
        }> = [];

        // Add existing intervals
        existingIntervals.forEach((interval) => {
            allEvents.push({
                time: interval.start,
                isStart: true,
                isNew: false,
                slotId: interval.id,
                slot: interval.timeslot,
            });
            allEvents.push({
                time: interval.end,
                isStart: false,
                isNew: false,
                slotId: interval.id,
                slot: interval.timeslot,
            });
        });

        // Add new intervals
        newTimeSlots.forEach((interval) => {
            allEvents.push({
                time: interval.startTime,
                isStart: true,
                isNew: true,
                slotId: interval.id,
                slot: interval,
            });
            allEvents.push({
                time: interval.endTime,
                isStart: false,
                isNew: true,
                slotId: interval.id,
                slot: interval,
            });
        });

        // Sort events by time
        allEvents.sort((a, b) => a.time.getTime() - b.time.getTime());

        // Sweep line algorithm to detect overlaps
        const activeIntervals: Set<string> = new Set();

        for (const event of allEvents) {
            if (event.isStart) {
                // Check for overlaps only for new timeslots starting
                if (event.isNew && activeIntervals.size > 0) {
                    // If any existing interval is active when a new one starts, we have an overlap
                    const overlapSlotIds = Array.from(activeIntervals);
                    if (
                        overlapSlotIds.some(
                            (id) => !id.startsWith(event.slotId)
                        )
                    ) {
                        const newSlot = event.slot;
                        const existingSlot = existingIntervals.find((i) =>
                            activeIntervals.has(i.id)
                        )?.timeslot;

                        if (existingSlot) {
                            const newTime = new Date(
                                newSlot.startTime
                            ).toLocaleTimeString();
                            const existingTime = new Date(
                                existingSlot.startTime
                            ).toLocaleTimeString();

                            return Result.error(
                                new BusinessRuleError(
                                    `Cannot create a timeslot at ${newTime} that overlaps with an existing one at ${existingTime}`
                                )
                            );
                        }
                    }
                }

                activeIntervals.add(event.slotId);
            } else {
                // End event, remove from active set
                activeIntervals.delete(event.slotId);
            }
        }

        return Result.ok(true);
    }

    /**
     * Saves timeslots in a transaction with batched inserts for better performance
     */
    private async saveTimeSlotsInTransaction(
        barber: BarberORM,
        timeSlots: TimeSlotGenerated[]
    ): Promise<Result<TimeSlotORM[], Error>> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const insertedTimeSlots: TimeSlotORM[] = [];

            // Use larger batch size for better performance with prepared statements
            const BATCH_SIZE = 200;

            // Optimize by preparing batch inserts
            for (let i = 0; i < timeSlots.length; i += BATCH_SIZE) {
                const batch = timeSlots.slice(i, i + BATCH_SIZE);

                // Prepare values for batch insert
                const values = batch
                    .map(
                        (slot) =>
                            `('${slot.id}', '${this.formatDateForMySQL(
                                slot.startTime
                            )}', ${slot.duration}, false, '${barber.barberId}')`
                    )
                    .join(", ");

                if (values.length > 0) {
                    // Execute optimized batch insert
                    await queryRunner.query(
                        `INSERT INTO time_slot_orm (timeSlotId, startTime, duration, isBooked, barberId) VALUES ${values}`
                    );

                    // Fetch the inserted records
                    const insertedBatch = await queryRunner.query(
                        `SELECT * FROM time_slot_orm WHERE timeSlotId IN (${batch
                            .map((slot) => `'${slot.id}'`)
                            .join(",")})`
                    );

                    insertedTimeSlots.push(...insertedBatch);
                }
            }

            // Commit the transaction
            await queryRunner.commitTransaction();

            return Result.ok(insertedTimeSlots);
        } catch (error) {
            // Rollback on error
            await queryRunner.rollbackTransaction();

            if (error instanceof Error) {
                return Result.error(error);
            }

            return Result.error(new Error(String(error)));
        } finally {
            // Always release query runner
            await queryRunner.release();
        }
    }

    /**
     * Helper to format dates for MySQL
     */
    private formatDateForMySQL(date: Date): string {
        return date.toISOString().slice(0, 19).replace("T", " ");
    }
}
