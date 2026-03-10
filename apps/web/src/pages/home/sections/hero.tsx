/* eslint-disable no-secrets/no-secrets */
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";
import type { FC } from "react";

import BlurIn from "@/components/ui/blur-in";
import Breakpoint from "@/components/ui/breakpoint";
import WordRotate from "@/components/ui/word-rotate";

const MainHero: FC = () => {
    const textContent = (
        <>
            <BlurIn component="div" duration={2}>
                <span className="mb-6 inline-flex items-center gap-2 border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/60 backdrop-blur-sm">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-sapphire opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-sapphire" />
                    </span>
                    40+ packages &middot; MIT Licensed
                </span>
            </BlurIn>
            <BlurIn
                className="text-wrap-balance text-4xl font-bold tracking-tight text-white sm:text-center sm:text-6xl md:text-7xl lg:text-[5.25rem] lg:leading-[1.05]"
                component="h1"
                duration={2.5}
            >
                Build better software,{" "}
                <span className="bg-gradient-to-r from-sky-sapphire via-royal-amethyst to-crimson-energy bg-clip-text text-transparent">
                    ship faster.
                </span>
            </BlurIn>
            <BlurIn className="mt-6 max-w-2xl text-base leading-relaxed text-white/50 sm:mx-auto sm:text-center sm:text-lg" component="p" duration={3}>
                Production-ready Node.js &amp; TypeScript libraries. From bundlers to loggers, CLI frameworks to storage — everything you need to go from idea to deploy.
            </BlurIn>
        </>
    );

    const ctas = (
        <BlurIn component="div" duration={3.2}>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
                <Link
                    className="group relative inline-flex items-center gap-3 bg-sky-sapphire px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-sapphire/25 transition-all duration-300 hover:bg-sky-sapphire/90 hover:shadow-sky-sapphire/40"
                    to="/docs/"
                >
                    <span>Get started</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
                <Link
                    className="group inline-flex items-center gap-2 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white/80 ring-1 ring-white/[0.08] backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.1] hover:text-white hover:ring-white/[0.16]"
                    to="/docs/"
                >
                    <BookOpen className="h-4 w-4 text-white/50" />
                    <span>Browse packages</span>
                </Link>
            </div>
        </BlurIn>
    );

    const installSnippet = (
        <BlurIn component="div" duration={3.6}>
            <div className="mt-8 inline-flex items-center gap-1 border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 font-mono text-sm text-white/40 backdrop-blur-sm">
                <span className="text-sky-sapphire/60">$</span>
                <span className="ml-2">pnpm add @visulima/</span>
                <WordRotate
                    className="text-white/70"
                    duration={2200}
                    framerProps={{
                        animate: { opacity: 1, y: 0 },
                        exit: { opacity: 0, y: -12 },
                        initial: { opacity: 0, y: 12 },
                        transition: { duration: 0.2, ease: "easeOut" },
                    }}
                    words={["packem", "pail", "cerebro", "fs", "path", "redact", "colorize", "boxen", "fmt", "deep-clone"]}
                />
            </div>
        </BlurIn>
    );

    const mobile = (
        <div className="relative h-screen w-full">
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90 z-[1]" />
            <div className="absolute top-0 z-[2] flex h-full w-full flex-col items-center justify-center px-6">
                <div className="text-center">{textContent}</div>
                {ctas}
                {installSnippet}
            </div>
            <img
                alt="fancy background"
                className="h-full w-full object-cover object-center"
                src="https://res.cloudinary.com/anolilab/video/upload/ac_none/v1749136422/visulima/slywtsotc6ayuxx5gxok.jpg"
            />
        </div>
    );
    const desktop = (
        <div className="relative h-screen">
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80 z-[1]" />
            <video
                autoPlay
                className="mx-auto h-full w-full object-cover object-top"
                loop
                muted
                playsInline
                poster="https://res.cloudinary.com/anolilab/video/upload/ac_none/v1749136422/visulima/slywtsotc6ayuxx5gxok.jpg"
            >
                <source
                    src="https://res.cloudinary.com/anolilab/video/upload/ac_none,b_rgb:000000,e_accelerate:0,so_1/v1749136422/visulima/slywtsotc6ayuxx5gxok.webm"
                    type="video/webm"
                />
                <source
                    src="https://res.cloudinary.com/anolilab/video/upload/ac_none,b_rgb:000000,e_accelerate:0,so_1/v1749136422/visulima/slywtsotc6ayuxx5gxok.mp4"
                    type="video/mp4"
                />
                <img
                    alt="Your browser does not support the <video> tag"
                    className="h-full w-full"
                    src="https://res.cloudinary.com/anolilab/video/upload/ac_none/v1749136422/visulima/slywtsotc6ayuxx5gxok.jpg"
                />
            </video>
            <div className="absolute top-0 right-0 bottom-0 left-0 z-[2] container mx-auto">
                <div className="relative flex h-screen w-full flex-col items-center justify-center text-center">
                    {textContent}
                    {ctas}
                    {installSnippet}
                </div>
            </div>
        </div>
    );

    return <Breakpoint breakpoint="md" desktop={desktop} mobile={mobile} />;
};

export default MainHero;
