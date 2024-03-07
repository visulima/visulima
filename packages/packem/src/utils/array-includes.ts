export const arrayIncludes = (arr: (string | RegExp)[], searchElement: string): boolean => {
    return arr.some((entry) => (entry instanceof RegExp ? entry.test(searchElement) : entry === searchElement));
};
