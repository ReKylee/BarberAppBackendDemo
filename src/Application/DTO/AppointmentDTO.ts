import { UniqueEntityIDProps } from "../../Domain/ValueObjects/UniqueEntityID";

export interface AppointmentDTO extends UniqueEntityIDProps {
    timeSlotId: string;
    userId: string;
    barberId: string;
    isCancelled: boolean;
    note?: string;
}

export type CreateAppointmentDTO = Omit<AppointmentDTO, "id">;
