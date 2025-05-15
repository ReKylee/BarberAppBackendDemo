import { Result } from "typescript-result";
import { BaseMapper } from "./BaseMapper";
import { BarberDTO } from "../../Application/DTO/BarberDTO";
import { Barber } from "../../Domain/Entities/Barber";
import { BarberFactory } from "../../Domain/Factories/BarberFactory";
import { BarberORM } from "../ORM/BarberORM";

export class BarberMap implements BaseMapper<Barber, BarberORM, BarberDTO> {
    toDomain(source: BarberDTO | BarberORM): Result<Barber, any> {
        if (source instanceof BarberORM) {
            return BarberFactory.from({
                id: source.barberId,
                firstName: source.firstName.toLowerCase(),
                lastName: source.lastName.toLowerCase(),
            });
        }
        return BarberFactory.from(source);
    }
    toORM(barber: Barber): BarberORM {
        const orm = new BarberORM();
        orm.barberId = barber.id.toString();
        orm.firstName = barber.fullName.firstName.toLowerCase();
        orm.lastName = barber.fullName.lastName.toLowerCase();
        return orm;
    }

    toDTO(barber: Barber): BarberDTO {
        return {
            id: barber.id.toString(),
            firstName: barber.fullName.firstName.toLowerCase(),
            lastName: barber.fullName.lastName.toLowerCase(),
        };
    }
}
