import SiAstro from "@icons-pack/react-simple-icons/icons/SiAstro.mjs";
import SiBun from "@icons-pack/react-simple-icons/icons/SiBun.mjs";
import SiCloudflare from "@icons-pack/react-simple-icons/icons/SiCloudflare.mjs";
import SiDeno from "@icons-pack/react-simple-icons/icons/SiDeno.mjs";
import SiExpress from "@icons-pack/react-simple-icons/icons/SiExpress.mjs";
import SiGooglecloud from "@icons-pack/react-simple-icons/icons/SiGooglecloud.mjs";
import SiNestjs from "@icons-pack/react-simple-icons/icons/SiNestjs.mjs";
import SiNetlify from "@icons-pack/react-simple-icons/icons/SiNetlify.mjs";
import SiNextdotjs from "@icons-pack/react-simple-icons/icons/SiNextdotjs.mjs";
import SiNodedotjs from "@icons-pack/react-simple-icons/icons/SiNodedotjs.mjs";
import SiReact from "@icons-pack/react-simple-icons/icons/SiReact.mjs";
import SiRemix from "@icons-pack/react-simple-icons/icons/SiRemix.mjs";
import SiTypescript from "@icons-pack/react-simple-icons/icons/SiTypescript.mjs";
import SiVercel from "@icons-pack/react-simple-icons/icons/SiVercel.mjs";
import SiVite from "@icons-pack/react-simple-icons/icons/SiVite.mjs";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { FC } from "react";
import { useState } from "react";

import TanstackStartLogo from "@/assets/tanstack-start.svg?react";
import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";

const frameworks = [
    { icon: SiReact, label: "React" },
    { icon: SiVite, label: "Vite" },
    { icon: TanstackStartLogo, label: "TanStack" },
    { icon: SiAstro, label: "Astro" },
    { icon: SiRemix, label: "Remix" },
    { icon: SiNextdotjs, label: "Next.js" },
    { icon: SiBun, label: "Bun" },
    { icon: SiExpress, label: "Express" },
    { icon: SiTypescript, label: "TypeScript" },
    { icon: SiNestjs, label: "NestJS" },
    { icon: SiNodedotjs, label: "Node.js" },
];

const platforms = [
    { icon: SiVercel, label: "Vercel" },
    { icon: SiNetlify, label: "Netlify" },
    { icon: SiCloudflare, label: "Cloudflare" },
    { icon: SiDeno, label: "Deno Deploy" },
    { icon: SiGooglecloud, label: "Google Cloud" },
];

const IconTile: FC<{ icon: any; index: number; label: string }> = ({ icon: Icon, index, label }) => {
    const [hovered, setHovered] = useState(false);

    return (
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="group relative flex flex-col items-center gap-3 border border-gray-200 bg-gray-50 p-5 transition-all duration-300 hover:border-sky-sapphire/40 hover:bg-sky-sapphire/[0.04]"
            initial={{ opacity: 0, y: 10 }}
            onMouseEnter={() => {
                setHovered(true);
            }}
            onMouseLeave={() => {
                setHovered(false);
            }}
            transition={{ delay: 0.8 + index * 0.04, duration: 0.4 }}
        >
            <Icon aria-hidden="true" className="h-6 w-6 text-gray-400 transition-colors duration-300 group-hover:text-gray-800" size={24} />
            <span className="font-mono text-[10px] text-gray-400 transition-colors duration-300 group-hover:text-gray-600">{label}</span>
            {hovered && (
                <motion.div
                    animate={{ scaleX: 1 }}
                    className="absolute -bottom-px left-0 right-0 h-px bg-sky-sapphire/50"
                    initial={{ scaleX: 0 }}
                    transition={{ duration: 0.2 }}
                />
            )}
        </motion.div>
    );
};

const WorksWhereYouWork: FC = () => (
    <div className="bg-white">
        <Section mode="light">
            <SectionTitle mode="light" prefix="Compatibility" title="Works where you work." />

            <div className="col-span-4 mt-16">
                <div className="grid gap-px lg:grid-cols-2">
                    <div className="border-y border-gray-200 bg-white p-8 mr-0.5">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Frameworks</h3>
                            <span className="border border-gray-200 bg-gray-50 px-3 py-1 font-mono text-xs text-gray-500">
                                $
{"{"}
                                <span className="text-sky-sapphire">any</span>
                                {"}"}
                            </span>
                        </div>

                        <div className="grid grid-cols-4 gap-px sm:grid-cols-6">
                            {frameworks.map((fw, index) => (
                                <IconTile icon={fw.icon} index={index} key={fw.label} label={fw.label} />
                            ))}
                            <div className="flex items-center justify-center border border-gray-200 bg-gray-50 p-5 font-mono text-xs text-gray-300">+more</div>
                        </div>
                    </div>

                    <div className="border-y border-gray-200 bg-white p-8">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Deploy anywhere</h3>
                            <div className="flex items-center gap-1.5 font-mono text-xs text-emerald-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                web standards
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-px sm:grid-cols-5">
                            {platforms.map((pl, index) => (
                                <IconTile icon={pl.icon} index={index + frameworks.length} key={pl.label} label={pl.label} />
                            ))}
                        </div>

                        <div className="mt-6 flex items-center gap-2 border-t border-gray-100 pt-6">
                            <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                            <span className="font-mono text-xs text-gray-400">
                                Our packages use web standards — they run on any platform that supports Node.js or WinterCG.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Section>
    </div>
);

export default WorksWhereYouWork;
