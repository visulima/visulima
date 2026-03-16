import { createCompiler } from "@fumadocs/mdx-remote";
import { executeMdxSync } from "@fumadocs/mdx-remote/client";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsBody } from "fumadocs-ui/page";
import SectionSeparator from "@/components/sections/section-separator";

import { createSeoHead } from "@/lib/seo";
import Section from "@/components/sections/section";
import SupportSection from "../pages/home/sections/support";

const compiler = createCompiler({
    development: false,
});

const loader = createServerFn({
    method: "GET",
}).handler(async () => {
    const filePath = resolve("src/content/code-of-conduct.md");
    const source = readFileSync(filePath, "utf-8");

    const result = await compiler.compile({ source });

    return {
        compiled: result.compiled,
    };
});

const RouteComponent = () => {
    const { compiled } = Route.useLoaderData();
    const { default: MdxContent } = executeMdxSync(compiled);

    return (
        <>
            <DocsBody className="bg-coal">
                <Section mode="dark" gridLength={1} classes={{ root: "", childrenWrapper: "sm:grid-cols-1 lg:grid-cols-1" }}>
                    <MdxContent components={defaultMdxComponents} />
                </Section>
            </DocsBody>
            <div className="relative">
                <SectionSeparator bgColor="bg-ivory" fillColor="fill-ivory" position="top" />
                <SupportSection />
            </div>
        </>
    );
};

export const Route = createFileRoute("/code-of-conduct")({
    component: RouteComponent,
    head: () => ({
        ...createSeoHead({
            description:
                "Visulima community code of conduct based on the Contributor Covenant, outlining our standards for an inclusive and welcoming environment.",
            path: "/code-of-conduct",
            title: "Code of Conduct",
        }),
    }),
    loader: () => loader(),
});
