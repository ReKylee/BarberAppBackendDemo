import { FullNameProps } from "../../Domain/ValueObjects/FullName";
import { UniqueEntityIDProps } from "../../Domain/ValueObjects/UniqueEntityID";

export interface BarberDTO extends FullNameProps, UniqueEntityIDProps {}

export type CreateBarberDTO = Omit<BarberDTO, "id">;
