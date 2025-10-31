/**
 * Input validation utilities for CLI operations
 */

import { CerebroError } from "../../errors";

/**
 * Validates that a string is not empty or whitespace-only
 */
export const validateNonEmptyString = (value: unknown, fieldName: string): string => {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new CerebroError(`${fieldName} must be a non-empty string`, "INVALID_INPUT", { fieldName, value });
    }

    return value.trim();
};

/**
 * Validates that a value is an array of strings
 */
export const validateStringArray = (value: unknown, fieldName: string): string[] => {
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
        throw new CerebroError(`${fieldName} must be an array of strings`, "INVALID_INPUT", { fieldName, value });
    }

    return value;
};

/**
 * Validates that a value is a function
 */
export const validateFunction = (value: unknown, fieldName: string): (...args: unknown[]) => unknown => {
    if (typeof value !== "function") {
        throw new CerebroError(`${fieldName} must be a function`, "INVALID_INPUT", { fieldName, value });
    }

    return value as (...args: unknown[]) => unknown;
};

/**
 * Validates that a value is an object (but not null)
 */
export const validateObject = (value: unknown, fieldName: string): Record<string, unknown> => {
    if (typeof value !== "object" || value === null) {
        throw new CerebroError(`${fieldName} must be an object`, "INVALID_INPUT", { fieldName, value });
    }

    return value as Record<string, unknown>;
};

/**
 * Maximum allowed length for command and plugin names to prevent DoS attacks
 */
const MAX_NAME_LENGTH = 100;

/**
 * Validates command name format and prevents malicious inputs
 */
export const validateCommandName = (name: string): string => {
    const trimmedName = validateNonEmptyString(name, "Command name");

    // Prevent excessively long names (DoS protection)
    if (trimmedName.length > MAX_NAME_LENGTH) {
        throw new CerebroError(`Command name is too long (maximum ${MAX_NAME_LENGTH} characters)`, "INVALID_COMMAND_NAME", {
            commandName: trimmedName,
            length: trimmedName.length,
        });
    }

    // Prevent path traversal and command injection attempts
    if (
        trimmedName.includes("..")
        || trimmedName.includes("/")
        || trimmedName.includes("\\")
        || trimmedName.includes(";")
        || trimmedName.includes("|")
        || trimmedName.includes("&")
    ) {
        throw new CerebroError(`Command name "${trimmedName}" contains invalid characters`, "INVALID_COMMAND_NAME", { commandName: trimmedName });
    }

    if (!/^[a-z][\w-]*$/i.test(trimmedName)) {
        throw new CerebroError(
            `Command name "${trimmedName}" must start with a letter and contain only letters, numbers, hyphens, and underscores`,
            "INVALID_COMMAND_NAME",
            { commandName: trimmedName },
        );
    }

    return trimmedName;
};

/**
 * Validates plugin name format and prevents malicious inputs
 */
export const validatePluginName = (name: string): string => {
    const trimmedName = validateNonEmptyString(name, "Plugin name");

    // Prevent excessively long names (DoS protection)
    if (trimmedName.length > MAX_NAME_LENGTH) {
        throw new CerebroError(`Plugin name is too long (maximum ${MAX_NAME_LENGTH} characters)`, "INVALID_PLUGIN_NAME", {
            length: trimmedName.length,
            pluginName: trimmedName,
        });
    }

    // Prevent path traversal and injection attempts
    if (
        trimmedName.includes("..")
        || trimmedName.includes("/")
        || trimmedName.includes("\\")
        || trimmedName.includes(";")
        || trimmedName.includes("|")
        || trimmedName.includes("&")
    ) {
        throw new CerebroError(`Plugin name "${trimmedName}" contains invalid characters`, "INVALID_PLUGIN_NAME", { pluginName: trimmedName });
    }

    if (!/^[a-z][\w-]*$/i.test(trimmedName)) {
        throw new CerebroError(
            `Plugin name "${trimmedName}" must start with a letter and contain only letters, numbers, hyphens, and underscores`,
            "INVALID_PLUGIN_NAME",
            { pluginName: trimmedName },
        );
    }

    return trimmedName;
};
