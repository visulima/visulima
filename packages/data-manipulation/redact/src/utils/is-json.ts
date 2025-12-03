/**
 * Checks if string is a parseable JSON string.
 * @param value
 * @returns
 */
const isJson = (value: string): boolean => {
    try {
        JSON.parse(value);
    } catch {
        return false;
    }

    return true;
};

export default isJson;
