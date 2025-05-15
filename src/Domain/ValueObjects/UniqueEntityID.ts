import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { Result } from "typescript-result";
import { ErrorMapper } from "../../Application/Errors/ErrorMapper";

const uuidSchema = z.object({
    id: z
        .string({
            required_error: "UUID is required",
            invalid_type_error: "UUID must be a string",
        })
        .uuid({ message: "Invalid UUID format" }),
});

export type UniqueEntityIDProps = { id: string };

export class UniqueEntityID {
    private readonly value: string;

    private constructor(id: string) {
        this.value = id;
    }
    public static create(): UniqueEntityID {
        return new UniqueEntityID(uuidv4());
    }

    public static from(id: string): Result<UniqueEntityID, Error> {
        const result = uuidSchema.safeParse({ id });
        if (!result.success) {
            return Result.error(ErrorMapper.mapZodError(result.error));
        }
        return Result.ok(new UniqueEntityID(result.data.id));
    }

    public toString(): string {
        return this.value;
    }

    public equals(other?: UniqueEntityID): boolean {
        if (!other) {
            return false;
        }
        return this.value === other.value;
    }
}
