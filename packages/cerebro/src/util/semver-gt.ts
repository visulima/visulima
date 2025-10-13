const semverGt = (version1: string, version2: string): boolean => {
    const v1Components: number[] = version1.split(".").map(Number);
    const v2Components: number[] = version2.split(".").map(Number);

    // eslint-disable-next-line no-loops/no-loops
    for (const [index, v1Component] of v1Components.entries()) {
        if (v1Component > (v2Components[index as number] as number)) {
            return true;
        }

        if (v1Component < (v2Components[index as number] as number)) {
            return false;
        }
    }

    return false;
};

export default semverGt;
