import { Result } from "typescript-result";
import { DomainEntity } from "../Shared/DomainEntity";
import { FullName } from "../ValueObjects/FullName";
import { PhoneNumber } from "../ValueObjects/PhoneNumber";
import { UniqueEntityID } from "../ValueObjects/UniqueEntityID";

interface UserProps {
    fullName: FullName;
    phoneNumber: PhoneNumber;
}

export class User extends DomainEntity<UserProps> {
    private constructor(props: UserProps, id?: UniqueEntityID) {
        super(props, id);
    }

    public static create(props: UserProps): Result<User, Error> {
        return Result.try(() => new User(props));
    }

    public static from(
        props: UserProps,
        id: UniqueEntityID
    ): Result<User, Error> {
        return Result.try(() => new User(props, id));
    }

    get fullName(): FullName {
        return this.props.fullName;
    }

    get phoneNumber(): PhoneNumber {
        return this.props.phoneNumber;
    }
}
