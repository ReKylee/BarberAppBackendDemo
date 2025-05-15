import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryColumn,
} from "typeorm";
import { BarberORM } from "./BarberORM";
import { AppointmentORM } from "./AppointmentORM";

@Entity()
export class TimeSlotORM {
    @PrimaryColumn()
    timeSlotId!: string;

    @Column({ type: "datetime" })
    startTime!: Date;

    @Column()
    duration!: number;

    @Column({ default: false })
    isBooked!: boolean;

    @ManyToOne(() => BarberORM, (barber) => barber.timeSlots)
    @JoinColumn({ name: "barberId" })
    barber!: BarberORM;

    @OneToOne(() => AppointmentORM, (appointment) => appointment.timeSlot, {
        nullable: true,
    })
    appointment?: AppointmentORM;
}

