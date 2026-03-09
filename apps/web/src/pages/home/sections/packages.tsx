import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ArrowRight, ChevronRight } from "lucide-react";
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

const FeatureCard = ({ accentColor, children, title }: { accentColor: string; children: React.ReactNode; title: string }) => (
    <div className={`group/feature relative flex w-full flex-col gap-4 border-t border-white/[0.06] px-8 pt-8 pb-10 transition-colors hover:bg-white/[0.02]`}>
        <div className={`absolute top-0 left-8 right-8 h-px ${accentColor} opacity-0 transition-opacity group-hover/feature:opacity-100`} />
        <h3 className="font-mono text-sm font-semibold tracking-wide text-white/90">{title}</h3>
        <span className="text-wrap-balance text-sm leading-relaxed text-white/50">{children}</span>
    </div>
);

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
                {/* Package header card */}
                <div className="relative overflow-hidden rounded-t-lg border border-white/[0.06] bg-gradient-to-br from-sky-sapphire/[0.08] via-transparent to-transparent">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-sapphire/60 to-transparent" />
                    <div className="flex flex-row">
                        <div className="w-full px-8 pt-8 pb-14">
                            <div className="relative flex h-64 w-full items-center justify-center overflow-hidden" ref={containerReference}>
                                <div className="flex size-full max-w-lg flex-row items-stretch justify-between gap-10">
                                    <div className="flex flex-col justify-center gap-2">
                                        <div className="h-32" ref={input1Reference}>
                                            <WordRotate
                                                className="-mt-2 w-16 text-white/70"
                                                duration={3500}
                                                words={[".css", "", ".sass", "", ".less", "", ".scss", "", ".pcss", "", ".sss"]}
                                            />
                                        </div>
                                        <div className="h-32" ref={input2Reference}>
                                            <WordRotate className="-mt-2 w-16 text-white/70" duration={3000} words={["", ".js", ".ts", "", ".cts", "", ".mts"]} />
                                        </div>
                                        <div className="h-32" ref={input3Reference}>
                                            <WordRotate className="-mt-2 w-16 text-white/70" duration={4000} words={[".jsx", "", ".tsx"]} />
                                        </div>
                                        <div className="h-32" ref={input4Reference} />
                                        <div className="h-32" ref={input5Reference}>
                                            <WordRotate
                                                className="-mt-2 w-16 text-white/70"
                                                duration={4000}
                                                words={["", ".jpg", ".png", "", ".svg", "", ".webp"]}
                                            />
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
                                                    <WordRotate className="-mt-2 text-white/70" duration={2500} words={[".cjs", ".mjs"]} />
                                                </span>
                                                <span className="w-14">
                                                    <WordRotate className="-mt-2 text-white/70" duration={3000} words={[".d.ts", ".d.mts", ".d.cts"]} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <AnimatedBeam containerRef={containerReference} fromRef={input1Reference} pathColor="rgba(0,122,204,0.4)" toRef={packemReference} />
                                <AnimatedBeam containerRef={containerReference} fromRef={input2Reference} pathColor="rgba(0,122,204,0.4)" toRef={packemReference} />
                                <AnimatedBeam containerRef={containerReference} fromRef={input3Reference} pathColor="rgba(0,122,204,0.4)" toRef={packemReference} />
                                <AnimatedBeam containerRef={containerReference} fromRef={input4Reference} pathColor="rgba(0,122,204,0.4)" toRef={packemReference} />
                                <AnimatedBeam containerRef={containerReference} fromRef={input5Reference} pathColor="rgba(0,122,204,0.4)" toRef={packemReference} />
                                <AnimatedBeam containerRef={containerReference} fromRef={input6Reference} pathColor="rgba(0,122,204,0.4)" toRef={packemReference} />
                                <AnimatedBeam containerRef={containerReference} fromRef={packemReference} pathColor="rgba(0,122,204,0.4)" toRef={outputReference} />
                            </div>
                        </div>
                        <div className="z-10 flex w-full flex-col gap-4 px-8 pt-8 pb-14">
                            <div className="flex items-center gap-3">
                                <span className="inline-block rounded-full bg-sky-sapphire/20 px-3 py-1 font-mono text-xs font-medium text-sky-sapphire">
                                    Bundler
                                </span>
                            </div>
                            <h3 className="text-2xl font-bold tracking-tight text-white">Packem</h3>
                            <span className="text-sm leading-relaxed text-white/60">
                                A fast and modern bundler for Node.js and TypeScript. Supports multiple runtimes, shared modules, server components, dynamic import,
                                wasm, css, and more.
                            </span>
                            <span className="text-sm leading-relaxed text-white/40">
                                Built on top of Rollup, combined with your preferred transformer like esbuild, swc, or sucrase.
                            </span>
                            <div className="mt-auto pt-6">
                                <Link
                                    className="group/link inline-flex items-center gap-2 text-sm font-medium text-sky-sapphire transition-colors hover:text-white"
                                    to="/docs/package/packem"
                                >
                                    <span>Explore Packem</span>
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Feature cards */}
                <div className="grid grid-cols-2 border-x border-white/[0.06]">
                    <FeatureCard accentColor="bg-sky-sapphire/40" title="Tree Shaking">
                        Packem supports tree-shaking both ES modules and CommonJS out of the box. It statically analyzes imports and exports, removing everything
                        unused — even across dynamic import() boundaries and CSS modules.
                    </FeatureCard>
                    <FeatureCard accentColor="bg-sky-sapphire/40" title="Minification">
                        Includes minifiers for JavaScript, CSS, HTML, and SVG out of the box. Run <code className="text-sky-sapphire/80">packem build --production</code>{" "}
                        and your application is built and optimized automatically.
                    </FeatureCard>
                </div>
                <div className="grid grid-cols-2 border-x border-b border-white/[0.06] rounded-b-lg">
                    <FeatureCard accentColor="bg-sky-sapphire/40" title="Libraries">
                        Build libraries for multiple targets at once — modern ES module, legacy CommonJS, and TypeScript definitions all from one source. Just
                        configure your package.json and Packem handles the rest.
                    </FeatureCard>
                    <FeatureCard accentColor="bg-sky-sapphire/40" title="Transformer">
                        Supports different transformers for your source code: <code className="text-sky-sapphire/80">esbuild</code>,{" "}
                        <code className="text-sky-sapphire/80">swc</code>, <code className="text-sky-sapphire/80">sucrase</code>,{" "}
                        <code className="text-sky-sapphire/80">oxc</code>, and custom transformers.
                    </FeatureCard>
                </div>
            </div>
        </Section>
    );
};

