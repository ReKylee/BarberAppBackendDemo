import { z } from "zod";
import { Result } from "typescript-result";
import { ErrorMapper } from "../../Application/Errors/ErrorMapper";
import {
    parsePhoneNumberFromString,
    PhoneNumber as LibPhoneNumber,
} from "libphonenumber-js";
import { ValidationError } from "../Shared/DomainError";

// Fix 1: Simplify schema to validate a string directly, not an object
export const phoneNumberSchema = z.object({
    phoneNumber: z.string().refine(
        (value) => {
            const phoneNumber = parsePhoneNumberFromString(value);
            return phoneNumber?.isValid() ?? false;
        },
        {
            message: "Invalid phone number format",
        }
    ),
});

export type PhoneNumberProps = z.infer<typeof phoneNumberSchema>;

export class PhoneNumber {
    private readonly value: LibPhoneNumber;

    private constructor(phoneNumber: LibPhoneNumber) {
        this.value = phoneNumber;
    }

    public static create(
        phoneNumberString: string
    ): Result<PhoneNumber, Error> {
        const validationResult = phoneNumberSchema.safeParse({
            phoneNumber: phoneNumberString,
        });

        if (!validationResult.success) {
            return ErrorMapper.toResult(validationResult.error);
        }

        const libPhoneNumber = parsePhoneNumberFromString(
            validationResult.data.phoneNumber,
            "IL"
        );

        if (!libPhoneNumber) {
            return Result.error(
                new ValidationError([
                    {
                        path: "Phone Number",
                        error: "Failed to parse phone number",
                    },
                ])
            );
        }

        return Result.ok(new PhoneNumber(libPhoneNumber));
    }

    public equals(other: PhoneNumber): boolean {
        return this.value.number === other.value.number;
    }

    public isInternational(): boolean {
        return this.value.country !== "IL";
    }

    public getE164Format(): string {
        return this.value.format("E.164");
    }

    public getInternationalFormat(): string {
        return this.value.formatInternational();
    }

    public getNationalFormat(): string {
        return this.value.formatNational();
    }
}
