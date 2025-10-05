import extractOriginalName from "./extract-original-name";
import type File from "./file";

/**
 * Simple deep merge function that recursively merges objects.
 */
const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
    const result = { ...target };

    Object.keys(source).forEach((key) => {
        const sourceValue = source[key];

        if (sourceValue !== null && typeof sourceValue === "object" && !Array.isArray(sourceValue)) {
            const targetValue = result[key];
            const targetObject = targetValue && typeof targetValue === "object" && !Array.isArray(targetValue) ? (targetValue as Record<string, unknown>) : {};

            result[key] = deepMerge(targetObject, sourceValue as Record<string, unknown>);
        } else {
            result[key] = sourceValue;
        }
    });

    return result;
};

const updateMetadata = <T extends File>(file: T, metadata: Partial<T>): void => {
    // Deep merge metadata into file object
    const merged = deepMerge(file as Record<string, unknown>, metadata as Record<string, unknown>);

    // Update the original file object with merged values
    Object.assign(file, merged);

    // Update originalName based on potentially updated metadata
    // eslint-disable-next-line no-param-reassign
    file.originalName = extractOriginalName(file.metadata) || file.originalName;
};

export default updateMetadata;
