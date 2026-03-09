/* eslint-disable no-secrets/no-secrets */
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
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
            <BlurIn className="text-shark-gray-300 mt-4 max-w-3xl text-base text-white sm:mx-auto sm:text-center sm:text-lg" component="p" duration={3.5}>
                Transform your ideas into reality with our thoughtfully crafted libraries. Simplify development and unlock your creative potential.
            </BlurIn>
        </>
    );

    const getStarted = (
        <BlurIn component="div" duration={3.5}>
            <Link className="group relative mt-10 inline-block cursor-pointer rounded-xl p-px leading-6 font-semibold text-white no-underline" to="/docs/">
                <span className="absolute inset-0 overflow-hidden rounded-xl">
                    <span className="absolute inset-0 rounded-xl bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </span>
                <div className="relative z-10 flex items-center space-x-2 rounded-xl px-6 py-3 ring-1 ring-white/10 transition-colors duration-500 group-hover:bg-gray-950/50">
                    <span>Lets get started</span>
                    <ChevronRight className="h-6 w-6 text-white" />
                </div>
                <span className="absolute bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-linear-to-r from-emerald-400/0 via-gray-400/90 to-emerald-400/0 transition-opacity duration-500 group-hover:opacity-40" />
            </Link>
        </BlurIn>
    );

    const mobile = (
        <div className="relative h-screen w-full">
            <div className="absolute top-0 flex h-full w-full flex-col items-center justify-center">
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
            <div className="absolute top-0 right-0 bottom-0 left-0 container mx-auto">
                <div className="relative z-10 flex h-screen w-full flex-col items-center justify-center">
                    <div>{textContent}</div>
                    {getStarted}
                </div>
            </div>
        </div>
    );

    return <Breakpoint breakpoint="md" desktop={desktop} mobile={mobile} />;
};

export default MainHero;
