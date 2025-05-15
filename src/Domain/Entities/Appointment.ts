import { DomainEntity } from "../Shared/DomainEntity";
import { UniqueEntityID } from "../ValueObjects/UniqueEntityID";
import { Barber } from "./Barber";
import { User } from "./User";
import { TimeSlot } from "./TimeSlot";
import { Result } from "typescript-result";

interface AppointmentProps {
    timeSlot: TimeSlot;
    user: User;
    barber: Barber;
    isCancelled: boolean;
    note?: string;
}

export class Appointment extends DomainEntity<AppointmentProps> {
    private constructor(props: AppointmentProps, id?: UniqueEntityID) {
        super(props, id);
    }

    public static create(props: AppointmentProps): Result<Appointment, Error> {
        return Result.try(() => new Appointment(props));
    }

    public static from(
        props: AppointmentProps,
        id: UniqueEntityID
    ): Result<Appointment, Error> {
        return Result.try(() => new Appointment(props, id));
    }

    public get isCancelled(): boolean {
        return this.props.isCancelled;
    }

    public get barber(): Barber {
        return this.props.barber;
    }

    public get user(): User {
        return this.props.user;
    }

    public get timeSlot(): TimeSlot {
        return this.props.timeSlot;
    }
    public get note(): string | undefined {
        return this.props.note;
    }
}
