/**
 * Returns a last element of an array
 */
const getLastOne = <T>(value: T[]): T => value[value.length - 1] as T;

export default getLastOne;
