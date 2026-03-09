import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ChevronRight } from "lucide-react";
import type { FC } from "react";
import { useRef } from "react";

import cerebro_cli_output from "@/assets/images/cerebro_cli_output.png";
import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";
import { AnimatedBeam } from "@/components/ui/animated/animated-beam";
import { Code } from "@/components/ui/code";
import HighlightLink from "@/components/ui/highlight-link";
import ImageZoom from "@/components/ui/image-zoom";
import WordRotate from "@/components/ui/word-rotate";

const PackemSection = () => {
    const containerReference = useRef<HTMLDivElement>(null);
    const packemReference = useRef<HTMLDivElement>(null);
    const input1Reference = useRef<HTMLDivElement>(null);
    const input2Reference = useRef<HTMLDivElement>(null);
    const input3Reference = useRef<HTMLDivElement>(null);
    const input4Reference = useRef<HTMLDivElement>(null);
    const input5Reference = useRef<HTMLDivElement>(null);
    const input6Reference = useRef<HTMLDivElement>(null);
    const outputReference = useRef<HTMLDivElement>(null);

    return (
        <Section classes={{ root: "pt-0" }}>
            <div className="hidden lg:col-span-1 lg:block" />
            <div className="col-span-4 -ml-[1px] flex flex-col xl:col-span-3">
                <div className="bg-background relative flex flex-row overflow-hidden">
                    <div className="w-full px-8 pt-8 pb-14">
                        <div className="relative flex h-64 w-full items-center justify-center overflow-hidden" ref={containerReference}>
                            <div className="flex size-full max-w-lg flex-row items-stretch justify-between gap-10">
                                <div className="flex flex-col justify-center gap-2">
                                    <div className="h-32" ref={input1Reference}>
                                        <WordRotate
                                            className="-mt-2 w-16 text-white"
                                            duration={3500}
                                            words={[".css", "", ".sass", "", ".less", "", ".scss", "", ".pcss", "", ".sss"]}
                                        />
                                    </div>
                                    <div className="h-32" ref={input2Reference}>
                                        <WordRotate className="-mt-2 w-16 text-white" duration={3000} words={["", ".js", ".ts", "", ".cts", "", ".mts"]} />
                                    </div>
                                    <div className="h-32" ref={input3Reference}>
                                        <WordRotate className="-mt-2 w-16 text-white" duration={4000} words={[".jsx", "", ".tsx"]} />
                                    </div>
                                    <div className="h-32" ref={input4Reference} />
                                    <div className="h-32" ref={input5Reference}>
                                        <WordRotate className="-mt-2 w-16 text-white" duration={4000} words={["", ".jpg", ".png", "", ".svg", "", ".webp"]} />
                                    </div>
                                    <div className="h-32" ref={input6Reference} />
                                </div>
                                <div className="relative flex flex-col justify-center" ref={packemReference}>
                                    <Image className="z-10 size-24" layout="fullWidth" src="/packem.png" title="Packem" />
                                </div>
                                <div className="relative flex flex-col justify-center">
                                    <div ref={outputReference}>
                                        <div className="relative flex flex-col gap-5">
                                            <span>
                                                <WordRotate className="-mt-2 text-white" duration={2500} words={[".cjs", ".mjs"]} />
                                            </span>
                                            <span className="w-14">
                                                <WordRotate className="-mt-2 text-white" duration={3000} words={[".d.ts", ".d.mts", ".d.cts"]} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <AnimatedBeam containerRef={containerReference} fromRef={input1Reference} pathColor="white" toRef={packemReference} />
                            <AnimatedBeam containerRef={containerReference} fromRef={input2Reference} pathColor="white" toRef={packemReference} />
                            <AnimatedBeam containerRef={containerReference} fromRef={input3Reference} pathColor="white" toRef={packemReference} />
                            <AnimatedBeam containerRef={containerReference} fromRef={input4Reference} pathColor="white" toRef={packemReference} />
                            <AnimatedBeam containerRef={containerReference} fromRef={input5Reference} pathColor="white" toRef={packemReference} />
                            <AnimatedBeam containerRef={containerReference} fromRef={input6Reference} pathColor="white" toRef={packemReference} />
                            <AnimatedBeam containerRef={containerReference} fromRef={packemReference} pathColor="white" toRef={outputReference} />
                        </div>
                    </div>
                    <div className="z-10 flex w-full flex-col gap-5 px-8 pt-8 pb-14">
                        <h3 className="font-mono font-semibold text-white">Packem</h3>
                        <span className="text-white">A fast and modern bundler for Node.js and TypeScript.</span>
                        <span className="text-white">
                            Supports multiple runtimes, shared modules, server components, dynamic import, wasm, css, and more. Built on top of Rollup, combined
                            with your preferred transformer like esbuild, swc, or sucrase.
                        </span>
                        <div className="col-span-1 flex justify-end">
                            <Link
                                className="border-sky-sapphire hover:text-sky-sapphire mt-10 inline-flex w-36 items-center justify-center gap-1 border-b border-dashed text-sm font-medium text-white transition duration-300 before:duration-300 hover:border-transparent"
                                to="/docs/package/packem"
                            >
                                <span>Explore Packem</span>
                                <ChevronRight />
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row bg-white">
                    <div className="border-coal/10 flex w-full flex-col gap-5 border-r px-8 pt-8 pb-14">
                        <h3 className="font-mono font-semibold">Tree shaking</h3>
                        <span className="text-wrap-balance pr-20 text-base/6">
                            Packem supports tree-shaking both ES modules and CommonJS out of the box! It statically analyzes the imports and exports of each
                            module, and removes everything that isn't used.
                        </span>
                        <span className="text-wrap-balance pr-20 text-base/6">
                            Tree shaking even works across dynamic import() boundaries, shared bundles, and even across languages! If you use CSS modules,
                            unused classes will be removed automatically.
                        </span>
                    </div>
                    <div className="flex w-full flex-col gap-5 px-8 pt-8 pb-14">
                        <h3 className="font-mono font-semibold">Minification</h3>
                        <span className="text-wrap-balance pr-20 text-base/6">
                            Packem includes minifiers for JavaScript, CSS, HTML, and SVG out of the box! <br />
                            <br /> Just run
                            <code>packem build --production</code>, and your whole application will be built and optimized automatically.
                        </span>
                    </div>
                </div>
                <div className="border-coal/10 flex flex-row border-b bg-white">
                    <div className="border-coal/10 flex w-full flex-col gap-5 border-r px-8 pt-8 pb-14">
                        <h3 className="font-mono font-semibold">Libraries</h3>
                        <span className="text-wrap-balance pr-20 text-base/6">
                            Packem can build libraries for multiple targets at once! For example, your source code can be compiled to a modern ES module, a
                            legacy CommonJS module, and a TypeScript definition file all automatically.
                            <br />
                            <br />
                            Just add the relevant fields to your package.json and Packem takes care of the rest.
                        </span>
                    </div>
                    <div className="flex w-full flex-col gap-5 px-8 pt-8 pb-14">
                        <h3 className="font-mono font-semibold">Transformer</h3>
                        <span className="text-wrap-balance pr-20 text-base/6">
                            Packem supports different types of transformers for your source code! <br />
                            You can use <code>esbuild</code>, <code>swc</code>, <code>sucracse</code>, <code>oxc</code>, and even custom transformers
                        </span>
                    </div>
                </div>
            </div>
        </Section>
    );
};

