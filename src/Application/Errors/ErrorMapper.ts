import { ZodError } from "zod";
import {
    DomainError,
    ValidationError,
    UnexpectedError,
    NotFoundError,
} from "../../Domain/Shared/DomainError";
import { Result } from "typescript-result";
import { QueryFailedError, EntityNotFoundError } from "typeorm";

export class ErrorMapper {
    public static mapZodError(error: ZodError): ValidationError {
        const errors = error.errors.map((err) => ({
            path: err.path.join("."),
            error: err.message,
        }));

        return new ValidationError(errors);
    }

    public static mapDatabaseError(error: Error): DomainError {
        if (error instanceof EntityNotFoundError) {
            return new NotFoundError(this.extractEntityName(error.message));
        }

        if (error instanceof QueryFailedError) {
            // Handle specific SQL errors
            const sqlMessage = error.message.toLowerCase();

            // Handle duplicate key errors
            if (
                sqlMessage.includes("duplicate") ||
                sqlMessage.includes("unique constraint")
            ) {
                return new ValidationError([
                    {
                        path: this.extractFieldFromDuplicateError(sqlMessage),
                        error: "Value already exists",
                    },
                ]);
            }

            // Handle data type errors
            if (
                sqlMessage.includes("out of range") ||
                sqlMessage.includes("incorrect")
            ) {
                return new ValidationError([
                    {
                        path: this.extractFieldFromTypeError(sqlMessage),
                        error: "Invalid data type or value out of range",
                    },
                ]);
            }

            return new UnexpectedError(error);
        }

        return new UnexpectedError(error);
    }

    private static extractEntityName(message: string): string {
        const match = message.match(/entity of type "(\w+)"/i);
        return match ? match[1] : "Entity";
    }

    private static extractFieldFromDuplicateError(message: string): string {
        // MySQL format: "Duplicate entry 'value' for key 'table.field'"
        const keyMatch = message.match(/key '.*?\.(\w+)'/i);
        if (keyMatch) return keyMatch[1];

        // Another common format
        const columnMatch = message.match(
            /duplicate entry .+ for key '(\w+)'/i
        );
        return columnMatch ? columnMatch[1] : "field";
    }

    private static extractFieldFromTypeError(message: string): string {
        // MySQL out of range format: "Out of range value for column 'field' at row X"
        const rangeMatch = message.match(/for column '(\w+)'/i);
        if (rangeMatch) return rangeMatch[1];

        return "field";
    }

    public static toResult<T>(error: Error): Result<T, DomainError> {
        if (error instanceof DomainError) {
            return Result.error(error);
        }

        if (error instanceof ZodError) {
            return Result.error(this.mapZodError(error));
        }

        if (
            error instanceof EntityNotFoundError ||
            error instanceof QueryFailedError
        ) {
            return Result.error(this.mapDatabaseError(error));
        }

        return Result.error(new UnexpectedError(error));
    }
}
