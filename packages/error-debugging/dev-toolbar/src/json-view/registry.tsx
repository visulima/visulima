/** @jsxImportSource preact */
import {
    CodeBlock,
    DisclosureHeader,
    EmptyState,
    HeaderBar,
    KeyValue,
    MessageList,
    MetaRow,
    Note,
    PairTable,
    Row,
    Section,
    SerpSnippet,
    SocialCard,
    Stack,
    StatStrip,
    TabView,
    TagCard,
    Text,
} from "../ui";
import type { BaseComponents } from "./catalog";
import type { CheckedRegistry } from "./types";

/** Every base component name, mapped to the component that renders it. */
const baseRegistry: CheckedRegistry<BaseComponents> = {
    CodeBlock,
    DisclosureHeader,
    EmptyState,
    HeaderBar,
    KeyValue,
    MessageList,
    MetaRow,
    Note,
    PairTable,
    Row,
    Section,
    SerpSnippet,
    SocialCard,
    Stack,
    StatStrip,
    TabView,
    TagCard,
    Text,
};

export default baseRegistry;
