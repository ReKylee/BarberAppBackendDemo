import { Result } from "typescript-result";
import { FullName } from "../ValueObjects/FullName";
import { UniqueEntityID } from "../ValueObjects/UniqueEntityID";
import { Barber } from "../Entities/Barber";
import { BarberDTO, CreateBarberDTO } from "../../Application/DTO/BarberDTO";

export class BarberFactory {
    public static from(dto: BarberDTO): Result<Barber, Error> {
        const combinedResult = Result.allCatching(
            FullName.create(dto.firstName, dto.lastName),
            UniqueEntityID.from(dto.id)
        );

        return combinedResult.map(([fullName, id]) =>
            Barber.from(
                {
                    fullName,
                },
                id
            )
        );
    }
    public static new(dto: CreateBarberDTO): Result<Barber, Error> {
        const combinedResult = Result.allCatching(
            FullName.create(dto.firstName, dto.lastName)
        );

        return combinedResult.map(([fullName]) =>
            Barber.create({
                fullName,
            })
        );
    }
}
