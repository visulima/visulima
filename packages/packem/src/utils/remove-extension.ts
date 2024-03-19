const removeExtension = (filename: string): string => filename.replace(/\.(js|mjs|cjs|ts|mts|cts|json|jsx|tsx)$/, "");

export default removeExtension;
