import { Result } from "typescript-result";
import { FullName } from "../ValueObjects/FullName";
import { DomainEntity } from "../Shared/DomainEntity";
import { UniqueEntityID } from "../ValueObjects/UniqueEntityID";

interface BarberProps {
    fullName: FullName;
}

export class Barber extends DomainEntity<BarberProps> {
    private constructor(props: BarberProps, id?: UniqueEntityID) {
        super(props, id);
    }

    public static create(props: BarberProps): Result<Barber, Error> {
        return Result.try(() => new Barber(props));
    }

    public static from(
        props: BarberProps,
        id: UniqueEntityID
    ): Result<Barber, Error> {
        return Result.try(() => new Barber(props, id));
    }

    public get fullName(): FullName {
        return this.props.fullName;
    }
}
