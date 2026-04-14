"use client";

import { ChevronDown } from "lucide-react";
import type { FC } from "react";
import { useState } from "react";

import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";
import JsonLd from "@/components/seo/json-ld";
import { cn } from "@/lib/utils";

const faqs = [
    {
        answer: "Visulima is a collection of 40+ production-ready, MIT-licensed TypeScript packages for Node.js, Bun, Deno, and edge runtimes. It provides tools for bundling, logging, CLI development, file system operations, error handling, API building, and more.",
        question: "What is Visulima?",
    },
    {
        answer: "Yes. Every Visulima package is released under the MIT license, making it free to use in personal, commercial, and open-source projects without restrictions.",
        question: "Is Visulima free to use?",
    },
    {
        answer: "Visulima packages are designed for cross-runtime compatibility. They work with Node.js, Bun, Deno, and edge runtimes like Cloudflare Workers and Vercel Edge Functions.",
        question: "What runtimes does Visulima support?",
    },
    {
        answer: "All Visulima packages are written in TypeScript with full type safety. You get complete type definitions, IntelliSense support, and compile-time type checking out of the box.",
        question: "Does Visulima support TypeScript?",
    },
    {
        answer: "Visulima is designed for incremental adoption. You can install and use any individual package without depending on the rest of the ecosystem. Each package has zero or minimal dependencies.",
        question: "Can I use just one package without installing everything?",
    },
    {
        answer: "Packem is Visulima's fast, modern bundler for Node.js and TypeScript. It supports tree shaking for ESM and CJS, multiple transformers (esbuild, swc, oxc, sucrase), library and application bundling, and TypeScript declarations.",
        question: "What is Packem?",
    },
    {
        answer: "Pail is Visulima's highly configurable logger for Node.js, edge, and browser environments. It supports pretty and JSON output, built-in timers and stack traces, spam prevention, and cross-platform compatibility.",
        question: "What is Pail?",
    },
    {
        answer: "Visulima is maintained in a single monorepo on GitHub. You can contribute by opening issues, submitting pull requests, or joining the community on Discord. All packages are well-tested with comprehensive CI/CD pipelines.",
        question: "How is Visulima maintained?",
    },
];

const FaqItem: FC<{ answer: string; isOpen: boolean; onToggle: () => void; question: string }> = ({ answer, isOpen, onToggle, question }) => (
    <div className="border-b border-white/[0.06] bg-coal">
        <button className="flex w-full items-center justify-between py-6 text-left cursor-pointer" onClick={onToggle} type="button">
            <h3 className="text-base font-medium text-white/80">{question}</h3>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-white/30 transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
        <div className={cn("grid transition-all duration-200", isOpen ? "grid-rows-[1fr] pb-6" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
                <p className="text-sm leading-relaxed text-white/50">{answer}</p>
            </div>
        </div>
    </div>
);

const FAQ: FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const faqPageJsonLd = {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => {
            return {
                "@type": "Question",
                acceptedAnswer: { "@type": "Answer", text: faq.answer },
                name: faq.question,
            };
        }),
    };

    return (
        <div className="bg-coal border-t border-white/[0.06]">
            <JsonLd data={faqPageJsonLd} />
            <Section mode="dark" patternColor="royal-amethyst" patternPosition="bottom">
                <SectionTitle
                    classes={{ root: "col-span-2 lg:col-span-4" }}
                    description="Common questions about the Visulima ecosystem."
                    mode="dark"
                    position="left"
                    title="Frequently Asked Questions"
                />
                <div className="col-span-2 lg:col-span-4 border-t mt-8">
                    {faqs.map((faq, index) => (
                        <FaqItem
                            answer={faq.answer}
                            isOpen={openIndex === index}
                            key={faq.question}
                            onToggle={() => {
                                setOpenIndex(openIndex === index ? null : index);
                            }}
                            question={faq.question}
                        />
                    ))}
                </div>
            </Section>
        </div>
    );
};

export default FAQ;
