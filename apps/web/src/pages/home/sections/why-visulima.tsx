import { clsx } from "clsx";
import { ChartNoAxesCombined, Cog, Lock, Puzzle, Shield, Timer } from "lucide-react";

import Section from "@/components/sections/section";
import SectionSeparator from "@/components/sections/section-separator";
import SectionTitle from "@/components/sections/section-title";
import { BentoGrid, BentoSpotlightCard } from "@/components/ui/bento";

const WhyVisulima = () => {
    const features = [
        {
            className: "lg:row-start-2 lg:row-end-2 lg:col-start-1 lg:col-end-3 bg-background border-r border-t border-dotted",
            description:
                "Save time and reduce engineering overhead by leveraging Visulima's ready-to-use solutions. Our tools let you ship faster without sacrificing quality, ensuring your team stays ahead of deadlines and focused on innovation.",
            Icon: Timer,
            name: "Accelerate Delivery",
            revealColors: [
                [255, 0, 0],
                [255, 99, 71],
            ],
        },
        {
            className: "lg:row-start-1 lg:row-end-2 lg:col-start-2 lg:col-end-3",
            description:
                "Built with enterprise-grade security, Visulima protects your applications and data with robust, proven technologies. With advanced safeguards in place, you can develop with peace of mind.",
            Icon: Lock,
            name: "Security at the Core",
            revealColors: [
                [0, 0, 255],
                [70, 130, 180],
            ],
        },
        {
            className: "lg:col-start-1 lg:row-start-1 lg:col-end-1 lg:row-end-1",
            description:
                "Whether starting fresh or enhancing an existing stack, Visulima integrates effortlessly into your workflow. Adopt incrementally or go all-in — our tools are designed to fit your unique needs and evolve with your projects.",
            Icon: Puzzle,
            name: "Flexible, Seamless Adoption",
            revealColors: [
                [255, 255, 0],
                [255, 215, 0],
            ],
        },
        {
            className: "lg:col-start-3 lg:row-start-1 bg-background border-r border-b border-dotted",
            description:
                "Visulima tools have been rigorously tested in real-world scenarios to deliver consistent, dependable performance. You can trust them to handle even your most complex and demanding use cases with ease.",
            Icon: Shield,
            name: "Proven Reliability",
            revealColors: [
                [0, 255, 0],
                [34, 139, 34],
            ],
        },
        {
            className: "lg:row-start-2 lg:row-end-2 lg:col-start-3 lg:col-end-3",
            description:
                "Our platform evolves rapidly, driven by a vibrant developer community and a commitment to innovation. With Visulima, you gain access to cutting-edge solutions that stay ahead of industry trends.",
            Icon: ChartNoAxesCombined,
            name: "Always Improving",
        },
        {
            className: "lg:row-start-2 lg:col-start-4",
            description:
                "Designed for flexibility, Visulima's libraries work seamlessly with a wide range of systems. With clear documentation and intuitive interfaces, setup is quick, and implementation is smooth — no matter your environment.",
            Icon: Cog,
            name: "Effortless Integration",
            revealColors: [
                [135, 206, 235],
                [176, 224, 230],
            ],
        },
    ];

    return (
        <div className="bg-background relative">
            <Section
                classes={{
                    lineGrid: "border-dotted",
                    pattern: "inset-y-10",
                }}
                mode="dark"
                patternColor="sky-sapphire"
            >
                <div className="col-span-2 mb-16">
                    <SectionTitle
                        description="Visulima provides robust, developer-focused tools and libraries to streamline your workflow. Let us handle the complexities so you can focus on building what truly matters."
                        mode="dark"
                        prefix="Why Visulima?"
                        title="Empower Your Development. Deliver Faster."
                    />
                </div>
                <div className="col-span-4">
                    <BentoGrid className="border-y border-dotted">
                        {features.map((feature) => (
                            <BentoSpotlightCard key={feature.name} {...feature} className={feature.className} />
                        ))}
                    </BentoGrid>
                </div>
            </Section>
            <SectionSeparator bgColor="bg-background" fillColor="fill-background" position="bottom" />
        </div>
    );
};

export default WhyVisulima;
