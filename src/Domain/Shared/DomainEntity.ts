import { UniqueEntityID } from "../ValueObjects/UniqueEntityID";

export abstract class DomainEntity<T> {
    protected readonly _id: UniqueEntityID;
    protected readonly props: T;

    constructor(props: T, id?: UniqueEntityID) {
        this._id = id || UniqueEntityID.create();
        this.props = props;
    }

    public get id(): UniqueEntityID {
        return this._id;
    }

    public equals(other?: DomainEntity<T>): boolean {
        if (!other) {
            return false;
        }

        if (this === other) {
            return true;
        }

        // Different classes should never be equal
        if (this.constructor !== other.constructor) {
            return false;
        }

        return this._id.equals(other._id);
    }
}
