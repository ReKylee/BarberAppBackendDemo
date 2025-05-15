import { Result } from "typescript-result";
import { Appointment } from "../../Domain/Entities/Appointment";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";
import { AppDataSource } from "../../Infra/Database/DataSource";
import { AppointmentORM } from "../../Infra/ORM/AppointmentORM";
import { BaseService } from "../../Domain/Shared/BaseService";
import { UserMap } from "../../Infra/Mappers/UserMap";
import { BarberMap } from "../../Infra/Mappers/BarberMap";
import { TimeSlotMap } from "../../Infra/Mappers/TimeSlotMap";
import { AppointmentMap } from "../../Infra/Mappers/AppointmentMap";
import { FindManyOptions } from "typeorm";

export class AppointmentService extends BaseService<AppointmentORM> {
    private appointmentMap: AppointmentMap;
    private userMap: UserMap;
    private barberMap: BarberMap;
    private timeSlotMap: TimeSlotMap;

    constructor() {
        super(AppDataSource.getRepository(AppointmentORM));
        this.userMap = new UserMap();
        this.barberMap = new BarberMap();
        this.timeSlotMap = new TimeSlotMap(this.barberMap);
        this.appointmentMap = new AppointmentMap(
            this.userMap,
            this.barberMap,
            this.timeSlotMap
        );
    }

    protected getIdFieldName() {
        return "appointmentId";
    }

    public async getAppointmentById(
        id: UniqueEntityID
    ): Promise<Result<Appointment, any>> {
        return Result.try(async () => {
            const orm = await this.repository.findOneOrFail({
                where: { appointmentId: id.toString() },
                relations: {
                    user: true,
                    barber: true,
                    timeSlot: { barber: true },
                },
            });

            return this.appointmentMap.toDomain(orm);
        });
    }

    public async findAllAndCount(
        filters: Partial<AppointmentORM> = {}
    ): Promise<Result<[Appointment[], number], Error>> {
        return Result.try(async () => {
            const findOptions: FindManyOptions<AppointmentORM> = {
                where: filters,
                relations: {
                    user: true,
                    barber: true,
                    timeSlot: { barber: true },
                },
            };

            const [appointmentORMs, count] = await this.repository.findAndCount(
                findOptions
            );

            const domainResults = await Promise.all(
                appointmentORMs.map((orm) => this.appointmentMap.toDomain(orm))
            );

            const appointments = domainResults
                .filter((result) => result.isOk())
                .map((result) => result.value);

            const failedCount = domainResults.length - appointments.length;
            if (failedCount > 0) {
                console.warn(
                    `${failedCount} appointment mappings failed during findAndCount`
                );
            }

            return [appointments, count] as [Appointment[], number];
        });
    }

    // Find appointments by user ID
    public async findAppointmentsByUserId(
        userId: UniqueEntityID,
        filters: Partial<AppointmentORM> = {}
    ): Promise<Result<[Appointment[], number], Error>> {
        return Result.try(async () => {
            const [appointmentORMs, count] = await this.repository.findAndCount(
                {
                    relations: {
                        user: true,
                        barber: true,
                        timeSlot: { barber: true },
                    },
                    where: {
                        user: { userId: userId.toString() },
                        ...filters,
                    },
                }
            );

            const domainResults = await Promise.all(
                appointmentORMs.map((orm) => this.appointmentMap.toDomain(orm))
            );

            const appointments = domainResults
                .filter((result) => result.isOk())
                .map((result) => result.value);

            return [appointments, count] as [Appointment[], number];
        });
    }

    // Find appointments by barber ID
    public async findAppointmentsByBarberId(
        barberId: UniqueEntityID,
        filters: Partial<AppointmentORM> = {}
    ): Promise<Result<[Appointment[], number], Error>> {
        return Result.try(async () => {
            const [appointmentORMs, count] = await this.repository.findAndCount(
                {
                    relations: {
                        user: true,
                        barber: true,
                        timeSlot: { barber: true },
                    },
                    where: {
                        barber: { barberId: barberId.toString() },
                        ...filters,
                    },
                }
            );

            const domainResults = await Promise.all(
                appointmentORMs.map((orm) => this.appointmentMap.toDomain(orm))
            );

            const appointments = domainResults
                .filter((result) => result.isOk())
                .map((result) => result.value);

            return [appointments, count] as [Appointment[], number];
        });
    }
    public async saveAppointment(
        appointment: Appointment
    ): Promise<Result<AppointmentORM, any>> {
        const orm = this.appointmentMap.toORM(appointment);
        const saveResult = this.repository.save(orm);
        return await Result.fromAsyncCatching(saveResult);
    }
}
