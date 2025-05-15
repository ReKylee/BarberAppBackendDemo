import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryColumn,
} from "typeorm";
import { UserORM } from "./UserORM";
import { BarberORM } from "./BarberORM";
import { TimeSlotORM } from "./TimeSlotORM";

@Entity()
export class AppointmentORM {
    @PrimaryColumn()
    appointmentId!: string;

    @ManyToOne(() => UserORM, (user) => user.appointments)
    @JoinColumn({ name: "userId" })
    user!: UserORM;

    @ManyToOne(() => BarberORM, (barber) => barber.appointments)
    @JoinColumn({ name: "barberId" })
    barber!: BarberORM;

    @OneToOne(() => TimeSlotORM, (timeSlot) => timeSlot.appointment)
    @JoinColumn({ name: "timeSlotId" })
    timeSlot!: TimeSlotORM;

    @Column({ default: false })
    isCancelled!: boolean;

    @Column({ nullable: true, length: 200 })
    note?: string;
}
