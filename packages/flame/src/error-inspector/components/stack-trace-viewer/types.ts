export type GroupType = "internal" | "node_modules" | "webpack" | undefined;

export type Item = {
    html: string;
    type: GroupType;
};
