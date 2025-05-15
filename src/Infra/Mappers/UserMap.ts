import { Result } from "typescript-result";
import { User } from "../../Domain/Entities/User";
import { UserORM } from "../ORM/UserORM";
import { BaseMapper } from "./BaseMapper";
import { UserDTO } from "../../Application/DTO/UserDTO";
import { UserFactory } from "../../Domain/Factories/UserFactory";

export class UserMap implements BaseMapper<User, UserORM, UserDTO> {
    toDomain(source: UserDTO | UserORM): Result<User, any> {
        if (source instanceof UserORM) {
            return UserFactory.from({
                id: source.userId,
                firstName: source.firstName.toLowerCase(),
                lastName: source.lastName.toLowerCase(),
                phoneNumber: source.phoneNumber,
            });
        }
        return UserFactory.from(source);
    }
    toORM(user: User): UserORM {
        const orm = new UserORM();
        orm.userId = user.id.toString();
        orm.firstName = user.fullName.firstName.toLowerCase();
        orm.lastName = user.fullName.lastName.toLowerCase();
        orm.phoneNumber = user.phoneNumber.getE164Format();
        return orm;
    }

    toDTO(user: User): UserDTO {
        return {
            id: user.id.toString(),
            firstName: user.fullName.firstName.toLowerCase(),
            lastName: user.fullName.lastName.toLowerCase(),
            phoneNumber: user.phoneNumber.getE164Format(),
        };
    }
}
