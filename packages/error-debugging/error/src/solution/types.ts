export type Solution = {
    body: string;
    header?: string;
};

export type SolutionFinderFile = {
    file: string;
    language?: string;
    line: number;
    snippet?: string | undefined;
};

export type SolutionFinder = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handle: (error: any, file: SolutionFinderFile) => Promise<Solution | undefined>;
    name: string;
    priority: number;
};

export type SolutionError = Error & {
    hint?: Solution;
};