const PailSection = () => (
    <Section classes={{ root: "pt-0" }}>
        <div className="col-span-3 flex flex-col">
            <div className="bg-background relative flex flex-row overflow-hidden">
                <div className="z-10 flex w-full flex-col gap-5 p-8">
                    <h3 className="font-mono font-semibold text-white">Pail</h3>
                    <span className="text-white">Highly configurable Logger for Node.js, Edge and Browser.</span>
                    <span className="text-white">
                        Hackable and configurable to the core, pail can be used for logging purposes, status reporting, as well as for handling the output
                        rendering process of other node modules and applications.
                    </span>
                    <div className="col-span-1 flex justify-start">
                        <Link
                            className="border-pomelo hover:text-pomelo border-crimson-energy hover:text-crimson-energy mt-10 inline-flex w-30 items-center justify-center gap-1 border-b border-dashed text-sm font-medium text-white transition duration-300 before:duration-300 hover:border-transparent"
                            to="/docs/package/pail"
                        >
                            <span>Explore Pail</span>
                            <ChevronRight />
                        </Link>
                    </div>
                </div>
                <div className="w-full px-4 py-8 text-white">
                    <Code
                        code={`import { pail } from "@visulima/pail";

pail.success("Operation successful");
pail.debug("Hello", "from", "L59");
pail.pending("Write release notes for %s", "1.2.0");
pail.fatal(new Error("Unable to acquire lock"));
pail.watch("Recursively watching build directory...");
pail.complete({
    prefix: "[task]",
    message: "Fix issue #59",
    suffix: "(@prisis)",
});`}
                        language="ts"
                        mode="dark"
                    />
                </div>
            </div>
            <div className="flex flex-row bg-white">
                <div className="border-coal/10 flex w-full flex-col gap-5 border-r px-8 pt-8 pb-14">
                    <h3 className="font-mono font-semibold">Effortless Logging, Minimal Syntax</h3>
                    <span className="text-wrap-balance pr-20 text-base/6">
                        Get started instantly with Pail's intuitive design. Whether you’re debugging or tracking processes, Pail’s minimal syntax ensures your
                        focus stays on coding, not configuration.
                    </span>
                </div>
                <div className="border-coal/10 flex w-full flex-col gap-5 border-r px-8 pt-8 pb-14">
                    <h3 className="font-mono font-semibold">More Than Just Logs</h3>
                    <span className="text-wrap-balance pr-20 text-base/6">
                        Leverage built-in timers, stack traces, error formatting, spam prevention by throttling logs, secrets & sensitive information filtering,
                        and object interpolation to gain deeper insights and debug with precision.
                    </span>
                </div>
            </div>
            <div className="border-coal/10 flex flex-row border-b bg-white">
                <div className="border-coal/10 flex w-full flex-col gap-5 border-r px-8 pt-8 pb-14">
                    <h3 className="font-mono font-semibold">Blazing Fast on Any Platform</h3>
                    <span className="text-wrap-balance pr-20 text-base/6">
                        Built for browsers and servers, Pail ensures lightning-fast performance and compatibility. Its spam prevention and circular structure
                        handling simplify even the most complex applications.
                    </span>
                </div>
                <div className="border-coal/10 flex w-full flex-col gap-5 border-r px-8 pt-8 pb-14">
                    <h3 className="font-mono font-semibold">Your Logs, Your Way</h3>
                    <span className="text-wrap-balance pr-20 text-base/6">
                        Choose between human-readable Pretty outputs or structured JSON for machine parsing. Pail also integrates filename, timestamp, and
                        metadata effortlessly.
                    </span>
                </div>
            </div>
        </div>
    </Section>
);

