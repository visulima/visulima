export const dumpObject = (obj: Record<string, any>): string => {
    return (
        "{ " +
        Object.keys(obj)
            .map((key) => `${key}: ${JSON.stringify(obj[key])}`)
            .join(", ") +
        " }"
    );
};
