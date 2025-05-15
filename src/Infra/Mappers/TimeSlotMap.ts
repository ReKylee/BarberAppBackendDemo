import { Result } from "typescript-result";
import { TimeSlotDTO } from "../../Application/DTO/TimeSlotDTO";
import { TimeSlot } from "../../Domain/Entities/TimeSlot";
import { TimeSlotORM } from "../ORM/TimeSlotORM";
import { BaseMapper } from "./BaseMapper";
import { BarberMap } from "./BarberMap";
import { BarberORM } from "../ORM/BarberORM";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";
import { TimeslotDate } from "../../Domain/ValueObjects/TimeslotDate";

export class TimeSlotMap
    implements BaseMapper<TimeSlot, TimeSlotORM, TimeSlotDTO>
{
    constructor(private barberMap: BarberMap) {}

    toDomain(source: TimeSlotORM | TimeSlotDTO): Result<TimeSlot, Error> {
        if (source instanceof TimeSlotORM) {
            // Check that barber is loaded
            if (!source.barber) {
                return Result.error(
                    new Error(
                        "Cannot create TimeSlot domain object without barber data"
                    )
                );
            }

            const barberResult = this.barberMap.toDomain(source.barber);
            const idResult = UniqueEntityID.from(source.timeSlotId);
            const timeDateResult = TimeslotDate.create(
                source.startTime,
                source.duration
            );
            return Result.allCatching(
                barberResult,
                idResult,
                timeDateResult
            ).mapCatching(([barber, id, timedate]) => {
                return TimeSlot.from(
                    {
                        date: timedate,
                        isBooked: source.isBooked,
                        barber: barber,
                    },
                    id
                );
            });
        } else {
            // We can't directly convert a DTO to a domain entity without accessing the barber
            return Result.error(
                new Error(
                    "Cannot convert TimeSlotDTO directly to domain entity without barber object"
                )
            );
        }
    }

    toORM(timeSlot: TimeSlot): TimeSlotORM {
        const orm = new TimeSlotORM();
        orm.timeSlotId = timeSlot.id.toString();
        orm.startTime = timeSlot.timeDate.startTime;
        orm.duration = timeSlot.timeDate.duration;
        orm.isBooked = timeSlot.isBooked;
        orm.barber = { barberId: timeSlot.barber.id.toString() } as BarberORM;
        return orm;
    }

    toDTO(timeSlot: TimeSlot): TimeSlotDTO {
        return {
            id: timeSlot.id.toString(),
            startDateTime: timeSlot.timeDate.startTime,
            duration: timeSlot.timeDate.duration,
            isBooked: timeSlot.isBooked,
            barberId: timeSlot.barber.id.toString(),
        };
    }
}

