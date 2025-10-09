/**
 * @packageDocumentation
 * Create a shallow object containing only whitelisted keys from the source.
 */
const pick = <T, K extends keyof T>(object: T, whitelist: K[]): Pick<T, K> => {
    const result = {} as Pick<T, K>;

    whitelist.forEach((key) => {
        result[key] = object[key];
    });

    return result;
};

export default pick;
