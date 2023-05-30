// eslint-disable-next-line import/no-extraneous-dependencies
import type { FastifyInstance } from "fastify";

import type { Route } from "./types";

// "<spaces> activity (GET)" -> "activity"
const getSegment = (line: string) => line.replaceAll(/ \(.*\)/g, "").trim();

// "<spaces> activity (GET)" -> "GET"
const getMethod = (line: string) => (line.trim().split(" ")[1] as string).slice(1, -1);

type Segment = { index: number; segment: string; methods: string[] | null; depth: number; isRoute: boolean };

const fastifyRoutes = (app: FastifyInstance): Route[] => {
    const printedRoutes = app
        .printRoutes()
        .replaceAll(/[─│└├]/g, " ")
        .trimEnd();

    const lines = printedRoutes.split("\n");

    const segments = lines.reduce((allSegments: Segment[], line, index) => {
        const segment = getSegment(line);
        const previousSegment = getSegment(lines[index - 1] ?? "");

        if (previousSegment === segment) {
            const entries: Segment[] = allSegments.filter((item) => item.index < index && item.segment === segment);

            const { methods } = entries.at(-1) as Segment;

            if (methods !== null) {
                methods.push(getMethod(line));
            }

            return allSegments;
        }

        // spaces preceding segment / not counting single space between segment and (METHOD)
        const spaces = line.replaceAll(/ \(.*\)/g, "").match(/ /g);

        if (spaces === null) {
            throw new Error("Invalid spaces");
        }

        const depth = spaces.length / 4;
        const isRoute = line.includes("(");
        const methods = isRoute ? [getMethod(line)] : null;

        allSegments.push({
            segment,
            index,
            depth,
            isRoute,
            methods,
        });

        return allSegments;
    }, []);

    const routes: Route[] = [];

    segments
        .filter((item) => item.isRoute)
        .forEach((item) => {
            const ancestorSegments = segments
                .filter((seg) => seg.index < item.index && seg.depth < item.depth)
                // eslint-disable-next-line unicorn/prefer-array-some
                .filter((seg, _index, previousArray) => !previousArray.find((segment) => segment.depth === seg.depth && segment.index > seg.index));

            const route = [...ancestorSegments.map((r) => r.segment), item.segment].join("");

            if (item.methods === null) {
                throw new Error("Invalid methods");
            }

            item.methods.forEach((method: string) => {
                routes.push({
                    path: route,
                    method: method.toUpperCase(),
                    tags: [],
                    file: "unknown",
                });
            });
        });

    return routes;
};

export default fastifyRoutes;
