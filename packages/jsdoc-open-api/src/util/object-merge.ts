const objectMerge = <T>(a: T, b: T): void => {
    Object.keys(b as object).forEach((key) => {
        if (a[key as keyof typeof b] === undefined) {
            // eslint-disable-next-line no-param-reassign
            a[key as keyof typeof b] = {
                ...b[key as keyof typeof b],
            };
        } else {
            Object.keys(b[key as keyof typeof b] as object).forEach((subKey) => {
                // eslint-disable-next-line no-param-reassign
                (a[key as keyof typeof b] as Record<string, object>)[subKey] = {
                    ...(a[key as keyof typeof b] as Record<string, object>)[subKey],
                    ...(b[key as keyof typeof b] as Record<string, object>)[subKey],
                };
            });
        }
    });
};

export default objectMerge;
