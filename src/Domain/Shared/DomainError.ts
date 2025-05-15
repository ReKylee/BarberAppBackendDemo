export abstract class DomainError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, DomainError.prototype);
    }

    public abstract serialize(): Record<string, any>;
    public abstract getStatusCode(): number;
}

export class NotFoundError extends DomainError {
    constructor(entity: string, id?: string) {
        super(id ? `${entity} with ID ${id} not found` : `${entity} not found`);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }

    public serialize(): Record<string, any> {
        return {
            type: "NOT_FOUND",
            message: this.message,
        };
    }

    public getStatusCode(): number {
        return 404;
    }
}

export class ValidationError extends DomainError {
    private readonly errors: Array<{ path: string; error: string }>;

    constructor(errors: Array<{ path: string; error: string }>) {
        super("Validation failed");
        this.errors = errors;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }

    public serialize(): Record<string, any> {
        return {
            type: "VALIDATION_ERROR",
            message: this.message,
            errors: this.errors,
        };
    }

    public getStatusCode(): number {
        return 400;
    }
}

export class BusinessRuleError extends DomainError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, BusinessRuleError.prototype);
    }

    public serialize(): Record<string, any> {
        return {
            type: "BUSINESS_RULE_ERROR",
            message: this.message,
        };
    }

    public getStatusCode(): number {
        return 422; // Unprocessable Entity
    }
}

export class UnexpectedError extends DomainError {
    constructor(error: Error) {
        super(
            process.env.NODE_ENV === "production"
                ? "An unexpected error occurred"
                : `Unexpected error: ${error.message}`
        );
        Object.setPrototypeOf(this, UnexpectedError.prototype);
    }

    public serialize(): Record<string, any> {
        return {
            type: "UNEXPECTED_ERROR",
            message: this.message,
        };
    }

    public getStatusCode(): number {
        return 500;
    }
}
