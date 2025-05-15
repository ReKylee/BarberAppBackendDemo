import { FullName } from "../../Domain/ValueObjects/FullName";
import { AppDataSource } from "../../Infra/Database/DataSource";
import { BaseService } from "../../Domain/Shared/BaseService";
import { Result } from "typescript-result";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";
import { BarberORM } from "../../Infra/ORM/BarberORM";
import { BarberMap } from "../../Infra/Mappers/BarberMap";
import { Barber } from "../../Domain/Entities/Barber";

export class BarberService extends BaseService<BarberORM> {
    barberMap: BarberMap;
    constructor() {
        super(AppDataSource.getRepository(BarberORM));
        this.barberMap = new BarberMap();
    }
    protected getIdFieldName() {
        return "barberId";
    }
    public async getBarberById(
        id: UniqueEntityID
    ): Promise<Result<Barber, any>> {
        const ormResult = await this.findById(id);

        return ormResult.map((orm) => {
            return this.barberMap.toDomain(orm);
        });
    }

    // Method to fetch all barbers and count them
    public async findAllAndCount(): Promise<Result<[Barber[], number], Error>> {
        return Result.try(async () => {
            const [barberORMs, count] = await this.repository.findAndCount();

            const domainResults = barberORMs.map((orm) =>
                this.barberMap.toDomain(orm)
            );

            const barbers = domainResults
                .filter((result) => result.isOk())
                .map((result) => result.value);

            const failedCount = domainResults.length - barbers.length;

            if (failedCount > 0) {
                console.warn(
                    `${failedCount} barber mappings failed during findAllAndCount`
                );
            }

            return [barbers, count] as [Barber[], number];
        });
    }

    public async findByName(
        fullName: FullName
    ): Promise<Result<Barber, Error>> {
        const entityResult = this.repository.findOneByOrFail({
            firstName: fullName.firstName,
            lastName: fullName.lastName,
        } as any);

        return Result.fromAsyncCatching(entityResult).map((orm) => {
            return this.barberMap.toDomain(orm);
        });
    }

    // Method to save a barber into the DB
    public async saveBarber(barber: Barber): Promise<Result<BarberORM, any>> {
        const orm = this.barberMap.toORM(barber);
        const saveResult = this.repository.save(orm);
        return await Result.fromAsyncCatching(saveResult);
    }
}
