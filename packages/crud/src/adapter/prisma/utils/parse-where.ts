import type { Condition, SearchCondition, WhereCondition, WhereField, WhereOperator } from "../../../types";
import isPrimitive from "../../../utils/is-primitive";
import type { PrismaFieldFilter, PrismaWhereOperator, PrismaWhereField, PrismaRelationFilter } from "../types";

const isObject = (a: any) => a instanceof Object;

const operatorsAssociation: {
    [key in WhereOperator]?: PrismaWhereOperator;
} = {
    $eq: "equals",
    $neq: "not",
    $cont: "contains",
    $ends: "endsWith",
    $gt: "gt",
    $gte: "gte",
    $in: "in",
    $lt: "lt",
    $lte: "lte",
    $notin: "notIn",
    $starts: "startsWith",
};

const isDateString = (value: string) => /^\d{4}-[01]\d-[0-3]\d(?:T[0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[-+][0-2]\d(?::?[0-5]\d)?)?)?$/g.test(value);

const getSearchValue = (originalValue: any): SearchCondition => {
    if (isDateString(originalValue)) {
        return new Date(originalValue);
    }

    if (typeof originalValue === "string" && originalValue === "$isnull") {
        return null;
    }

    return originalValue;
};

const isRelation = (key: string, manyRelations: string[]): boolean => {
    // Get the key containing . and remove the property name
    const splitKey = key.split(".");
    splitKey.splice(-1, 1);

    return manyRelations.includes(splitKey.join("."));
};

const parseSimpleField = (value: Condition): undefined | { [key: string]: Condition } => {
    const operator = Object.keys(value)[0];
    const prismaOperator: undefined | PrismaWhereOperator = operatorsAssociation[operator as keyof typeof operatorsAssociation];

    if (prismaOperator) {
        return {
            [prismaOperator]: value[operator as string],
        };
    }

    return undefined;
};

const parseObjectCombination = (obj: Condition, manyRelations: string[]): PrismaFieldFilter => {
    const parsed: PrismaFieldFilter = {};

    Object.keys(obj).forEach((key) => {
        const val = obj[key];

        if (isRelation(key, manyRelations)) {
            parseRelation(val, key, parsed, manyRelations);
        } else if (isPrimitive(val)) {
            parsed[key] = val as SearchCondition;
        } else if (isObject(val)) {
            const fieldResult = parseSimpleField(val as Condition);

            if (fieldResult) {
                parsed[key] = fieldResult;
            }
        }
    });

    return parsed;
};

const basicParse = (value: string | number | boolean | Condition | Date | WhereCondition, key: string, parsed: PrismaWhereField, manyRelations: string[]) => {
    if (isPrimitive(value)) {
        parsed[key] = getSearchValue(value);
    } else {
        switch (key) {
            case "$or": {
                if (isObject(value)) {
                    parsed.OR = parseObjectCombination(value as Condition, manyRelations);
                }
                break;
            }
            case "$and": {
                if (isObject(value)) {
                    parsed.AND = parseObjectCombination(value as Condition, manyRelations);
                }
                break;
            }
            case "$not": {
                if (isObject(value)) {
                    parsed.NOT = parseObjectCombination(value as Condition, manyRelations);
                }
                break;
            }
            default: {
                parsed[key] = parseSimpleField(value as Condition);
                break;
            }
        }
    }
};

const parseRelation = (
    value: string | number | boolean | Date | Condition | WhereCondition,
    key: string,
    parsed: PrismaWhereField,
    manyRelations: string[],
) => {
    // Reverse the keys so that we can format our object by nesting
    const fields = key.split(".").reverse();

    let formatFields: { [key: string]: any } = {};

    fields.forEach((field, index) => {
        // If we iterate over the property name, which is index 0, we parse it like a normal field
        if (index === 0) {
            basicParse(value, field, formatFields, manyRelations);
        }
        // Else we format the relation filter in the prisma way
        else {
            formatFields = {
                [field]: {
                    some: formatFields,
                },
            };
        }
    });
    // Retrieve the main relation field
    const initialFieldKey = fields.reverse()[0] as string;
    // Retrieve the old parsed version
    const oldParsed = parsed[initialFieldKey] as PrismaRelationFilter;
    // Format correctly in the prisma way
    parsed[initialFieldKey] = {
        some: {
            ...((oldParsed?.some as object) || {}),
            ...(formatFields[initialFieldKey as string]?.some as object || {}),
        },
    };
};

const parsePrismaWhere = (where: WhereField, manyRelations: string[]): PrismaWhereField => {
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
         */
        if (isRelation(key, manyRelations)) {
            parseRelation(value, key, parsed, manyRelations);
        } else {
            basicParse(value, key, parsed, manyRelations);
        }
    });

    return parsed;
};

export default parsePrismaWhere;
