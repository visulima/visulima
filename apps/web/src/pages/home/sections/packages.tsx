import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { FC } from "react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";
import HighlightLink from "@/components/ui/highlight-link";

const FeatureCard = ({ accentColor, children, title, className }: { accentColor: string; children: React.ReactNode; title: string; className?: string }) => (
    <div className={cn("group/feature relative flex w-full flex-col gap-4 px-8 pt-8 pb-10 transition-all duration-300 hover:bg-white/[0.02]", className)}>
        <div className={`absolute top-0 left-8 right-8 h-px ${accentColor} opacity-0 transition-opacity duration-500 group-hover/feature:opacity-100`} />
        <h3 className="font-mono text-sm font-semibold tracking-wide text-white/80 transition-colors duration-300 group-hover/feature:text-white">{title}</h3>
        <span className="text-wrap-balance text-sm leading-relaxed text-white/40 transition-colors duration-300 group-hover/feature:text-white/60">
            {children}
        </span>
    </div>
);

interface BuildStep {
    type: "cmd" | "info" | "entry" | "chunk" | "total" | "done";
    text: string;
    color?: string;
    delay: number;
}

const BUILD_SEQUENCES: BuildStep[][] = [
    [
        { type: "cmd", text: "$ packem build", delay: 0 },
        { type: "info", text: "INFO  [packem] [bundler] Using rollup 4.59.0 with node build runtime", delay: 500 },
        { type: "info", text: "INFO  [packem] [transformer] Using esbuild ^0.27.3", delay: 200 },
        { type: "info", text: "INFO  [packem] Detected entries: src/index.ts [esm] [cjs] [dts]", delay: 300 },
        { type: "info", text: "INFO  [packem] Building my-library", delay: 200 },
        { type: "info", text: "INFO  [packem] [dts] Building declaration files...", delay: 400 },
        { type: "entry", text: "SUCCESS  Build succeeded for my-library", delay: 600 },
        { type: "info", text: "Entries:", delay: 200 },
        { type: "chunk", text: "  dist/index.mjs (12.4 kB, gzip: 4.1 kB)", delay: 250 },
        { type: "chunk", text: "  dist/index.cjs (13.1 kB, gzip: 4.3 kB)", delay: 200 },
        { type: "chunk", text: "  dist/index.d.ts", delay: 150 },
        { type: "total", text: "Σ Total dist size: 28.3 kB", delay: 300 },
        { type: "done", text: "⚡️ Build run in 0.284 seconds", delay: 250 },
    ],
    [
        { type: "cmd", text: "$ packem build --env node --env browser", delay: 0 },
        { type: "info", text: "INFO  [packem] [bundler] Using rollup 4.59.0 with node build runtime", delay: 500 },
        { type: "info", text: "INFO  [packem] [transformer] Using swc ^1.12.1", delay: 200 },
        { type: "info", text: "INFO  [packem] Detected entries: src/index.ts [esm] [dts]", delay: 300 },
        { type: "info", text: "INFO  [packem] Emitting of CJS bundles, is disabled.", delay: 150 },
        { type: "info", text: "INFO  [packem] Building vite-overlay", delay: 200 },
        { type: "info", text: "INFO  [packem] [dts] Building declaration files...", delay: 400 },
        { type: "entry", text: "SUCCESS  Build succeeded for vite-overlay", delay: 600 },
        { type: "info", text: "Entries:", delay: 200 },
        { type: "chunk", text: "  dist/index.js (326.01 kB, brotli: 59.29 kB, gzip: 69.44 kB)", delay: 250 },
        { type: "chunk", text: "    exports: default", delay: 100 },
        { type: "chunk", text: "    dynamic imports:", delay: 100 },
        { type: "chunk", text: "    └─ dist/@shikijs/langs/typescript", delay: 100 },
        { type: "chunk", text: "    └─ dist/@shikijs/langs/json", delay: 80 },
        { type: "chunk", text: "    └─ dist/@shikijs/langs/css", delay: 80 },
        { type: "total", text: "Σ Total dist size: 351.97 kB", delay: 300 },
        { type: "done", text: "⚡️ Build run in 1.429 seconds", delay: 250 },
    ],
];

