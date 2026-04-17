import type { DevcontainerConfig } from "./types";

export interface ValidationIssue {
    field: string;
    message: string;
}

export interface ValidationResult {
    errors: ValidationIssue[];
    suggestions: ValidationIssue[];
    valid: boolean;
    warnings: ValidationIssue[];
}

/**
 * Validate a devcontainer.json configuration.
 * Returns errors (invalid config), warnings (deprecated/suspicious), and suggestions.
 */
export const validateConfig = (config: DevcontainerConfig): ValidationResult => {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const suggestions: ValidationIssue[] = [];

    // Must have either image or build
    if (!config.image && !config.build && !config.dockerComposeFile) {
        errors.push({ field: "image", message: 'One of "image", "build", or "dockerComposeFile" is required' });
    }

    // Build validation
    if (config.build) {
        if (config.image) {
            warnings.push({ field: "image", message: 'Both "image" and "build" are set; "build" takes precedence' });
        }

        if (!config.build.dockerfile) {
            errors.push({ field: "build.dockerfile", message: '"build" requires a "dockerfile" path' });
        }
    }

    // Docker Compose validation
    if (config.dockerComposeFile && !config.service) {
        errors.push({ field: "service", message: '"service" is required when using "dockerComposeFile"' });
    }

    // Features must be an object
    if (config.features !== undefined && (typeof config.features !== "object" || Array.isArray(config.features))) {
        errors.push({ field: "features", message: '"features" must be an object mapping feature IDs to options' });
    }

    // Ports validation
    if (config.forwardPorts) {
        if (Array.isArray(config.forwardPorts)) {
            for (const [index, port] of config.forwardPorts.entries()) {
                if (typeof port === "number" && (port < 1 || port > 65_535)) {
                    errors.push({ field: "forwardPorts", message: `Invalid port ${String(port)} at index ${String(index)}` });
                }
            }
        } else {
            errors.push({ field: "forwardPorts", message: '"forwardPorts" must be an array' });
        }
    }

    // Extensions must be array
    if (config.customizations?.vscode?.extensions && !Array.isArray(config.customizations.vscode.extensions)) {
        errors.push({ field: "customizations.vscode.extensions", message: "Extensions must be an array" });
    }

    // Settings must be object
    if (config.customizations?.vscode?.settings && typeof config.customizations.vscode.settings !== "object") {
        errors.push({ field: "customizations.vscode.settings", message: "Settings must be an object" });
    }

    // Suggestions for common improvements
    if (!config.name) {
        suggestions.push({ field: "name", message: "Consider adding a name for better identification" });
    }

    if (!config.features || Object.keys(config.features).length === 0) {
        suggestions.push({ field: "features", message: "Consider adding features for common tools" });
    }

    if (!config.customizations?.vscode?.extensions || config.customizations.vscode.extensions.length === 0) {
        suggestions.push({ field: "extensions", message: "Consider adding VS Code extensions for your stack" });
    }

    if (config.privileged) {
        warnings.push({ field: "privileged", message: "Running in privileged mode is a security risk" });
    }

    return { errors, suggestions, valid: errors.length === 0, warnings };
};
