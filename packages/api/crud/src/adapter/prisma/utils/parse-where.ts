import type { Condition, SearchCondition, WhereCondition, WhereField, WhereOperator } from "../../../types";
import isPrimitive from "../../../utils/is-primitive";
import type { PrismaFieldFilter, PrismaRelationFilter, PrismaWhereField, PrismaWhereOperator } from "../types";

const isObject = (a: unknown) => a instanceof Object;

const operatorsAssociation: {
    [key in WhereOperator]?: PrismaWhereOperator;
} = {
    $cont: "contains",
    $ends: "endsWith",
    $eq: "equals",
    $gt: "gt",
    $gte: "gte",
    $in: "in",
    $lt: "lt",
    $lte: "lte",
    $neq: "not",
    $notin: "notIn",
    $starts: "startsWith",
};

// eslint-disable-next-line regexp/no-useless-flag, sonarjs/regex-complexity -- ISO 8601 date validator inherently complex
const isDateString = (value: string) => /^\d{4}-[01]\d-[0-3]\d(?:T[0-2](?:\d:[0-5]){2}\d(?:\.\d+)?(?:Z|[+-][0-2]\d(?::?[0-5]\d)?)?)?$/g.test(value);

// eslint-disable-next-line sonarjs/function-return-type -- intentionally returns Date | null | original primitive depending on input
const getSearchValue = (originalValue: unknown, coerceDates: boolean): SearchCondition => {
    if (coerceDates && typeof originalValue === "string" && isDateString(originalValue)) {
        return new Date(originalValue);
    }

    if (typeof originalValue === "string" && originalValue === "$isnull") {
        // eslint-disable-next-line unicorn/no-null -- Prisma sentinel for IS NULL filters
        return null;
    }

    return originalValue as SearchCondition;
};

const isRelation = (key: string, manyRelations: string[]): boolean => {
    // Get the key containing . and remove the property name
    const splitKey = key.split(".");

    splitKey.splice(-1, 1);

    return manyRelations.includes(splitKey.join("."));
};

const parseSimpleField = (value: Condition): Record<string, Condition> | undefined => {
    const operator = Object.keys(value)[0];
    const prismaOperator: PrismaWhereOperator | undefined = operatorsAssociation[operator as keyof typeof operatorsAssociation];

    if (prismaOperator) {
        return {
            [prismaOperator]: value[operator as string],
        } as Record<string, Condition>;
    }

    return undefined;
};

const parseRelation = (
    value: Condition | Date | WhereCondition | boolean | number | string,
    key: string,
    parsed: PrismaWhereField,
    manyRelations: string[],
    coerceDates: boolean,
) => {
    // Reverse the keys so that we can format our object by nesting
    const fields = key.split(".").toReversed();

    let formatFields: Record<string, unknown> = {};

    fields.forEach((field, index) => {
        // If we iterate over the property name, which is index 0, we parse it like a normal field
        if (index === 0) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            basicParse(value, field, formatFields as PrismaWhereField, manyRelations, coerceDates);
            // Else we format the relation filter in the prisma way
        } else {
            formatFields = {
                [field]: {
                    some: formatFields,
                },
            };
        }
    });

    // Retrieve the main relation field
    const initialFieldKey = fields.toReversed()[0] as string;
    // Retrieve the old parsed version
    const oldParsed = parsed[initialFieldKey] as PrismaRelationFilter | undefined;

    // Format correctly in the prisma way
    // eslint-disable-next-line no-param-reassign
    parsed[initialFieldKey] = {
        some: {
            ...(oldParsed?.some as object),
            ...(formatFields[initialFieldKey] as { some?: object } | undefined)?.some,
        },
    };
};

const parseObjectCombination = (object: Condition, manyRelations: string[], coerceDates: boolean): PrismaFieldFilter => {
    const parsed: PrismaFieldFilter = {};

    Object.keys(object).forEach((key) => {
        const value = object[key];

        if (isRelation(key, manyRelations)) {
            parseRelation(value as WhereCondition, key, parsed, manyRelations, coerceDates);
        } else if (isPrimitive(value)) {
            parsed[key] = value;
        } else if (isObject(value)) {
            const fieldResult = parseSimpleField(value as Condition);

            if (fieldResult) {
                parsed[key] = fieldResult;
            }
        }
    });

    return parsed;
};

const basicParse = (
    value: Condition | Date | WhereCondition | boolean | number | string,
    key: string,
    parsed: PrismaWhereField,
    manyRelations: string[],
    coerceDates: boolean,
) => {
    if (isPrimitive(value)) {
        // eslint-disable-next-line no-param-reassign
        parsed[key] = getSearchValue(value, coerceDates);
    } else {
        switch (key) {
            case "$and": {
                if (isObject(value)) {
                    // eslint-disable-next-line no-param-reassign
                    parsed.AND = parseObjectCombination(value as Condition, manyRelations, coerceDates);
                }

                break;
            }
            case "$not": {
                if (isObject(value)) {
                    // eslint-disable-next-line no-param-reassign
                    parsed.NOT = parseObjectCombination(value as Condition, manyRelations, coerceDates);
                }

                break;
            }
            case "$or": {
                if (isObject(value)) {
                    // eslint-disable-next-line no-param-reassign
                    parsed.OR = parseObjectCombination(value as Condition, manyRelations, coerceDates);
                }

                break;
            }
            default: {
                // eslint-disable-next-line no-param-reassign
                parsed[key] = parseSimpleField(value as Condition);
                break;
            }
        }
    }
};

/**
 * Convert the package's `where` filter object into a Prisma `where` clause.
 *
 * When `coerceDates` is `true` (the default, for backwards compatibility) ISO
 * date-looking strings are converted to `Date` instances so they match Prisma
 * `DateTime` columns. Set it to `false` (via the adapter's
 * `coerceWhereDates: false` option) to keep them as strings — required when
 * filtering a *string* column whose values happen to look like dates.
 * @param where the parsed `where` query object.
 * @param manyRelations relation paths that should be treated as `some` filters.
 * @param coerceDates whether to coerce ISO date-looking strings to `Date`.
 */
const parsePrismaWhere = (where: WhereField, manyRelations: string[], coerceDates = true): PrismaWhereField => {
    const parsed: PrismaWhereField = {};

    Object.keys(where).forEach((key) => {
        const value = where[key];

        /**
         * If the key without property name is a relation
         *
         * We want the following example input:
         *
         * posts.author.id: 1
         *
         * to output
         *
         * ```
         * {
         *  posts: {
         *    some: {
         *      author: {
         *        some: {
         *          id: 1
         *        }
         *      }
         *    }
         *  }
         * }
         * ```
         */
        if (isRelation(key, manyRelations)) {
            parseRelation(value as WhereCondition, key, parsed, manyRelations, coerceDates);
        } else {
            basicParse(value as Condition, key, parsed, manyRelations, coerceDates);
        }
    });

    return parsed;
};

export default parsePrismaWhere;