const PailSection = () => (
    <Section classes={{ root: "pt-0" }}>
        <div className="col-span-3 flex flex-col">
            {/* Package header card */}
            <div className="relative overflow-hidden rounded-t-lg border border-white/[0.06] bg-gradient-to-br from-crimson-energy/[0.08] via-transparent to-transparent">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-crimson-energy/60 to-transparent" />
                <div className="flex flex-row">
                    <div className="z-10 flex w-full flex-col gap-4 p-8">
                        <div className="flex items-center gap-3">
                            <span className="inline-block rounded-full bg-crimson-energy/20 px-3 py-1 font-mono text-xs font-medium text-crimson-energy">Logger</span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-white">Pail</h3>
                        <span className="text-sm leading-relaxed text-white/60">
                            Highly configurable Logger for Node.js, Edge and Browser. Hackable and configurable to the core, pail can be used for logging, status
                            reporting, and output rendering.
                        </span>
                        <div className="mt-auto pt-6">
                            <Link
                                className="group/link inline-flex items-center gap-2 text-sm font-medium text-crimson-energy transition-colors hover:text-white"
                                to="/docs/package/pail"
                            >
                                <span>Explore Pail</span>
                                <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
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
            </div>
            {/* Feature cards */}
            <div className="grid grid-cols-2 border-x border-white/[0.06]">
                <FeatureCard accentColor="bg-crimson-energy/40" title="Effortless Logging, Minimal Syntax">
                    Get started instantly with Pail's intuitive design. Whether you're debugging or tracking processes, the minimal syntax ensures your focus stays
                    on coding, not configuration.
                </FeatureCard>
                <FeatureCard accentColor="bg-crimson-energy/40" title="More Than Just Logs">
                    Leverage built-in timers, stack traces, error formatting, spam prevention by throttling logs, secrets filtering, and object interpolation to gain
                    deeper insights.
                </FeatureCard>
            </div>
            <div className="grid grid-cols-2 border-x border-b border-white/[0.06] rounded-b-lg">
                <FeatureCard accentColor="bg-crimson-energy/40" title="Blazing Fast on Any Platform">
                    Built for browsers and servers, Pail ensures lightning-fast performance and compatibility. Spam prevention and circular structure handling
                    simplify even the most complex applications.
                </FeatureCard>
                <FeatureCard accentColor="bg-crimson-energy/40" title="Your Logs, Your Way">
                    Choose between human-readable Pretty outputs or structured JSON for machine parsing. Integrates filename, timestamp, and metadata effortlessly.
                </FeatureCard>
            </div>
        </div>
    </Section>
);