const getStepColor = (step: BuildStep): string => {
    if (step.color) {
        return step.color;
    }
    switch (step.type) {
        case "cmd":
            return "text-white/80";
        case "info":
            return "text-white/30";
        case "entry":
            return "text-emerald-400";
        case "chunk":
            return "text-white/40";
        case "total":
            return "text-white/50";
        case "done":
            return "text-sky-sapphire";
        default:
            return "text-white/40";
    }
};

const PackemTerminal = () => {
    const [seqIndex, setSeqIndex] = useState(0);
    const [visibleSteps, setVisibleSteps] = useState(0);

    const sequence = BUILD_SEQUENCES[seqIndex % BUILD_SEQUENCES.length]!;

    useEffect(() => {
        if (visibleSteps >= sequence.length) {
            // Pause at the end, then advance to the next sequence
            const timer = setTimeout(() => {
                setSeqIndex((s) => s + 1);
                setVisibleSteps(0);
            }, 2500);
            return () => clearTimeout(timer);
        }

        const nextStep = sequence[visibleSteps];
        if (!nextStep) {
            return;
        }

        const timer = setTimeout(() => {
            setVisibleSteps((v) => v + 1);
        }, nextStep.delay);

        return () => clearTimeout(timer);
    }, [visibleSteps, sequence, seqIndex]);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-white/6 px-4 py-2.5">
                <div className="flex gap-1.5">
                    <div className="h-2 w-2 bg-white/10" />
                    <div className="h-2 w-2 bg-white/10" />
                    <div className="h-2 w-2 bg-white/10" />
                </div>
                <span className="font-mono text-[10px] tracking-wider text-white/20 uppercase">packem — build</span>
            </div>

            <div className="flex-1 overflow-hidden px-4 py-3 font-mono text-xs leading-6">
                <AnimatePresence mode="popLayout">
                    {sequence.slice(0, visibleSteps).map((step, i) => (
                        <motion.div
                            key={`${seqIndex}-${i}`}
                            className={cn("whitespace-pre", getStepColor(step))}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                            {step.type === "cmd" && <span className="text-sky-sapphire/60">$ </span>}
                            {step.type === "cmd" ? (
                                step.text.slice(2)
                            ) : step.text.startsWith("INFO") ? (
                                <>
                                    <span className="text-sky-sapphire/60">INFO</span>
                                    <span>{step.text.slice(4)}</span>
                                </>
                            ) : step.text.startsWith("SUCCESS") ? (
                                <>
                                    <span className="text-emerald-400">SUCCESS</span>
                                    <span className="text-white/50">{step.text.slice(7)}</span>
                                </>
                            ) : (
                                step.text
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>

                {visibleSteps < sequence.length && (
                    <motion.span
                        className="inline-block h-3.5 w-1.5 translate-y-0.5 bg-sky-sapphire/60"
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                    />
                )}
            </div>
        </div>
    );
};

const PackemSection = () => (
    <Section classes={{ root: "pt-0" }} mode="dark">
        <div className="hidden lg:col-span-1 lg:block" />
        <div className="col-span-4 -ml-px flex flex-col xl:col-span-3 bg-background">
            <div className="relative overflow-hidden border-b border-white/6 bg-gradient-to-br from-sky-sapphire/[0.08] via-transparent to-transparent">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-sapphire/60 to-transparent" />
                <div className="grid grid-cols-2">
                    <div className="min-h-120 bg-sky-sapphire/[0.04]">
                        <PackemTerminal />
                    </div>

                    <div className="z-10 flex w-full flex-col gap-4 px-8 pt-8 pb-14 border-l border-white/6">
                        <div className="flex items-center gap-3">
                            <span className="inline-block bg-sky-sapphire/20 px-3 py-1 font-mono text-xs font-medium text-sky-sapphire">Bundler</span>
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
                                className="inline-flex items-center gap-2 bg-sky-sapphire/20 px-3 py-1.5 text-sm font-medium text-sky-sapphire transition-colors hover:bg-sky-sapphire/30 hover:text-white"
                                to="/packages/packem"
                            >
                                Explore Packem
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 border-x border-white/6">
                <FeatureCard accentColor="bg-sky-sapphire/40" title="Tree Shaking">
                    Packem supports tree-shaking both ES modules and CommonJS out of the box. It statically analyzes imports and exports, removing everything
                    unused — even across dynamic import() boundaries and CSS modules.
                </FeatureCard>
                <FeatureCard accentColor="bg-sky-sapphire/40" title="Minification" className="border-l border-white/6">
                    Includes minifiers for JavaScript, CSS, HTML, and SVG out of the box. Run{" "}
                    <code className="text-sky-sapphire/80">packem build --production</code> and your application is built and optimized automatically.
                </FeatureCard>
            </div>
            <div className="grid grid-cols-2 border-x border-b border-white/6">
                <FeatureCard accentColor="bg-sky-sapphire/40" title="Libraries" className="border-t border-white/6">
                    Build libraries for multiple targets at once — modern ES module, legacy CommonJS, and TypeScript definitions all from one source. Just
                    configure your package.json and Packem handles the rest.
                </FeatureCard>
                <FeatureCard accentColor="bg-sky-sapphire/40" title="Transformer" className="border-t border-l border-white/6">
                    Supports different transformers for your source code: <code className="text-sky-sapphire/80">esbuild</code>,{" "}
                    <code className="text-sky-sapphire/80">swc</code>, <code className="text-sky-sapphire/80">sucrase</code>,{" "}
                    <code className="text-sky-sapphire/80">oxc</code>, and custom transformers.
                </FeatureCard>
            </div>
        </div>
    </Section>
);

const LOG_LINES = [
    { level: "success", prefix: "  ✔", text: "Operation successful", color: "text-emerald-400" },
    { level: "debug", prefix: "  ●", text: "Hello from L59", color: "text-sky-sapphire" },
    { level: "pending", prefix: "  …", text: "Write release notes for 1.2.0", color: "text-amber-400" },
    { level: "fatal", prefix: "  ✖", text: "Unable to acquire lock", color: "text-crimson-energy" },
    { level: "watch", prefix: "  ◉", text: "Watching build directory...", color: "text-violet-400" },
    { level: "complete", prefix: "  ✔", text: "Fix issue #59  (@prisis)", color: "text-emerald-400" },
    { level: "info", prefix: "  ℹ", text: "Build finished in 1.2s", color: "text-sky-sapphire" },
    { level: "warn", prefix: "  ▲", text: "Deprecated API usage detected", color: "text-amber-400" },
];

const PailTerminal = () => {
    const [visibleLines, setVisibleLines] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setVisibleLines((prev) => {
                if (prev >= LOG_LINES.length) {
                    // Reset after a pause
                    setTimeout(() => setVisibleLines(0), 800);
                    return prev;
                }
                return prev + 1;
            });
        }, 1200);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-white/6 px-4 py-2.5">
                <div className="flex gap-1.5">
                    <div className="h-2 w-2 bg-white/10" />
                    <div className="h-2 w-2 bg-white/10" />
                    <div className="h-2 w-2 bg-white/10" />
                </div>
                <span className="font-mono text-[10px] tracking-wider text-white/20 uppercase">pail — terminal</span>
            </div>

            <div className="flex-1 overflow-hidden px-4 py-3 font-mono text-xs leading-6">
                <AnimatePresence mode="popLayout">
                    {LOG_LINES.slice(0, visibleLines).map((line, i) => (
                        <motion.div
                            key={`${line.level}-${i}`}
                            className="flex items-baseline gap-0"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            <span className={cn("w-5 shrink-0", line.color)}>{line.prefix}</span>
                            <span className="ml-1 w-20 shrink-0 text-white/25">{line.level.padEnd(8)}</span>
                            <span className="text-white/60">{line.text}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>

                <motion.span
                    className="inline-block h-3.5 w-1.5 translate-y-0.5 bg-crimson-energy/60"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                />
            </div>
        </div>
    );
};

const PailSection = () => (
    <Section classes={{ root: "pt-0" }} mode="dark">
        <div className="col-span-3 flex flex-col bg-background">
            <div className="relative overflow-hidden border border-white/6 bg-gradient-to-br from-crimson-energy/[0.08] via-transparent to-transparent">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-crimson-energy/60 to-transparent" />
                <div className="grid grid-cols-2">
                    <div className="z-10 flex w-full flex-col gap-4 p-8">
                        <div className="flex items-center gap-3">
                            <span className="inline-block bg-crimson-energy/20 px-3 py-1 font-mono text-xs font-medium text-crimson-energy">Logger</span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-white">Pail</h3>
                        <span className="text-sm leading-relaxed text-white/60">
                            Highly configurable Logger for Node.js, Edge and Browser. Hackable and configurable to the core, pail can be used for logging,
                            status reporting, and output rendering.
                        </span>
                        <div className="mt-auto pt-6">
                            <Link
                                className="inline-flex items-center gap-2 bg-crimson-energy/20 px-3 py-1.5 text-sm font-medium text-crimson-energy transition-colors hover:bg-crimson-energy/30 hover:text-white"
                                to="/packages/pail"
                            >
                                Explore Pail
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>

                    <div className="min-h-80 w-full border-l border-white/6 bg-crimson-energy/[0.04]">
                        <PailTerminal />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 border-x border-white/6">
                <FeatureCard accentColor="bg-crimson-energy/40" title="Effortless Logging, Minimal Syntax">
                    Get started instantly with Pail's intuitive design. Whether you're debugging or tracking processes, the minimal syntax ensures your focus
                    stays on coding, not configuration.
                </FeatureCard>
                <FeatureCard accentColor="bg-crimson-energy/40" title="More Than Just Logs" className="border-l border-white/6">
                    Leverage built-in timers, stack traces, error formatting, spam prevention by throttling logs, secrets filtering, and object interpolation to
                    gain deeper insights.
                </FeatureCard>
            </div>
            <div className="grid grid-cols-2 border-x border-b border-white/6">
                <FeatureCard accentColor="bg-crimson-energy/40" title="Blazing Fast on Any Platform" className="border-t border-white/6">
                    Built for browsers and servers, Pail ensures lightning-fast performance and compatibility. Spam prevention and circular structure handling
                    simplify even the most complex applications.
                </FeatureCard>
                <FeatureCard accentColor="bg-crimson-energy/40" title="Your Logs, Your Way" className="border-t border-l border-white/6">
                    Choose between human-readable Pretty outputs or structured JSON for machine parsing. Integrates filename, timestamp, and metadata
                    effortlessly.
                </FeatureCard>
            </div>
        </div>
    </Section>
);

const CLI_SEQUENCE = [
    {
        command: "my-cli deploy",
        flags: "--env production --region eu-west-1",
        output: [
            { text: "Deploying to eu-west-1...", color: "text-royal-amethyst" },
            { text: "Building assets          ████████████████ done", color: "text-white/40" },
            { text: "Uploading bundle         ████████████████ done", color: "text-white/40" },
            { text: "Running health checks    ████████████████ done", color: "text-white/40" },
            { text: "✔ Deployed successfully in 4.2s", color: "text-emerald-400" },
        ],
    },
    {
        command: "my-cli generate component",
        flags: "--name UserProfile --typescript",
        output: [
            { text: "Generating component...", color: "text-royal-amethyst" },
            { text: "  Created src/components/UserProfile.tsx", color: "text-white/40" },
            { text: "  Created src/components/UserProfile.test.tsx", color: "text-white/40" },
            { text: "  Updated src/components/index.ts", color: "text-white/40" },
            { text: "✔ Component generated", color: "text-emerald-400" },
        ],
    },
];

const CerebroTerminal = () => {
    const [phase, setPhase] = useState<"typing-cmd" | "typing-flags" | "output" | "done">("typing-cmd");
    const [seqIndex, setSeqIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [outputIndex, setOutputIndex] = useState(0);

    const seq = CLI_SEQUENCE[seqIndex % CLI_SEQUENCE.length]!;

    useEffect(() => {
        if (phase === "typing-cmd") {
            if (charIndex < seq.command.length) {
                const timer = setTimeout(() => setCharIndex((c) => c + 1), 60 + Math.random() * 40);
                return () => clearTimeout(timer);
            }
            const timer = setTimeout(() => {
                setCharIndex(0);
                setPhase("typing-flags");
            }, 200);
            return () => clearTimeout(timer);
        }

        if (phase === "typing-flags") {
            if (charIndex < seq.flags.length) {
                const timer = setTimeout(() => setCharIndex((c) => c + 1), 45 + Math.random() * 30);
                return () => clearTimeout(timer);
            }
            const timer = setTimeout(() => {
                setPhase("output");
                setOutputIndex(0);
            }, 400);
            return () => clearTimeout(timer);
        }

        if (phase === "output") {
            if (outputIndex < seq.output.length) {
                const timer = setTimeout(() => setOutputIndex((o) => o + 1), 500);
                return () => clearTimeout(timer);
            }
            const timer = setTimeout(() => setPhase("done"), 1500);
            return () => clearTimeout(timer);
        }

        if (phase === "done") {
            const timer = setTimeout(() => {
                setSeqIndex((s) => s + 1);
                setCharIndex(0);
                setOutputIndex(0);
                setPhase("typing-cmd");
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [phase, charIndex, outputIndex, seq]);

    const typedCommand = phase === "typing-cmd" ? seq.command.slice(0, charIndex) : seq.command;
    const typedFlags = phase === "typing-flags" ? seq.flags.slice(0, charIndex) : phase === "typing-cmd" ? "" : seq.flags;
    const showCursor = phase === "typing-cmd" || phase === "typing-flags";

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-white/6 px-4 py-2.5">
                <div className="flex gap-1.5">
                    <div className="h-2 w-2 bg-white/10" />
                    <div className="h-2 w-2 bg-white/10" />
                    <div className="h-2 w-2 bg-white/10" />
                </div>
                <span className="font-mono text-[10px] tracking-wider text-white/20 uppercase">cerebro — cli</span>
            </div>

            <div className="flex-1 overflow-hidden px-4 py-3 font-mono text-xs leading-6">
                <div className="flex flex-wrap">
                    <span className="text-royal-amethyst/60">$</span>
                    <span className="ml-2 text-white/80">{typedCommand}</span>
                    {typedFlags && <span className="ml-1 text-white/40">{typedFlags}</span>}
                    {showCursor && (
                        <motion.span
                            className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-royal-amethyst/60"
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
                        />
                    )}
                </div>

                <AnimatePresence>
                    {(phase === "output" || phase === "done") &&
                        seq.output.slice(0, outputIndex).map((line, i) => (
                            <motion.div
                                key={`${seqIndex}-${i}`}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.25, ease: "easeOut" }}
                                className={line.color}
                            >
                                {line.text}
                            </motion.div>
                        ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

const CerebroSection = () => (
    <Section classes={{ root: "pt-0" }} mode="dark">
        <div className="hidden lg:col-span-1 lg:block" />
        <div className="col-span-4 -ml-px flex flex-col xl:col-span-3 bg-background">
            <div className="relative overflow-hidden border border-white/6 bg-gradient-to-br from-royal-amethyst/[0.08] via-transparent to-transparent">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-royal-amethyst/60 to-transparent" />
                <div className="grid grid-cols-2">
                    <div className="min-h-80 w-full bg-royal-amethyst/[0.04]">
                        <CerebroTerminal />
                    </div>
                    <div className="z-10 flex w-full flex-col gap-4 p-8 border-l border-white/6">
                        <div className="flex items-center gap-3">
                            <span className="inline-block bg-royal-amethyst/20 px-3 py-1 font-mono text-xs font-medium text-royal-amethyst">CLI Framework</span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-white">Cerebro</h3>
                        <span className="text-sm leading-relaxed text-white/60">
                            A CLI framework that lets you build awesome command-line tools in Node.js and TypeScript. Create CLIs with a few flags or advanced
                            CLIs with subcommands.
                        </span>
                        <div className="mt-auto pt-6">
                            <Link
                                className="inline-flex items-center gap-2 bg-royal-amethyst/20 px-3 py-1.5 text-sm font-medium text-royal-amethyst transition-colors hover:bg-royal-amethyst/30 hover:text-white"
                                to="/packages/cerebro"
                            >
                                Explore Cerebro
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 border-x border-white/6">
                <FeatureCard accentColor="bg-royal-amethyst/40" title="Flag and Argument Parsing">
                    Custom flag parser built from years of experimentation — flexible enough for easy, predictable UX without compromising type safety for the
                    developer.
                </FeatureCard>
                <FeatureCard accentColor="bg-royal-amethyst/40" title="Auto-documentation" className="border-l border-white/6">
                    Pass <code className="text-royal-amethyst/80">--help</code> to any CLI command for automatically generated help, flag options, and argument
                    information.
                </FeatureCard>
            </div>
            <div className="grid grid-cols-2 border-x border-b border-white/6">
                <FeatureCard accentColor="bg-royal-amethyst/40" title="TypeScript (or not)" className="border-t border-white/6">
                    Written in TypeScript with a CLI generator that builds both fully configured TypeScript or plain JavaScript CLIs. Cleaner syntax in
                    TypeScript, but everything works in either language.
                </FeatureCard>
                <FeatureCard accentColor="bg-royal-amethyst/40" title="Autocomplete" className="border-t border-l border-white/6">
                    Terminal autocompletion with the <code className="text-royal-amethyst/80">--autocomplete</code> flag. Users complete command and flag names
                    by pressing tab.
                </FeatureCard>
            </div>
        </div>
    </Section>
);

const Packages: FC = () => (
    <div className="bg-background">
        <Section classes={{ childrenWrapper: "items-end", root: "pb-20" }} mode="dark">
            <SectionTitle
                classes={{ root: "col-span-2" }}
                description="From blazing-fast bundlers to intuitive CLI builders, Visulima offers tools to supercharge your workflow. Dive into Packem, Cerebro, Pail, Api-Platform, and more — crafted for elegance, simplicity, and power."
                prefix="Packages"
                title="Tools to Supercharge Your Workflow."
            />
            <div className="hidden lg:col-span-1 lg:block" />
            <div className="col-span-1">
                <HighlightLink className="-ml-px w-[calc(100%+1px)] border-r-0" icon={<ChevronRight />} mode="dark" to="/packages">
                    Explore Packages
                </HighlightLink>
            </div>
        </Section>
        <PackemSection />
        <PailSection />
        <CerebroSection />
        <Section classes={{ root: "pt-0" }} mode="dark">
            <div className="col-span-1 hidden lg:block" />
            <div className="col-span-2 flex flex-col gap-16">
                <SectionTitle
                    classes={{ root: "text-center" }}
                    description="Empower your ideas with tools that simplify development, spark creativity, and accelerate delivery. Define your vision, design with elegance, and deploy solutions that shape the future of the web with confidence."
                    position="center"
                    title="Define, design, deploy what's next for the web"
                />
                <HighlightLink className="-ml-[2px] w-[calc(100%+1px)] border-r-0 bg-background" icon={<ChevronRight />} mode="dark" to="/packages">
                    Start Building
                </HighlightLink>
            </div>
        </Section>
    </div>
);

export default Packages;
