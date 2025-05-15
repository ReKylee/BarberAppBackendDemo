import { z } from "zod";
import { Result } from "typescript-result";
import { ParsedQs } from "qs";
import { ErrorMapper } from "../../Application/Errors/ErrorMapper";

export const fullNameSchema = z.object({
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
});

export type FullNameProps = z.infer<typeof fullNameSchema>;

export class FullName {
    private readonly _props: FullNameProps;

    private constructor(props: FullNameProps) {
        this._props = { ...props };
    }

    public static create(
        firstName: string | ParsedQs | (string | ParsedQs)[] | undefined,
        lastName: string | ParsedQs | (string | ParsedQs)[] | undefined
    ) {
        const validation = fullNameSchema.safeParse({ firstName, lastName });

        if (!validation.success) {
            return Result.error(ErrorMapper.mapZodError(validation.error));
        }

        return Result.ok(new FullName(validation.data));
    }

    public get props(): FullNameProps {
        return { ...this._props };
    }
    public get firstName() {
        return this._props.firstName;
    }
    public get lastName() {
        return this._props.lastName;
    }

    public equals(other: FullName): boolean {
        return (
            this._props.firstName === other._props.firstName &&
            this._props.lastName === other._props.lastName
        );
    }
}