const CerebroSection = () => (
    <Section classes={{ root: "pt-0" }}>
        <div className="hidden lg:col-span-1 lg:block" />
        <div className="col-span-4 -ml-[1px] flex flex-col xl:col-span-3">
            <div className="bg-background relative flex flex-row overflow-hidden">
                <div className="w-full px-4 pt-4 text-white">
                    <ImageZoom alt="Cerebro" layout="fixed" src={cerebro_cli_output} />
                </div>
                <div className="z-10 flex w-full flex-col gap-5 p-8">
                    <h3 className="font-mono font-semibold text-white">Cerebro</h3>
                    <span className="text-white">
                        Cerebro is a cli framework, that lets you build awesome cli's in Node.js and Typescript. It has all the great features that you need to
                        build your cli.
                    </span>
                    <span className="text-white">
                        Create CLIs with a few flags or advanced CLIs that have subcommands. Cerebro makes it easy for you to build CLIs for your company,
                        service, or your own development needs.
                    </span>
                    <div className="col-span-1 flex justify-end">
                        <Link
                            className="border-lime hover:text-lime border-royal-amethyst hover:text-royal-amethyst mt-10 inline-flex w-36 items-center justify-center gap-1 border-b border-dashed text-sm font-medium text-white transition duration-300 before:duration-300 hover:border-transparent"
                            to="/docs/package/cerebro"
                        >
                            <span>Explore Cerebro</span>
                            <ChevronRight />
                        </Link>
                    </div>
                </div>
            </div>
            <div className="flex flex-row bg-white">
                <div className="border-coal/10 flex w-full flex-col gap-5 border-r px-8 pt-8 pb-14">
                    <h3 className="font-mono font-semibold">Flag and Argument Parsing</h3>
                    <span className="text-wrap-balance pr-20 text-base/6">
                        No CLI framework is complete without a flag parser. We've built a custom flag parser from years of experimentation that we feel is
                        flexible enough to make an easy, predictable user experience but without compromising type safety for the developer.
                    </span>
                </div>
                <div className="flex w-full flex-col gap-5 px-8 pt-8 pb-14">
                    <h3 className="font-mono font-semibold">Auto-documentation</h3>
                    <span className="text-wrap-balance pr-20 text-base/6">
                        By default, you pass <code>--help</code> to a CLI command to get help, such as the flag options and argument information.
                    </span>
                </div>
            </div>
            <div className="border-coal/10 flex flex-row border-b bg-white">
                <div className="border-coal/10 flex w-full flex-col gap-5 border-r px-8 pt-8 pb-14">
                    <h3 className="font-mono font-semibold">TypeScript (or not)</h3>
                    <span className="text-wrap-balance pr-20 text-base/6">
                        Everything in cerebro is written in TypeScript, and the CLI generator can build both fully configured TypeScript or plain JavaScript
                        CLIs. Because of TypeScript static properties, the syntax is a bit cleaner in TypeScript — but everything works, no matter which
                        language you choose.
                    </span>
                </div>
                <div className="flex w-full flex-col gap-5 px-8 pt-8 pb-14">
                    <h3 className="font-mono font-semibold">Autocomplete</h3>
                    <span className="text-wrap-balance pr-20 text-base/6">
                        Include terminal autocompletion for your CLI with the <code>--autocomplete</code> flag. After the autocomplete feature is configured,
                        users can complete command names and flag names by pressing the tab key.
                    </span>
                </div>
            </div>
        </div>
    </Section>
);

