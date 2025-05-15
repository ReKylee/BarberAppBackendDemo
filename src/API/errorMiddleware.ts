import { Request, Response, NextFunction } from "express";
import {
    DomainError,
    ValidationError,
    UnexpectedError,
} from "../Domain/Shared/DomainError";
import { ErrorMapper } from "../Application/Errors/ErrorMapper";
import { ZodError } from "zod";
import { QueryFailedError, EntityNotFoundError } from "typeorm";

// Global error-handling middleware
export function errorMiddleware(
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    console.error(err); // Log the error details for internal use

    // Transform to a DomainError
    let domainError: DomainError;

    if (err instanceof DomainError) {
        domainError = err;
    } else if (err instanceof ZodError) {
        domainError = ErrorMapper.mapZodError(err);
    } else if (
        err instanceof EntityNotFoundError ||
        err instanceof QueryFailedError
    ) {
        domainError = ErrorMapper.mapDatabaseError(err);
    } else if (
        err instanceof SyntaxError &&
        // Standard JSON parse error
        (("body" in err && "status" in err && err.status === 400) ||
            // Handle other potential JSON parse error formats
            err.message.includes("JSON"))
    ) {
        domainError = new ValidationError([
            {
                path: "body",
                error: "Invalid JSON format in request body",
            },
        ]);
    } else {
        domainError = new UnexpectedError(
            err instanceof Error ? err : new Error(String(err))
        );
    }

    // Return appropriate response
    res.status(domainError.getStatusCode()).json(domainError.serialize());
}
