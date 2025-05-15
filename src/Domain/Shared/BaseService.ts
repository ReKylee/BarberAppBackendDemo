import { ObjectLiteral, Repository } from "typeorm";
import { Result } from "typescript-result";
import { UniqueEntityID } from "../ValueObjects/UniqueEntityID";

export abstract class BaseService<T extends ObjectLiteral> {
    constructor(protected readonly repository: Repository<T>) {}

    protected async findById(id: UniqueEntityID) {
        const idString = id.toString();
        const entityResult = this.repository.findOneByOrFail({
            [this.getIdFieldName()]: idString,
        } as any);
        return Result.fromAsyncCatching(entityResult);
    }

    protected getIdFieldName(): string {
        return "id";
    }
}
