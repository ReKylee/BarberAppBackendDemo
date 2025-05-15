import { Result } from "typescript-result";

export abstract class BaseMapper<Entity, ORM, DTO> {
    abstract toDomain(source: DTO | ORM): Result<Entity, any>;
    abstract toORM(entity: Entity): ORM;
    abstract toDTO(entity: Entity): DTO;
}
