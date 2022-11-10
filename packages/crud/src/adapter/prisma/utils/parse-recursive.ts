import type { RecursiveField } from "../../../types.d";
import type { PrismaRecursive, PrismaRecursiveField } from "../types.d";

const parsePrismaRecursiveField = <T extends PrismaRecursiveField>(
    select: RecursiveField,
    fieldName: T,
): PrismaRecursive<T> => {
    const parsed: PrismaRecursive<T> = {};

    Object.keys(select).forEach((field) => {
        if (select[field] !== true) {
            parsed[field] = {
                [fieldName]: parsePrismaRecursiveField(
                    select[field] as RecursiveField,
                    fieldName,
                ),
            } as Record<T, PrismaRecursive<T>>;
        } else {
            parsed[field] = true;
        }
    });

    return parsed;
};

export default parsePrismaRecursiveField;
