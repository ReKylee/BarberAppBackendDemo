import { Result } from "typescript-result";
import { DomainEntity } from "../Shared/DomainEntity";
import { UniqueEntityID } from "../ValueObjects/UniqueEntityID";
import { Barber } from "./Barber";
import { BusinessRuleError } from "../Shared/DomainError";
import { TimeslotDate } from "../ValueObjects/TimeslotDate";

interface TimeSlotProps {
    date: TimeslotDate;
    barber: Barber;
    isBooked: boolean;
}

export class TimeSlot extends DomainEntity<TimeSlotProps> {
    private constructor(props: TimeSlotProps, id?: UniqueEntityID) {
        super(props, id);
    }

    public static create(props: TimeSlotProps): Result<TimeSlot, Error> {
        return Result.try(() => new TimeSlot(props));
    }

    public static from(
        props: TimeSlotProps,
        id: UniqueEntityID
    ): Result<TimeSlot, Error> {
        return Result.try(() => new TimeSlot(props, id));
    }

    public get timeDate(): TimeslotDate {
        return this.props.date;
    }

    public get barber(): Barber {
        return this.props.barber;
    }

    public get isBooked(): boolean {
        return this.props.isBooked;
    }

    // Create a booked version of this timeslot
    public book(): Result<TimeSlot, Error> {
        if (this.isBooked) {
            return Result.error(
                new BusinessRuleError("TimeSlot is already booked")
            );
        }

        return TimeSlot.from(
            {
                ...this.props,
                isBooked: true,
            },
            this.id
        );
    }

    // Create an available version of this timeslot
    public unbook(): Result<TimeSlot, Error> {
        if (!this.isBooked) {
            return Result.error(
                new BusinessRuleError("TimeSlot is not booked")
            );
        }

        return TimeSlot.from(
            {
                ...this.props,
                isBooked: false,
            },
            this.id
        );
    }

    public isInThePast(): Result<TimeSlot, Error> {
        if (this.timeDate.isInThePast()) {
            return Result.error(
                new BusinessRuleError(
                    "This time slot date is in the past and cannot be booked"
                )
            );
        }
        return Result.ok(this);
    }
}
