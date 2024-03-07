export const removeExtension = (filename: string): string => {
    return filename.replace(/\.(js|mjs|cjs|ts|mts|cts|json|jsx|tsx)$/, "");
};
