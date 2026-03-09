/* eslint-disable no-secrets/no-secrets */
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { FC } from "react";

import BlurIn from "@/components/ui/blur-in";
import Breakpoint from "@/components/ui/breakpoint";

const MainHero: FC = () => {
    const textContent = (
        <>
            <BlurIn
                className="text-wrap-balance font-dongle text-4xl font-semibold text-white sm:text-center sm:text-6xl md:text-7xl"
                component="h1"
                duration={3}
            >
                Empowering Developers, Inspiring Creativity.
            </BlurIn>
            <BlurIn className="mt-4 max-w-3xl text-base text-white/70 sm:mx-auto sm:text-center sm:text-lg" component="p" duration={3.5}>
                Transform your ideas into reality with our thoughtfully crafted libraries. Simplify development and unlock your creative potential.
            </BlurIn>
        </>
    );

    const getStarted = (
        <BlurIn component="div" duration={3.5}>
            <Link
                className="group relative mt-10 inline-flex items-center gap-3 rounded-full bg-white/[0.08] px-6 py-3 text-sm font-medium text-white ring-1 ring-white/[0.12] backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.14] hover:ring-white/[0.2]"
                to="/docs/"
            >
                <span>Get started</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                <span className="absolute inset-x-6 -bottom-px h-px bg-gradient-to-r from-sky-sapphire/0 via-sky-sapphire/40 to-sky-sapphire/0" />
            </Link>
        </BlurIn>
    );

    const mobile = (
        <div className="relative h-screen w-full">
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/80 z-[1]" />
            <div className="absolute top-0 z-[2] flex h-full w-full flex-col items-center justify-center">
                <div className="text-center">{textContent}</div>
                {getStarted}
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
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 z-[1]" />
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
                <div className="relative flex h-screen w-full flex-col items-center justify-center">
                    <div>{textContent}</div>
                    {getStarted}
                </div>
            </div>
        </div>
    );

    return <Breakpoint breakpoint="md" desktop={desktop} mobile={mobile} />;
};

export default MainHero;
