import { FindManyOptions } from "typeorm";
import { Result } from "typescript-result";
import { TimeSlot } from "../../Domain/Entities/TimeSlot";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";
import { AppDataSource } from "../../Infra/Database/DataSource";
import { TimeSlotORM } from "../../Infra/ORM/TimeSlotORM";
import { BaseService } from "../../Domain/Shared/BaseService";
import { BarberMap } from "../../Infra/Mappers/BarberMap";
import { TimeSlotMap } from "../../Infra/Mappers/TimeSlotMap";
import { BusinessRuleError } from "../../Domain/Shared/DomainError";

export class TimeSlotService extends BaseService<TimeSlotORM> {
    private timeSlotMap: TimeSlotMap;
    public barberMap: BarberMap;

    constructor() {
        super(AppDataSource.getRepository(TimeSlotORM));
        this.barberMap = new BarberMap();
        this.timeSlotMap = new TimeSlotMap(this.barberMap);
    }

    protected getIdFieldName() {
        return "timeSlotId";
    }

    public async getTimeSlotById(
        id: UniqueEntityID
    ): Promise<Result<TimeSlot, Error>> {
        return Result.try(async () => {
            const orm = await this.repository.findOneOrFail({
                where: { timeSlotId: id.toString() },
                relations: {
                    barber: true,
                },
            });

            return this.timeSlotMap.toDomain(orm);
        });
    }

    public async findAllAndCount(
        filters: Partial<TimeSlotORM> = {}
    ): Promise<Result<[TimeSlot[], number], Error>> {
        return Result.try(async () => {
            const findOptions: FindManyOptions<TimeSlotORM> = {
                where: filters,
                relations: {
                    barber: true,
                },
            };

            const [timeSlotORMs, count] = await this.repository.findAndCount(
                findOptions
            );

            const domainResults = timeSlotORMs.map((orm) =>
                this.timeSlotMap.toDomain(orm)
            );

            const timeSlots = domainResults
                .filter((result) => result.isOk())
                .map((result) => result.value);

            const failedCount = domainResults.length - timeSlots.length;
            if (failedCount > 0) {
                console.warn(
                    `${failedCount} timeSlot mappings failed during findAndCount`
                );
            }

            return [timeSlots, count] as [TimeSlot[], number];
        });
    }

    // Find timeslots by barber ID
    public async findTimeSlotsByBarberId(
        barberId: UniqueEntityID,
        filters: Partial<TimeSlotORM> = {}
    ): Promise<Result<[TimeSlot[], number], Error>> {
        return Result.try(async () => {
            const [timeSlotORMs, count] = await this.repository.findAndCount({
                relations: {
                    barber: true,
                },
                where: {
                    barber: { barberId: barberId.toString() },
                    ...filters,
                },
            });

            const domainResults = timeSlotORMs.map((orm) =>
                this.timeSlotMap.toDomain(orm)
            );

            const timeSlots = domainResults
                .filter((result) => result.isOk())
                .map((result) => result.value);

            return [timeSlots, count] as [TimeSlot[], number];
        });
    }

    // Save a timeslot
    public async saveTimeSlot(
        timeSlot: TimeSlot
    ): Promise<Result<TimeSlotORM, Error>> {
        const orm = this.timeSlotMap.toORM(timeSlot);
        const saveResult = this.repository.save(orm);
        return await Result.fromAsyncCatching(saveResult);
    }

    // Delete a timeslot
    public async deleteTimeSlot(
        timeSlotId: UniqueEntityID,
        barberId: UniqueEntityID
    ): Promise<Result<void, Error>> {
        return Result.try(async () => {
            // First check if this timeslot exists and belongs to the specified barber
            const timeSlot = await this.repository.findOneOrFail({
                where: {
                    timeSlotId: timeSlotId.toString(),
                    barber: { barberId: barberId.toString() },
                },
            });

            // Check if this timeslot is booked
            if (timeSlot.isBooked) {
                throw new BusinessRuleError(
                    "Cannot delete a timeslot that is currently booked"
                );
            }

            await this.repository.remove(timeSlot);
        });
    }
    public async hasOverlap(
        timeSlot: TimeSlot,
        excludeTimeSlotId?: string
    ): Promise<Result<TimeSlot, Error>> {
        return Result.try(async () => {
            // Get key values
            const startTime = timeSlot.timeDate.startTime;
            const duration = timeSlot.timeDate.duration;
            const barberId = timeSlot.barber.id.toString();

            // Calculate end time - explicitly create a new Date to avoid reference issues
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + duration);

            // Log for debugging
            console.log("Checking overlap for:", {
                barberId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration,
            });

            // Use raw SQL for more control and clarity
            const overlapQuery = `
            SELECT COUNT(*) as count 
            FROM time_slot_orm ts
            WHERE ts.barberId = ?
            AND (
                (ts.startTime < ?) -- existing starts before new ends
                AND 
                (DATE_ADD(ts.startTime, INTERVAL ts.duration MINUTE) > ?) -- existing ends after new starts
            )
            ${excludeTimeSlotId ? "AND ts.timeSlotId != ?" : ""}
        `;

            const parameters = [barberId, endTime, startTime];
            if (excludeTimeSlotId) {
                parameters.push(excludeTimeSlotId);
            }

            // Execute the query
            const result = await this.repository.query(
                overlapQuery,
                parameters
            );
            const count = parseInt(result[0]?.count || "0", 10);

            if (count > 0) {
                // For debugging, find the conflicting slots
                const conflictQuery = `
                SELECT * FROM time_slot_orm ts
                WHERE ts.barberId = ?
                AND (
                    (ts.startTime < ?) 
                    AND 
                    (DATE_ADD(ts.startTime, INTERVAL ts.duration MINUTE) > ?)
                )
                ${excludeTimeSlotId ? "AND ts.timeSlotId != ?" : ""}
            `;

                const conflicts = await this.repository.query(
                    conflictQuery,
                    parameters
                );
                console.log(
                    "Conflicting slots:",
                    JSON.stringify(conflicts, null, 2)
                );

                throw new BusinessRuleError(
                    "Cannot create a timeslot that overlaps with an existing one"
                );
            }

            return timeSlot;
        });
    }
}