const Packages: FC = () => (
    <>
        <Section classes={{ childrenWrapper: "items-end", root: "pb-20" }}>
            <SectionTitle
                classes={{ root: "col-span-2" }}
                description="From blazing-fast bundlers to intuitive CLI builders, Visulima offers tools to supercharge your workflow. Dive into Packem, Cerebro, Pail, Api-Platform, and more — crafted for elegance, simplicity, and power."
                prefix="Packages"
                title="Tools to Supercharge Your Workflow."
            />
            <div className="hidden lg:col-span-1 lg:block" />
            <div className="col-span-1">
                <HighlightLink className="-ml-[1px] w-[calc(100%+1px)] border-r-0" icon={<ChevronRight />} target="_blank" to="/packages">
                    Explore Packages
                </HighlightLink>
            </div>
        </Section>
        <PackemSection />
        <PailSection />
        <CerebroSection />
        <Section classes={{ root: "pt-0" }}>
            <div className="col-span-1 hidden lg:block" />
            <div className="col-span-2 flex flex-col gap-16">
                <SectionTitle
                    classes={{ root: "text-center" }}
                    description="Empower your ideas with tools that simplify development, spark creativity, and accelerate delivery. Define your vision, design with elegance, and deploy solutions that shape the future of the web with confidence."
                    position="center"
                    title="Define, design, deploy what's next for the web"
                />
                <HighlightLink className="bg-ivory -ml-[2px] w-[calc(100%+1px)] border-r-0" icon={<ChevronRight />} target="_blank" to="/packages">
                    Start Building
                </HighlightLink>
            </div>
        </Section>
    </>
);

export default Packages;
