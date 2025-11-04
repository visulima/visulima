import type { EnvDefinition } from "../types/command";

/**
 * Transforms a boolean environment variable value.
 * Returns true for 'true', '1', 'yes', 'on' (case-insensitive), false otherwise.
 */
const transformBooleanEnv = (value: string | undefined): boolean | undefined => {
    if (value === undefined) {
        return undefined;
    }

    const normalized = value.toLowerCase().trim();

    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
};

/**
 * Transforms an environment variable value according to its type definition.
 */
const transformEnvValue = (envDefinition: EnvDefinition<boolean> | EnvDefinition<number> | EnvDefinition<string>, envValue: string | undefined): unknown => {
    if (!envDefinition.type) {
        return envValue;
    }

    // Handle undefined before type transformation
    if (envValue === undefined) {
        return undefined;
    }

    // Handle Boolean type specially for environment variables
    const isBooleanType = envDefinition.type === Boolean || (typeof envDefinition.type === "function" && envDefinition.type.name === "Boolean");

    if (isBooleanType) {
        return transformBooleanEnv(envValue);
    }

    // Handle Number type - parse explicitly to avoid NaN issues
    const isNumberType = envDefinition.type === Number || (typeof envDefinition.type === "function" && envDefinition.type.name === "Number");

    if (isNumberType) {
        const parsed = Number.parseInt(envValue, 10);

        return Number.isNaN(parsed) ? undefined : parsed;
    }

    // Handle String type - return as-is since it's already a string
    const isStringType = envDefinition.type === String || (typeof envDefinition.type === "function" && envDefinition.type.name === "String");

    if (isStringType) {
        return envValue;
    }

    // Transform using custom type function
    return envDefinition.type(envValue);
};

/**
 * Converts an environment variable name to camelCase.
 */
const toCamelCase = (name: string): string =>
    name
        .toLowerCase()
        .replaceAll(/_./g, (match) => match[1]?.toUpperCase() ?? match)
        .replace(/^[A-Z]/, (char) => char.toLowerCase());

/**
 * Processes environment variables from a command definition.
 * Transforms string values to their specified types and applies default values.
 * @param envDefinitions Array of environment variable definitions
 * @returns Object with camelCase keys and transformed values
 */
const processEnvVariables = (
    envDefinitions: (EnvDefinition<boolean> | EnvDefinition<number> | EnvDefinition<string>)[] | undefined,
): Record<string, unknown> => {
    if (!envDefinitions || envDefinitions.length === 0) {
        return {};
    }

    const result: Record<string, unknown> = {};

    for (const envDefinition of envDefinitions) {
        // Access process.env directly to ensure we get the latest value
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const envValue = process.env[envDefinition.name];
        const transformedValue = transformEnvValue(envDefinition, envValue);
        const finalValue = transformedValue === undefined ? envDefinition.defaultValue : transformedValue;
        const camelCaseName = toCamelCase(envDefinition.name);

        result[camelCaseName] = finalValue;
    }

    return result;
};

export default processEnvVariables;
