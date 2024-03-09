const walkInclude = (path: string, extensions?: string[], match?: RegExp[], skip?: RegExp[]): boolean => {
    if (extensions && !extensions.some((extension): boolean => path.endsWith(extension))) {
        return false;
    }

    if (match && !match.some((pattern): boolean => pattern.test(path))) {
        return false;
    }

    return !(skip && skip.some((pattern): boolean => pattern.test(path)));
};

export default walkInclude;
