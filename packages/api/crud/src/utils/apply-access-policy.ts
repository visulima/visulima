import createHttpError from "http-errors";

import type { ModelAccessPolicy, ParsedQueryParameters, RecursiveField } from "../types";

/**
 * Restrict the top-level keys of an explicit `select`/`include` map to an
 * allowlist. Nested selections are intentionally only checked at the top level
 * (the most common attack vector is `?select=passwordHash`). Returns a new map
 * containing only the allowed keys.
 */
const restrictRecursiveField = (field: RecursiveField, allowlist: string[]): RecursiveField => {
    const allowed = new Set(allowlist);
    const result: RecursiveField = {};

    Object.keys(field).forEach((key) => {
        if (allowed.has(key)) {
            result[key] = field[key] as RecursiveField[string];
        }
    });

    return result;
};

/**
 * Collect the field names referenced at the top level of a parsed `where`
 * clause, including the boolean combinators (`$and`/`$or`/`$not`).
 */
const collectWhereFields = (where: Record<string, unknown>): string[] => {
    const fields: string[] = [];

    Object.keys(where).forEach((key) => {
        if (key === "$and" || key === "$or" || key === "$not") {
            const nested = where[key];

            if (Array.isArray(nested)) {
                nested.forEach((entry) => fields.push(...collectWhereFields(entry as Record<string, unknown>)));
            } else if (nested && typeof nested === "object") {
                fields.push(...collectWhereFields(nested as Record<string, unknown>));
            }

            return;
        }

        // `posts.author.id` style relation filters reference the root relation.
        fields.push(key.split(".")[0] as string);
    });

    return fields;
};

/**
 * Apply a model's read-side access policy to a parsed query:
 *
 * - `selectableFields`/`readableFields` restrict what may be returned.
 * - `filterableFields` restrict what may be filtered/ordered on.
 * - `includableRelations` restrict which relations may be expanded.
 *
 * Mutates and returns the same query object for convenience. Throws a 400
 * `http-errors` error when a client references a disallowed field.
 */
const applyReadPolicy = (query: ParsedQueryParameters, policy: ModelAccessPolicy | undefined): ParsedQueryParameters => {
    if (!policy) {
        return query;
    }

    if (query.select) {
        if (policy.selectableFields) {
            // eslint-disable-next-line no-param-reassign -- intentionally narrowing the caller's parsed query in place
            query.select = restrictRecursiveField(query.select, policy.selectableFields);
        }

        if (policy.readableFields && policy.readableFields.length > 0) {
            const hidden = new Set(policy.readableFields);

            // eslint-disable-next-line no-param-reassign -- intentionally narrowing the caller's parsed query in place
            query.select = Object.fromEntries(Object.entries(query.select).filter(([key]) => !hidden.has(key)));
        }
    }

    if (query.include && policy.includableRelations) {
        const allowed = new Set(policy.includableRelations);

        Object.keys(query.include).forEach((relation) => {
            if (!allowed.has(relation)) {
                throw createHttpError(400, `Relation "${relation}" is not includable`);
            }
        });
    }

    if (policy.filterableFields) {
        const allowed = new Set(policy.filterableFields);

        if (query.where) {
            collectWhereFields(query.where).forEach((field) => {
                if (!allowed.has(field)) {
                    throw createHttpError(400, `Field "${field}" is not filterable`);
                }
            });
        }

        if (query.orderBy) {
            Object.keys(query.orderBy).forEach((field) => {
                if (!allowed.has(field)) {
                    throw createHttpError(400, `Field "${field}" is not sortable`);
                }
            });
        }
    }

    return query;
};

/**
 * Apply a model's write-side allowlist to a request body, dropping any key that
 * is not present in `writableFields`. Prevents mass-assignment of protected
 * columns (`role`, `isAdmin`, foreign keys, ...). When no allowlist is set the
 * body is returned unchanged.
 */
const applyWritePolicy = <T extends Record<string, unknown>>(body: T, policy: ModelAccessPolicy | undefined): T => {
    if (!policy?.writableFields) {
        return body;
    }

    const allowed = new Set(policy.writableFields);

    return Object.fromEntries(Object.entries(body).filter(([key]) => allowed.has(key))) as T;
};

export { applyReadPolicy, applyWritePolicy };
