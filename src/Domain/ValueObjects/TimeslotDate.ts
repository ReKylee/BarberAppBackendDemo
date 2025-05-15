import { Result } from "typescript-result";
import { z } from "zod";
import { ErrorMapper } from "../../Application/Errors/ErrorMapper";

const timeslotDateSchema = z.object({
    startDateTime: z.coerce.date(),
    duration: z.number().int().positive(),
});

export type TimeslotDateProps = z.infer<typeof timeslotDateSchema>;

export class TimeslotDate {
    private readonly startDateTime: Date;
    private readonly _duration: number;

    private constructor(startDateTime: Date, duration: number) {
        this.startDateTime = new Date(startDateTime);
        this._duration = duration;
    }

    public static create(
        startDateTime: Date,
        duration: number
    ): Result<TimeslotDate, Error> {
        const validationResult = timeslotDateSchema.safeParse({
            startDateTime,
            duration,
        });

        if (!validationResult.success) {
            return ErrorMapper.toResult(validationResult.error);
        }

        return Result.ok(
            new TimeslotDate(
                validationResult.data.startDateTime,
                validationResult.data.duration
            )
        );
    }

    public isInThePast(): boolean {
        const now = new Date();
        return this.startDateTime < now;
    }

    // Getters

    public get endTime(): Date {
        const endTime = new Date(this.startTime);
        endTime.setMinutes(endTime.getMinutes() + this.duration);
        return endTime;
    }

    public get startTime(): Date {
        return new Date(this.startDateTime);
    }

    public get duration(): number {
        return this._duration;
    }

    public get dayOfWeek(): number {
        return this.startDateTime.getDay();
    }

    public equals(other: TimeslotDate): boolean {
        return (
            this.startDateTime.getTime() === other.startDateTime.getTime() &&
            this.duration === other.duration
        );
    }

    public toString(): string {
        const dateOptions: Intl.DateTimeFormatOptions = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        };

        const timeOptions: Intl.DateTimeFormatOptions = {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        };

        const dateStr = this.startDateTime.toLocaleDateString(
            undefined,
            dateOptions
        );
        const startTimeStr = this.startDateTime.toLocaleTimeString(
            undefined,
            timeOptions
        );
        const endTimeStr = this.endTime.toLocaleTimeString(
            undefined,
            timeOptions
        );

        return `${dateStr} from ${startTimeStr} to ${endTimeStr} (${this.duration.toString()})`;
    }
}
