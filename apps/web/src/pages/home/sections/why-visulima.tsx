import { ChartNoAxesCombined, Cog, Lock, Puzzle, Shield, Timer } from "lucide-react";

import Section from "@/components/sections/section";
import SectionSeparator from "@/components/sections/section-separator";
import SectionTitle from "@/components/sections/section-title";
import { BentoGrid, BentoSpotlightCard } from "@/components/ui/bento";

const features = [
    {
        className: "lg:row-start-2 lg:row-end-2 lg:col-start-1 lg:col-end-3 border-r border-t border-white/[0.06]",
        description:
            "Save time and reduce engineering overhead by leveraging Visulima's ready-to-use solutions. Our tools let you ship faster without sacrificing quality, ensuring your team stays ahead of deadlines and focused on innovation.",
        Icon: Timer,
        name: "Accelerate Delivery",
        revealColors: [
            [0, 122, 204],
            [56, 189, 248],
        ],
    },
    {
        className: "lg:row-start-1 lg:row-end-2 lg:col-start-2 lg:col-end-3",
        description:
            "Built with enterprise-grade security, Visulima protects your applications and data with robust, proven technologies. With advanced safeguards in place, you can develop with peace of mind.",
        Icon: Lock,
        name: "Security at the Core",
        revealColors: [
            [0, 122, 204],
            [56, 189, 248],
        ],
    },
    {
        className: "lg:col-start-1 lg:row-start-1 lg:col-end-1 lg:row-end-1",
        description:
            "Whether starting fresh or enhancing an existing stack, Visulima integrates effortlessly into your workflow. Adopt incrementally or go all-in — our tools are designed to fit your unique needs and evolve with your projects.",
        Icon: Puzzle,
        name: "Flexible, Seamless Adoption",
        revealColors: [
            [204, 50, 50],
            [248, 113, 113],
        ],
    },
    {
        className: "lg:col-start-3 lg:row-start-1 border-r border-b border-white/[0.06]",
        description:
            "Visulima tools have been rigorously tested in real-world scenarios to deliver consistent, dependable performance. You can trust them to handle even your most complex and demanding use cases with ease.",
        Icon: Shield,
        name: "Proven Reliability",
        revealColors: [
            [128, 71, 153],
            [168, 85, 247],
        ],
    },
    {
        className: "lg:row-start-2 lg:row-end-2 lg:col-start-3 lg:col-end-3",
        description:
            "Our platform evolves rapidly, driven by a vibrant developer community and a commitment to innovation. With Visulima, you gain access to cutting-edge solutions that stay ahead of industry trends.",
        Icon: ChartNoAxesCombined,
        name: "Always Improving",
        revealColors: [
            [128, 71, 153],
            [168, 85, 247],
        ],
    },
    {
        className: "lg:row-start-2 lg:col-start-4",
        description:
            "Designed for flexibility, Visulima's libraries work seamlessly with a wide range of systems. With clear documentation and intuitive interfaces, setup is quick, and implementation is smooth — no matter your environment.",
        Icon: Cog,
        name: "Effortless Integration",
        revealColors: [
            [0, 122, 204],
            [56, 189, 248],
        ],
    },
];

const WhyVisulima = () => (
    <div className="bg-background relative">
        <Section
            classes={{
                lineGrid: "border-dotted border-white/[0.06]",
                pattern: "inset-y-10",
            }}
            mode="dark"
            patternColor="sky-sapphire"
        >
            <div className="col-span-2 mb-16">
                <SectionTitle
                    description={
                        <span className="flex flex-col gap-4">
                            <span className="text-white/55">Visulima provides robust, developer-focused tools and libraries to streamline your workflow.</span>
                            <span className="text-white/35">Let us handle the complexities so you can focus on building what truly matters.</span>
                        </span>
                    }
                    mode="dark"
                    prefix="Why Visulima?"
                    title="Empower Your Development. Deliver Faster."
                />
            </div>
            <div className="col-span-4">
                <BentoGrid className="border-y border-white/[0.06]">
                    {features.map((feature) => (
                        <BentoSpotlightCard key={feature.name} {...feature} className={feature.className} />
                    ))}
                </BentoGrid>
            </div>
        </Section>
        <SectionSeparator bgColor="bg-background" fillColor="fill-background" position="bottom" />
    </div>
);

export default WhyVisulima;
