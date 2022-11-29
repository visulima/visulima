const mapValues = <T>(object: Record<string, any>, function_: (value: any) => T): Record<string, T> => {
    const result: Record<string, T> = {};

    Object.keys(object).forEach((key) => {
        result[key] = function_(object[key]);
    });

    return result;
};

export default mapValues;
