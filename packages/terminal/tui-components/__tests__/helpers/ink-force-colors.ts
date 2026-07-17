const originalForceColor = process.env["FORCE_COLOR"];

export const enableTestColors = (): void => {
    process.env["FORCE_COLOR"] = "3";
};

export const disableTestColors = (): void => {
    if (originalForceColor === undefined) {
        delete process.env["FORCE_COLOR"];
    } else {
        process.env["FORCE_COLOR"] = originalForceColor;
    }
};
