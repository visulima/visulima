import type { RecursiveField } from "../../../types";
import type { PrismaRecursive, PrismaRecursiveField } from "../types";

const parsePrismaRecursiveField = <T extends PrismaRecursiveField>(select: RecursiveField, fieldName: T): PrismaRecursive<T> => {
    const parsed: PrismaRecursive<T> = {};

    Object.keys(select).forEach((field) => {
        parsed[field]
            = select[field] === true
                ? true
                : ({
                    [fieldName]: parsePrismaRecursiveField(select[field] as RecursiveField, fieldName),
                } as Record<T, PrismaRecursive<T>>);
    });

    return parsed;
};

export default parsePrismaRecursiveField;
