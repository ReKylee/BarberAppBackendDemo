import { Request, Response } from "express";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";
import { DomainError, ValidationError } from "../../Domain/Shared/DomainError";
import { ErrorMapper } from "../../Application/Errors/ErrorMapper";
import { TimeSlotService } from "../../Application/Services/TimeSlotService";
import { TimeSlotMap } from "../../Infra/Mappers/TimeSlotMap";
import { BarberMap } from "../../Infra/Mappers/BarberMap";
import {
    CreateTimeSlotDTO,
    WeeklyScheduleDTO,
} from "../../Application/DTO/TimeSlotDTO";
import { Result } from "typescript-result";
import { TimeSlotFactory } from "../../Domain/Factories/TimeSlotFactory";
import { TimeSlotORM } from "../../Infra/ORM/TimeSlotORM";
import { WeeklyScheduleService } from "../../Application/Services/WeeklyScheduleService";

export class TimeSlotController {
    private timeSlotService: TimeSlotService;
    private weeklyScheduleService: WeeklyScheduleService;
    private timeSlotMap: TimeSlotMap;
    private barberMap: BarberMap;

    constructor() {
        this.barberMap = new BarberMap();
        this.timeSlotMap = new TimeSlotMap(this.barberMap);
        this.timeSlotService = new TimeSlotService();
        this.weeklyScheduleService = new WeeklyScheduleService();
    }

    private handleError(
        res: Response,
        error: any,
        defaultStatus: number = 500
    ): void {
        // Try to get a more informative stack trace
        if (error instanceof Error) {
            console.log("Error stack:", error.stack);
        }

        // If it's stringifiable, log the JSON
        try {
            console.log("Error content:", JSON.stringify(error, null, 2));
        } catch (e) {
            console.log("Error cannot be stringified");
        }

        // Add detailed error diagnosis
        if (error instanceof ValidationError) {
            console.log("ValidationError detected! Errors:", error.serialize());
        }

        // Handle different error types
        if (error instanceof DomainError) {
            res.status(error.getStatusCode()).json(error.serialize());
            return;
        }

        if (error instanceof Error) {
            const result = ErrorMapper.toResult(error);

            if (result && result.error) {
                res.status(result.error.getStatusCode()).json(
                    result.error.serialize()
                );
                return;
            }

            res.status(defaultStatus).json({
                type: "UNEXPECTED_ERROR",
                message: error.message || "An unexpected error occurred",
                stack:
                    process.env.NODE_ENV !== "production"
                        ? error.stack
                        : undefined,
            });
            return;
        }

        res.status(defaultStatus).json({
            type: "UNEXPECTED_ERROR",
            message: String(error),
        });
    }

    // Get time slot by ID
    public getTimeSlotById = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const idResult = UniqueEntityID.from(req.params.timeslotId);

        const timeSlotResult = await idResult.mapCatching((id) =>
            this.timeSlotService.getTimeSlotById(id)
        );

        timeSlotResult
            .mapCatching((timeSlot) => this.timeSlotMap.toDTO(timeSlot))
            .fold(
                (dto) => res.status(200).json(dto),
                (error) => this.handleError(res, error, 404)
            );
    };

    // Get time slots by barber ID
    public getTimeSlotsByBarberId = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const idResult = UniqueEntityID.from(req.params.barberId);
        const { status } = req.query;

        const filters: Partial<TimeSlotORM> = {};

        if (status === "free") {
            filters.isBooked = false;
        } else if (status === "taken") {
            filters.isBooked = true;
        }

        const timeSlotsResult = await idResult.mapCatching((id) =>
            this.timeSlotService.findTimeSlotsByBarberId(id, filters)
        );

        timeSlotsResult.fold(
            ([timeSlots, count]) => {
                const timeSlotDTOs = timeSlots.map((timeSlot) =>
                    this.timeSlotMap.toDTO(timeSlot)
                );

                res.status(200).json({ count, timeSlots: timeSlotDTOs });
            },
            (error) => this.handleError(res, error, 404)
        );
    };

    // Create a new time slot
    public createTimeSlot = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const barberId = req.params.barberId;

        const timeSlotRequest: CreateTimeSlotDTO = {
            ...req.body,
            barberId: barberId,
        };

        // Save the time slot
        const savedTimeSlotResult = await Result.fromAsyncCatching(
            TimeSlotFactory.new(timeSlotRequest)
        )
            .mapCatching(
                async (timeSlot) =>
                    await this.timeSlotService.hasOverlap(timeSlot)
            )
            .mapCatching(async (timeSlot) => {
                const saveResult = await this.timeSlotService.saveTimeSlot(
                    timeSlot
                );
                return saveResult.map(() => timeSlot);
            });

        // Convert to DTO and respond
        savedTimeSlotResult
            .map((timeSlot) => this.timeSlotMap.toDTO(timeSlot))
            .fold(
                (dto) => res.status(201).json(dto),
                (error) => this.handleError(res, error, 400)
            );
    };

    // Delete a time slot
    public deleteTimeSlot = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const barberIdResult = UniqueEntityID.from(req.params.barberId);
        const timeSlotIdResult = UniqueEntityID.from(req.params.timeslotId);

        const deleteResult = await Result.allCatching(
            barberIdResult,
            timeSlotIdResult
        ).mapCatching(async ([barberId, timeSlotId]) =>
            this.timeSlotService.deleteTimeSlot(timeSlotId, barberId)
        );

        deleteResult.fold(
            () => res.status(204).send(),
            (error) => this.handleError(res, error, 400)
        );
    };

    // Create a weekly schedule for a barber
    public createWeeklySchedule = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const barberIdResult = UniqueEntityID.from(req.params.barberId);
        const scheduleRequest = req.body as WeeklyScheduleDTO;

        const timeSlotsResult = await barberIdResult.mapCatching(
            async (barberId) =>
                this.weeklyScheduleService.createWeeklySchedule(
                    barberId,
                    scheduleRequest
                )
        );

        timeSlotsResult.fold(
            (timeSlots) => {
                res.status(201).json({
                    count: timeSlots.length,
                    message: `Created ${timeSlots.length} time slots for barber`,
                });
            },
            (error) => this.handleError(res, error, 400)
        );
    };
}
