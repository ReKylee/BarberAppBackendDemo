import { Request, Response } from "express";
import { UserService } from "../../Application/Services/UserService";
import { FullName } from "../../Domain/ValueObjects/FullName";
import { UserMap } from "../../Infra/Mappers/UserMap";
import { CreateUserDTO } from "../../Application/DTO/UserDTO";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";
import { DomainError } from "../../Domain/Shared/DomainError";
import { ErrorMapper } from "../../Application/Errors/ErrorMapper";
import { UserFactory } from "../../Domain/Factories/UserFactory";

export class UserController {
    private userService: UserService;
    private userMap: UserMap;

    constructor() {
        this.userService = new UserService();
        this.userMap = new UserMap();
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

    // Get all users
    public getAllUsers = async (
        _req: Request,
        res: Response
    ): Promise<void> => {
        const usersResult = await this.userService.findAllAndCount();

        usersResult.fold(
            ([users, count]) => {
                const userDTOs = users.map((user) => this.userMap.toDTO(user));

                res.status(200).json({ count, users: userDTOs });
            },
            (error) => this.handleError(res, error)
        );
    };

    public createUser = async (req: Request, res: Response): Promise<void> => {
        try {
            const userRequest = req.body as CreateUserDTO;

            const result = await UserFactory.new(userRequest)
                .mapCatching(async (user) =>
                    (await this.userService.saveUser(user)).map(() => user)
                )
                .mapCatching((user) => this.userMap.toDTO(user));

            result.fold(
                (dto) => res.status(201).json(dto),
                (error) => this.handleError(res, error, 400)
            );
        } catch (error) {
            this.handleError(res, error, 500);
        }
    };

    // Get user by ID
    public getUserById = async (req: Request, res: Response): Promise<void> => {
        const idResult = UniqueEntityID.from(req.params.id);

        const dtoResult = idResult
            .map((id) => this.userService.getUserById(id))
            .map((user) => this.userMap.toDTO(user));

        dtoResult.fold(
            (dto) => res.status(200).json(dto),
            (error) => this.handleError(res, error, 404)
        );
    };

    // Get user by name
    public getUserByName = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        const { firstName, lastName } = req.query;

        // Create a flat monadic pipeline
        await FullName.create(firstName, lastName)
            .map((fullName) => this.userService.findByName(fullName))
            .map((user) => this.userMap.toDTO(user))
            .fold(
                (dto) => res.status(200).json(dto),
                (error) => this.handleError(res, error, 400)
            );
    };
}
