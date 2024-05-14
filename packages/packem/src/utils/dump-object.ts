const dumpObject = (object: Record<string, any>): string =>
    `{ ${Object.keys(object)
        .map((key) => `${key}: ${JSON.stringify(object[key])}`)
        .join(", ")} }`;

export default dumpObject;
