import { Request, Response } from "express";
import { AppointmentService } from "../../Application/Services/AppointmentService";
import { CreateAppointmentDTO } from "../../Application/DTO/AppointmentDTO";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";
import { DomainError } from "../../Domain/Shared/DomainError";
import { ErrorMapper } from "../../Application/Errors/ErrorMapper";
import { UserService } from "../../Application/Services/UserService";
import { TimeSlotService } from "../../Application/Services/TimeSlotService";
import { UserMap } from "../../Infra/Mappers/UserMap";
import { BarberMap } from "../../Infra/Mappers/BarberMap";
import { TimeSlotMap } from "../../Infra/Mappers/TimeSlotMap";
import { AppointmentMap } from "../../Infra/Mappers/AppointmentMap";
import { Result } from "typescript-result";
import { AppointmentScheduler } from "../../Domain/Services/AppointmentScheduler";
import { AppointmentORM } from "../../Infra/ORM/AppointmentORM";

export class AppointmentController {
    private appointmentService: AppointmentService;
    private userService: UserService;
    private timeSlotService: TimeSlotService;
    private appointmentMap: AppointmentMap;
    private userMap: UserMap;
    private barberMap: BarberMap;
    private timeSlotMap: TimeSlotMap;

    constructor() {
        this.userService = new UserService();
        this.barberMap = new BarberMap();
        this.userMap = new UserMap();
        this.timeSlotMap = new TimeSlotMap(this.barberMap);
        this.appointmentMap = new AppointmentMap(
            this.userMap,
            this.barberMap,
            this.timeSlotMap
        );
        this.timeSlotService = new TimeSlotService();
        this.appointmentService = new AppointmentService();
    }

    private handleError(
        res: Response,
        error: any,
        defaultStatus: number = 500
    ): void {
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
            });
            return;
        }

        res.status(defaultStatus).json({
            type: "UNEXPECTED_ERROR",
            message: String(error),
        });
    }

    // Get all appointments
    public getAllAppointments = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const { status } = req.query;

        const filters: Partial<AppointmentORM> = {};

        if (status === "active") {
            filters.isCancelled = false;
        } else if (status === "cancelled") {
            filters.isCancelled = true;
        }
        const appointmentsResult =
            await this.appointmentService.findAllAndCount(filters);

        appointmentsResult.fold(
            ([appointments, count]) => {
                const appointmentDTOs = appointments.map((appointment) =>
                    this.appointmentMap.toDTO(appointment)
                );

                res.status(200).json({ count, appointments: appointmentDTOs });
            },
            (error) => this.handleError(res, error)
        );
    };

    // Get appointment by ID
    public getAppointmentById = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const idResult = UniqueEntityID.from(req.params.appointmentId);

        const dtoResult = idResult
            .map((id) => this.appointmentService.getAppointmentById(id))
            .map((appointment) => this.appointmentMap.toDTO(appointment));

        dtoResult.fold(
            (dto) => res.status(200).json(dto),
            (error) => this.handleError(res, error, 404)
        );
    };

    // Add to AppointmentController.ts
    public getAppointmentsByUserId = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const idResult = UniqueEntityID.from(req.params.userId);

        const appointmentsResult = idResult.map((id) =>
            this.appointmentService.findAppointmentsByUserId(id)
        );

        appointmentsResult.fold(
            ([appointments, count]) => {
                const appointmentDTOs = appointments.map((appointment) =>
                    this.appointmentMap.toDTO(appointment)
                );

                res.status(200).json({ count, appointments: appointmentDTOs });
            },
            (error) => this.handleError(res, error, 404)
        );
    };

    public getAppointmentsByBarberId = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const idResult = UniqueEntityID.from(req.params.barberId);

        const appointmentsResult = idResult.map((id) =>
            this.appointmentService.findAppointmentsByBarberId(id)
        );

        appointmentsResult.fold(
            ([appointments, count]) => {
                const appointmentDTOs = appointments.map((appointment) =>
                    this.appointmentMap.toDTO(appointment)
                );

                res.status(200).json({ count, appointments: appointmentDTOs });
            },
            (error) => this.handleError(res, error, 404)
        );
    };

    // Create a new appointment
    public createAppointment = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const appointmentRequest = req.body as CreateAppointmentDTO;

        // Get user and time slot entities from their IDs
        const userResult = await UniqueEntityID.from(
            appointmentRequest.userId
        ).map((id) => this.userService.getUserById(id));

        const timeSlotResult = await UniqueEntityID.from(
            appointmentRequest.timeSlotId
        ).map((id) => this.timeSlotService.getTimeSlotById(id));

        const domainAppointmentResult = Result.all(
            userResult,
            timeSlotResult
        ).mapCatching(([user, timeSlot]) =>
            AppointmentScheduler.scheduleAppointment(
                user,
                timeSlot,
                appointmentRequest.note
            )
        );

        await domainAppointmentResult.mapCatching(async (domain) => {
            await this.timeSlotService.saveTimeSlot(domain.timeSlot);
            await this.appointmentService.saveAppointment(domain);
        });

        domainAppointmentResult
            .map((domain) => this.appointmentMap.toDTO(domain))
            .fold(
                (dto) => res.status(201).json(dto),
                (error) => this.handleError(res, error, 400)
            );
    };

    public cancelAppointment = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const idResult = UniqueEntityID.from(req.params.appointmentId);

        const cancelResult = idResult
            .mapCatching((id) => this.appointmentService.getAppointmentById(id))
            .mapCatching((appointment) =>
                AppointmentScheduler.cancelAppointment(appointment)
            );

        await cancelResult.mapCatching(async (domain) => {
            await this.timeSlotService.saveTimeSlot(domain.timeSlot);
            await this.appointmentService.saveAppointment(domain);
        });

        cancelResult.fold(
            (appointment) =>
                res.status(200).json(this.appointmentMap.toDTO(appointment)),
            (error) => this.handleError(res, error, 400)
        );
    };
}
