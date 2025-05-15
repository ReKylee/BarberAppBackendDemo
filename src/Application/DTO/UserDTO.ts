import { FullNameProps } from "../../Domain/ValueObjects/FullName";
import { PhoneNumberProps } from "../../Domain/ValueObjects/PhoneNumber";
import { UniqueEntityIDProps } from "../../Domain/ValueObjects/UniqueEntityID";

export interface UserDTO
    extends FullNameProps,
        PhoneNumberProps,
        UniqueEntityIDProps {}

export type CreateUserDTO = Omit<UserDTO, "id">;
