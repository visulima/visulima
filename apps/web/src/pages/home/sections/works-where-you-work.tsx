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
import type { FC } from "react";
import { useState } from "react";

import TanstackStartLogo from "@/assets/tanstack-start.svg?react";
import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";

const frameworkIcons = [
    { icon: SiNextdotjs, label: "Next.js" },
    { icon: SiReact, label: "React" },
    { icon: SiVite, label: "Vite" },
    { icon: TanstackStartLogo, label: "Tanstack Start" },
    { icon: SiAstro, label: "Astro" },
    { icon: SiRemix, label: "Remix" },
    { icon: SiBun, label: "Bun" },
    { icon: SiExpress, label: "Express" },
    { icon: SiTypescript, label: "Typescript" },
    { icon: SiNestjs, label: "Nest" },
    { icon: SiNodedotjs, label: "Node" },
];

const deployIcons = [
    { icon: SiVercel, label: "Vercel" },
    { icon: SiNetlify, label: "Netlify" },
    { icon: SiCloudflare, label: "Cloudflare" },
    { icon: SiDeno, label: "Deno Deploy" },
    { icon: SiGooglecloud, label: "Google Cloud" },
];

const IconGrid = ({ icons, setSelectedFramework }: { icons: { icon: any; label: string }[]; setSelectedFramework: (framework: string | null) => void }) => (
    <ul className="flex flex-wrap gap-2">
        {icons.map(({ icon: Icon, label }) => (
            <li
                className="group/icon relative flex h-12 w-12 cursor-default place-content-center place-items-center border border-gray-200 bg-gray-50 p-2 transition-all duration-300 hover:border-sky-sapphire/40 hover:bg-sky-sapphire/[0.06] hover:shadow-[0_0_20px_-4px] hover:shadow-sky-sapphire/20"
                key={label}
                onMouseEnter={() => {
                    setSelectedFramework(label);
                }}
                onMouseLeave={() => {
                    setSelectedFramework(null);
                }}
            >
                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity duration-200 group-hover/icon:opacity-100">
                    {label}
                </span>
                <Icon aria-hidden="true" className="h-24 w-24 max-w-none text-gray-400 transition-colors duration-300 group-hover/icon:text-gray-900" size={24} />
            </li>
        ))}
    </ul>
);

const WorksWhereYouWork: FC = () => {
    const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
    const [selectedDeploy, setSelectedDeploy] = useState<string | null>(null);

    return (
        <Section mode="light">
            <SectionTitle classes={{ root: "col-span-2" }} mode="light" prefix="Works" title="Works where you work" />
            <div className="col-span-4 mt-24 grid gap-y-24 lg:grid-cols-2 lg:gap-x-32 relative">
                <section>
                    <h2 className="mb-6 text-4xl font-semibold">
                        Develop, connect, and launch using the tools you love
                        <span className="relative -top-1.5 left-2 inline-block border border-gray-200 bg-gray-50 px-3 py-1 font-mono text-sm text-gray-900">
                            {selectedFramework || (
                                <>
                                    {`$\{`}
                                    <span className="text-sky-sapphire">your_favorite_framework</span>
                                    {`}`}
                                </>
                            )}
                        </span>
                    </h2>
                    <div className="border border-gray-200 bg-white p-6">
                        <IconGrid icons={frameworkIcons} setSelectedFramework={setSelectedFramework} />
                    </div>
                    <p className="mt-4 text-sm text-gray-400">...or whichever one is coming next.</p>
                </section>
                <svg
                    className="absolute bottom-18 left-1/2 hidden w-[134px] -translate-x-1/2 lg:block fill-sky-sapphire/40"
                    fill="none"
                    height="151"
                    viewBox="0 0 132 151"
                    width="132"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M0.666667 6C0.666667 8.94552 3.05448 11.3333 6 11.3333C8.94552 11.3333 11.3333 8.94552 11.3333 6C11.3333 3.05448 8.94552 0.666667 6 0.666667C3.05448 0.666667 0.666667 3.05448 0.666667 6ZM66.249 6H67.249V5H66.249V6ZM66.249 145H65.249V146H66.249V145ZM120.667 145C120.667 147.946 123.054 150.333 126 150.333C128.946 150.333 131.333 147.946 131.333 145C131.333 142.054 128.946 139.667 126 139.667C123.054 139.667 120.667 142.054 120.667 145ZM6 6V7H66.249V6V5H6V6ZM66.249 6H65.249V145H66.249H67.249V6H66.249ZM66.249 145V146H126V145V144H66.249V145Z"
                        fill="current-color"
                    />
                </svg>
                <section className="lg:mt-24">
                    <h2 className="mb-4 text-4xl font-semibold">Our packages use web standards to run anywhere</h2>
                    <p className="mt-4 mb-6 text-sm text-gray-400">...and it comes in other flavors too.</p>

                    <div className="border border-gray-200 bg-white p-6">
                        <IconGrid icons={deployIcons} setSelectedFramework={setSelectedDeploy} />

                        <p className="mt-4 flex items-end font-mono text-sm text-gray-500">
                            Deploy modern apps and APIs{" "}
                            {selectedDeploy ? (
                                <span className="text-sky-sapphire ml-2 font-medium">{`with ${selectedDeploy}`}</span>
                            ) : (
                                <span className="text-sky-sapphire ml-2">anywhere</span>
                            )}
                        </p>
                    </div>
                </section>
            </div>
        </Section>
    );
};

export default WorksWhereYouWork;
