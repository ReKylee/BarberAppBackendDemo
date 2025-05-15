import {
    Entity,
    Column,
    OneToMany,
    BeforeInsert,
    BeforeUpdate,
    Unique,
    PrimaryColumn,
} from "typeorm";
import { AppointmentORM } from "./AppointmentORM";

@Entity()
@Unique("UQ_USER_FIRSTNAME_LASTNAME", ["firstName", "lastName"])
export class UserORM {
    @PrimaryColumn()
    userId!: string;

    @Column()
    firstName!: string;

    @Column()
    lastName!: string;

    @Column()
    phoneNumber!: string;

    @OneToMany(() => AppointmentORM, (appt) => appt.user)
    appointments!: AppointmentORM[];

    @BeforeInsert()
    @BeforeUpdate()
    updateFullName() {
        this.firstName = this.firstName.toLowerCase();
        this.lastName = this.lastName.toLowerCase();
    }
}
