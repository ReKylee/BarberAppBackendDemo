import { Result } from "typescript-result";
import {
    CreateTimeSlotDTO,
    TimeSlotDTO,
} from "../../Application/DTO/TimeSlotDTO";
import { TimeSlot } from "../Entities/TimeSlot";
import { BarberService } from "../../Application/Services/BarberService";
import { UniqueEntityID } from "../ValueObjects/UniqueEntityID";
import { TimeslotDate } from "../ValueObjects/TimeslotDate";
import { BusinessHoursPolicy } from "../Policies/BusinessHoursPolicy";

export class TimeSlotFactory {
    private static barberService = new BarberService();

    public static from(dto: TimeSlotDTO): Promise<Result<TimeSlot, Error>> {
        const idResult = UniqueEntityID.from(dto.id);
        const barberIdResult = UniqueEntityID.from(dto.barberId);
        const timeDateResult = TimeslotDate.create(
            dto.startDateTime,
            dto.duration
        );

        return Result.allCatching(
            idResult,
            barberIdResult,
            timeDateResult
        ).mapCatching(async ([id, barberId, timeDate]) => {
            const barberResult = await this.barberService.getBarberById(
                barberId
            );

            return barberResult.mapCatching((barber) => {
                return TimeSlot.from(
                    {
                        date: timeDate,
                        isBooked: dto.isBooked,
                        barber: barber,
                    },
                    id
                );
            });
        });
    }

    public static new(
        dto: CreateTimeSlotDTO
    ): Promise<Result<TimeSlot, Error>> {
        const barberIdResult = UniqueEntityID.from(dto.barberId);
        const timeDateResult =
            // When creating a new TimeSlot, check if it's within business hours
            BusinessHoursPolicy.isWithinBusinessHours(
                dto.startDateTime
            ).mapCatching((date) => TimeslotDate.create(date, dto.duration));

        return Result.allCatching(barberIdResult, timeDateResult).mapCatching(
            async ([barberId, timeDate]) => {
                const barberResult = await this.barberService.getBarberById(
                    barberId
                );

                return barberResult.mapCatching((barber) => {
                    return TimeSlot.create({
                        date: timeDate,
                        isBooked: dto.isBooked || false,
                        barber: barber,
                    });
                });
            }
        );
    }
}