const CerebroSection = () => (
    <Section classes={{ root: "pt-0" }}>
        <div className="hidden lg:col-span-1 lg:block" />
        <div className="col-span-4 -ml-[1px] flex flex-col xl:col-span-3">
            {/* Package header card */}
            <div className="relative overflow-hidden rounded-t-lg border border-white/[0.06] bg-gradient-to-br from-royal-amethyst/[0.08] via-transparent to-transparent">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-royal-amethyst/60 to-transparent" />
                <div className="flex flex-row">
                    <div className="w-full px-4 pt-4 text-white">
                        <ImageZoom alt="Cerebro" layout="fixed" src={cerebro_cli_output} />
                    </div>
                    <div className="z-10 flex w-full flex-col gap-4 p-8">
                        <div className="flex items-center gap-3">
                            <span className="inline-block rounded-full bg-royal-amethyst/20 px-3 py-1 font-mono text-xs font-medium text-royal-amethyst">
                                CLI Framework
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-white">Cerebro</h3>
                        <span className="text-sm leading-relaxed text-white/60">
                            A CLI framework that lets you build awesome command-line tools in Node.js and TypeScript. Create CLIs with a few flags or advanced CLIs
                            with subcommands.
                        </span>
                        <div className="mt-auto pt-6">
                            <Link
                                className="group/link inline-flex items-center gap-2 text-sm font-medium text-royal-amethyst transition-colors hover:text-white"
                                to="/docs/package/cerebro"
                            >
                                <span>Explore Cerebro</span>
                                <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
            {/* Feature cards */}
            <div className="grid grid-cols-2 border-x border-white/[0.06]">
                <FeatureCard accentColor="bg-royal-amethyst/40" title="Flag and Argument Parsing">
                    Custom flag parser built from years of experimentation — flexible enough for easy, predictable UX without compromising type safety for the
                    developer.
                </FeatureCard>
                <FeatureCard accentColor="bg-royal-amethyst/40" title="Auto-documentation">
                    Pass <code className="text-royal-amethyst/80">--help</code> to any CLI command for automatically generated help, flag options, and argument
                    information.
                </FeatureCard>
            </div>
            <div className="grid grid-cols-2 border-x border-b border-white/[0.06] rounded-b-lg">
                <FeatureCard accentColor="bg-royal-amethyst/40" title="TypeScript (or not)">
                    Written in TypeScript with a CLI generator that builds both fully configured TypeScript or plain JavaScript CLIs. Cleaner syntax in TypeScript,
                    but everything works in either language.
                </FeatureCard>
                <FeatureCard accentColor="bg-royal-amethyst/40" title="Autocomplete">
                    Terminal autocompletion with the <code className="text-royal-amethyst/80">--autocomplete</code> flag. Users complete command and flag names by
                    pressing tab.
                </FeatureCard>
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
