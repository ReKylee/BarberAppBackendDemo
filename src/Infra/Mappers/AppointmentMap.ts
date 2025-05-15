// src/Infra/Mappers/AppointmentMap.ts - Updated to work with TimeSlot
import { Result } from "typescript-result";
import { AppointmentDTO } from "../../Application/DTO/AppointmentDTO";
import { Appointment } from "../../Domain/Entities/Appointment";
import { AppointmentORM } from "../ORM/AppointmentORM";
import { BaseMapper } from "./BaseMapper";
import { UserMap } from "./UserMap";
import { BarberMap } from "./BarberMap";
import { TimeSlotMap } from "./TimeSlotMap";
import { BarberORM } from "../ORM/BarberORM";
import { UserORM } from "../ORM/UserORM";
import { TimeSlotORM } from "../ORM/TimeSlotORM";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";

export class AppointmentMap
    implements BaseMapper<Appointment, AppointmentORM, AppointmentDTO>
{
    constructor(
        private userMap: UserMap,
        private barberMap: BarberMap,
        private timeSlotMap: TimeSlotMap
    ) {}

    toDomain(
        source: AppointmentORM | AppointmentDTO
    ): Result<Appointment, Error> {
        if (source instanceof AppointmentORM) {
            // Check that user, barber, and timeSlot are loaded
            if (!source.user || !source.barber || !source.timeSlot) {
                return Result.error(
                    new Error(
                        "Cannot create Appointment domain object without user, barber, and timeSlot data"
                    )
                );
            }

            const userResult = this.userMap.toDomain(source.user);
            const barberResult = this.barberMap.toDomain(source.barber);
            const timeSlotResult = this.timeSlotMap.toDomain(source.timeSlot);
            const idResult = UniqueEntityID.from(source.appointmentId);

            return Result.allCatching(
                userResult,
                barberResult,
                timeSlotResult,
                idResult
            ).mapCatching(([user, barber, timeSlot, id]) => {
                // Use the scheduler to reconstitute the existing appointment
                return Appointment.from(
                    {
                        user: user,
                        barber: barber,
                        timeSlot: timeSlot,
                        isCancelled: source.isCancelled,
                        note: source.note,
                    },
                    id
                );
            });
        } else {
            // We can't directly convert a DTO to a domain entity without access to
            // the repositories to load the User, Barber, and TimeSlot entities
            return Result.error(
                new Error(
                    "Cannot convert AppointmentDTO directly to domain entity without user, barber, and timeSlot objects"
                )
            );
        }
    }

    toORM(appointment: Appointment): AppointmentORM {
        const orm = new AppointmentORM();
        orm.appointmentId = appointment.id.toString();
        orm.isCancelled = appointment.isCancelled;
        orm.user = { userId: appointment.user.id.toString() } as UserORM;
        orm.barber = {
            barberId: appointment.barber.id.toString(),
        } as BarberORM;
        orm.timeSlot = {
            timeSlotId: appointment.timeSlot.id.toString(),
        } as TimeSlotORM;
        orm.note = appointment?.note;
        return orm;
    }

    toDTO(appointment: Appointment): AppointmentDTO {
        return {
            id: appointment.id.toString(),
            timeSlotId: appointment.timeSlot.id.toString(),
            userId: appointment.user.id.toString(),
            barberId: appointment.barber.id.toString(),
            isCancelled: appointment.isCancelled,
            note: appointment.note,
        };
    }
}
