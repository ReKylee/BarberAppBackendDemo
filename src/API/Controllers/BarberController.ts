import { Request, Response } from "express";
import { FullName } from "../../Domain/ValueObjects/FullName";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";
import { DomainError } from "../../Domain/Shared/DomainError";
import { ErrorMapper } from "../../Application/Errors/ErrorMapper";
import { BarberService } from "../../Application/Services/BarberService";
import { BarberMap } from "../../Infra/Mappers/BarberMap";
import { BarberFactory } from "../../Domain/Factories/BarberFactory";
import { CreateBarberDTO } from "../../Application/DTO/BarberDTO";

export class BarberController {
    private barberService: BarberService;
    private barberMap: BarberMap;

    constructor() {
        this.barberService = new BarberService();
        this.barberMap = new BarberMap();
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

    // Get all barbers
    public getAllBarbers = async (
        _req: Request,
        res: Response
    ): Promise<void> => {
        const barbersResult = await this.barberService.findAllAndCount();

        barbersResult.fold(
            ([barbers, count]) => {
                const barberDTOs = barbers.map((barber) =>
                    this.barberMap.toDTO(barber)
                );

                res.status(200).json({ count, barbers: barberDTOs });
            },
            (error) => this.handleError(res, error)
        );
    };

    // Create a new barber
    public createBarber = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const barberRequest = req.body as CreateBarberDTO;

            const result = await BarberFactory.new(barberRequest)
                .mapCatching(async (barber) =>
                    (
                        await this.barberService.saveBarber(barber)
                    ).map(() => barber)
                )
                .mapCatching((barber) => this.barberMap.toDTO(barber));

            result.fold(
                (dto) => res.status(201).json(dto),
                (error) => this.handleError(res, error, 400)
            );
        } catch (error) {
            this.handleError(res, error, 500);
        }
    };

    // Get barber by ID
    public getBarberById = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const idResult = UniqueEntityID.from(req.params.barberId);

        const dtoResult = idResult
            .mapCatching(
                async (id) => await this.barberService.getBarberById(id)
            )
            .mapCatching((barber) => this.barberMap.toDTO(barber));

        dtoResult.fold(
            (dto) => res.status(200).json(dto),
            (error) => this.handleError(res, error, 404)
        );
    };

    // Get barber by name
    public getBarberByName = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const { firstName, lastName } = req.query;

        // Create a flat monadic pipeline
        await FullName.create(firstName, lastName)
            .mapCatching((fullName) => this.barberService.findByName(fullName))
            .mapCatching((barber) => this.barberMap.toDTO(barber))
            .fold(
                (dto) => res.status(200).json(dto),
                (error) => this.handleError(res, error, 400)
            );
    };
}
