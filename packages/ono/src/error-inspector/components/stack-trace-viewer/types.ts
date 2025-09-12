export type GroupType = "internal" | "node_modules" | "webpack" | "native" | "bun" | undefined;

export type Item = {
    html: string;
    type: GroupType;
};
