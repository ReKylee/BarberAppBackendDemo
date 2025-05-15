import { Result } from "typescript-result";
import { BusinessRuleError } from "../Shared/DomainError";

export class BusinessHoursPolicy {
    static readonly HOURS_START = 9;
    static readonly HOURS_END = 23;
    static readonly CANCELLATION_WINDOW_HOURS = 4;

    static isWithinBusinessHours(datetime: Date): Result<Date, Error> {
        const date = new Date(datetime);
        const hours = date.getHours();
        const minutes = date.getMinutes();

        if (hours < this.HOURS_START || hours > this.HOURS_END) {
            return Result.error(
                new BusinessRuleError(
                    `Time must be between ${this.HOURS_START}:00 and ${this.HOURS_END}:00`
                )
            );
        }

        if (hours === this.HOURS_END && minutes > 0) {
            return Result.error(
                new BusinessRuleError(
                    `Time cannot be after ${this.HOURS_END}:00`
                )
            );
        }

        return Result.ok(date);
    }

    static isCancellable(appointmentDate: Date): boolean {
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + this.CANCELLATION_WINDOW_HOURS);
        return appointmentDate > deadline;
    }
}
