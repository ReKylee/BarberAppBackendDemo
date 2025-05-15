import { Result } from "typescript-result";
import { CreateUserDTO, UserDTO } from "../../Application/DTO/UserDTO";
import { User } from "../Entities/User";
import { PhoneNumber } from "../ValueObjects/PhoneNumber";
import { FullName } from "../ValueObjects/FullName";
import { UniqueEntityID } from "../ValueObjects/UniqueEntityID";

export class UserFactory {
    public static from(dto: UserDTO): Result<User, Error> {
        const combinedResult = Result.allCatching(
            FullName.create(dto.firstName, dto.lastName),
            PhoneNumber.create(dto.phoneNumber),
            UniqueEntityID.from(dto.id)
        );

        return combinedResult.map(([fullName, phoneNumber, id]) =>
            User.from(
                {
                    fullName,
                    phoneNumber,
                },
                id
            )
        );
    }
    public static new(dto: CreateUserDTO): Result<User, Error> {
        const combinedResult = Result.allCatching(
            FullName.create(dto.firstName, dto.lastName),
            PhoneNumber.create(dto.phoneNumber)
        );

        return combinedResult.map(([fullName, phoneNumber]) =>
            User.create({
                fullName,
                phoneNumber,
            })
        );
    }
}
