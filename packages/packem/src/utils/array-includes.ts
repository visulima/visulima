export const arrayIncludes = (array: (RegExp | string)[], searchElement: string): boolean => array.some((entry) => (entry instanceof RegExp ? entry.test(searchElement) : entry === searchElement));
