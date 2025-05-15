import { Result } from "typescript-result";
import { Appointment } from "../Entities/Appointment";
import { User } from "../Entities/User";
import { Barber } from "../Entities/Barber";
import { TimeSlot } from "../Entities/TimeSlot";
import { UniqueEntityID } from "../ValueObjects/UniqueEntityID";
import { BusinessRuleError } from "../Shared/DomainError";
import { BusinessHoursPolicy } from "../Policies/BusinessHoursPolicy";

export class AppointmentScheduler {
    // Schedule a new appointment with a time slot
    public static scheduleAppointment(
        user: User,
        timeSlot: TimeSlot,
        note?: string
    ): Result<Appointment, Error> {
        return timeSlot
            .isInThePast()
            .mapCatching((timeslot) => timeslot.book())
            .mapCatching((bookedTimeslot) =>
                Appointment.create({
                    user,
                    barber: bookedTimeslot.barber,
                    timeSlot: bookedTimeslot,
                    isCancelled: false,
                    note,
                })
            );
    }

    // Reconstruct an existing appointment
    public static reconstituteAppointment(
        user: User,
        barber: Barber,
        timeSlot: TimeSlot,
        isCancelled: boolean,
        id: UniqueEntityID
    ): Result<Appointment, Error> {
        return Appointment.from(
            {
                user,
                barber,
                timeSlot,
                isCancelled,
            },
            id
        );
    }

    public static cancelAppointment(
        appointment: Appointment
    ): Result<Appointment, Error> {
        if (
            !BusinessHoursPolicy.isCancellable(
                appointment.timeSlot.timeDate.startTime
            )
        ) {
            return Result.error(
                new BusinessRuleError("Cannot cancel appointment")
            );
        }

        // First unbook the time slot
        const unbookedTimeSlotResult = appointment.timeSlot.unbook();

        // Then create a cancelled appointment with the unbooked time slot
        return unbookedTimeSlotResult.mapCatching((unbookedTimeSlot) =>
            this.reconstituteAppointment(
                appointment.user,
                appointment.barber,
                unbookedTimeSlot, // Use the unbooked time slot
                true, // is cancelled
                appointment.id
            )
        );
    }
}
