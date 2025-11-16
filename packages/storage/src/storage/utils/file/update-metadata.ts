import extractOriginalName from "./extract-original-name";
import type File from "./file";

/**
 * Simple deep merge function that recursively merges objects.
 * Non-object values are replaced, objects are merged recursively.
 */
const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
    const result = { ...target };

    Object.keys(source).forEach((key) => {
        const sourceValue = source[key];

        // eslint-disable-next-line unicorn/no-null
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

/**
 * Updates a file object with new metadata using deep merge.
 * Also updates the originalName based on the merged metadata.
 * @param file File object to update
 * @param metadata Partial metadata to merge into the file
 * @template T - File type extending base File class
 */
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
