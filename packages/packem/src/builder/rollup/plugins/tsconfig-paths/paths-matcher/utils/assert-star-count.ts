const starPattern = /\*/g;

const assertStarCount = (pattern: string, errorMessage: string) => {
    const starCount = pattern.match(starPattern);
    if (starCount && starCount.length > 1) {
        throw new Error(errorMessage);
    }
};

export default assertStarCount;
