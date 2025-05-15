import { User } from "../../Domain/Entities/User";
import { FullName } from "../../Domain/ValueObjects/FullName";
import { AppDataSource } from "../../Infra/Database/DataSource";
import { UserMap } from "../../Infra/Mappers/UserMap";
import { UserORM } from "../../Infra/ORM/UserORM";
import { BaseService } from "../../Domain/Shared/BaseService";
import { Result } from "typescript-result";
import { UniqueEntityID } from "../../Domain/ValueObjects/UniqueEntityID";

export class UserService extends BaseService<UserORM> {
    userMap: UserMap;
    constructor() {
        super(AppDataSource.getRepository(UserORM));
        this.userMap = new UserMap();
    }
    protected getIdFieldName() {
        return "userId";
    }
    public async getUserById(id: UniqueEntityID): Promise<Result<User, any>> {
        const ormResult = await this.findById(id);

        return ormResult.map((orm) => {
            return this.userMap.toDomain(orm);
        });
    }

    // Method to fetch all users and count them
    public async findAllAndCount(): Promise<Result<[User[], number], Error>> {
        return Result.try(async () => {
            const [userORMs, count] = await this.repository.findAndCount();

            const domainResults = userORMs.map((orm) =>
                this.userMap.toDomain(orm)
            );

            const users = domainResults
                .filter((result) => result.isOk())
                .map((result) => result.value);

            const failedCount = domainResults.length - users.length;

            if (failedCount > 0) {
                console.warn(
                    `${failedCount} user mappings failed during findAllAndCount`
                );
            }

            return [users, count] as [User[], number];
        });
    }

    public async findByName(fullName: FullName): Promise<Result<User, Error>> {
        const entityResult = this.repository.findOneByOrFail({
            firstName: fullName.firstName,
            lastName: fullName.lastName,
        } as any);

        return Result.fromAsyncCatching(entityResult).map((orm) => {
            return this.userMap.toDomain(orm);
        });
    }

    // Method to fetch users by phone number
    public async findByPhoneNumber(
        phone: string
    ): Promise<Result<UserORM[], Error>> {
        const findResult = this.repository.findBy({ phoneNumber: phone });
        return await Result.fromAsyncCatching(findResult);
    }

    // Method to save a user into the DB
    public async saveUser(user: User): Promise<Result<UserORM, any>> {
        const orm = this.userMap.toORM(user);
        const saveResult = this.repository.save(orm);
        return await Result.fromAsyncCatching(saveResult);
    }
}
