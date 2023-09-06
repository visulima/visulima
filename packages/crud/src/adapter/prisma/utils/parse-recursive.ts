import type { RecursiveField } from "../../../types";
import type { PrismaRecursive, PrismaRecursiveField } from "../types";

const parsePrismaRecursiveField = <T extends PrismaRecursiveField>(select: RecursiveField, fieldName: T): PrismaRecursive<T> => {
    const parsed: PrismaRecursive<T> = {};

    Object.keys(select).forEach((field) => {
        parsed[field as string] =
            select[field as string] === true
                ? true
                : ({
                      [fieldName]: parsePrismaRecursiveField(select[field as string] as RecursiveField, fieldName),
                  } as Record<T, PrismaRecursive<T>>);
    });

    return parsed;
};

export default parsePrismaRecursiveField;
