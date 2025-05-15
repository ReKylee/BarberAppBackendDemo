// src/Infra/ORM/BarberORM.ts - Updated to include timeSlots
import {
    Entity,
    Column,
    OneToMany,
    BeforeUpdate,
    BeforeInsert,
    Unique,
    PrimaryColumn,
} from "typeorm";
import { AppointmentORM } from "./AppointmentORM";
import { TimeSlotORM } from "./TimeSlotORM";

@Entity()
@Unique("UQ_BARBER_FIRSTNAME_LASTNAME", ["firstName", "lastName"])
export class BarberORM {
    @PrimaryColumn()
    barberId!: string;

    @Column()
    firstName!: string;

    @Column()
    lastName!: string;

    @OneToMany(() => AppointmentORM, (appt) => appt.barber)
    appointments!: AppointmentORM[];

    @OneToMany(() => TimeSlotORM, (slot) => slot.barber)
    timeSlots!: TimeSlotORM[];

    @BeforeInsert()
    @BeforeUpdate()
    updateFullName() {
        this.firstName = this.firstName.toLowerCase();
        this.lastName = this.lastName.toLowerCase();
    }
}
