import type { QueryClient } from "@tanstack/solid-query";
import { QueryClientProvider } from "@tanstack/solid-query";
import type { JSX } from "solid-js";

interface TestWrapperProps {
    children: JSX.Element;
    client: QueryClient;
}

export const TestWrapper = (props: TestWrapperProps) => <QueryClientProvider client={props.client}>{props.children}</QueryClientProvider>;
