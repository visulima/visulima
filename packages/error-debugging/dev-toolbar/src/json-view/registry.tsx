/** @jsxImportSource preact */
import type { ComponentType } from "preact";

import type { BaseComponents } from "./catalog";
import CodeBlock from "./components/code-block";
import DisclosureHeader from "./components/disclosure-header";
import EmptyState from "./components/empty-state";
import HeaderBar from "./components/header-bar";
import KeyValue from "./components/key-value";
import { MessageList } from "./components/message-list";
import MetaRow from "./components/meta-row";
import Note from "./components/note";
import PairTable from "./components/pair-table";
import Row from "./components/row";
import Section from "./components/section";
import SerpSnippet from "./components/serp-snippet";
import SocialCard from "./components/social-card";
import Stack from "./components/stack";
import StatStrip from "./components/stat-strip";
import TabView from "./components/tab-view";
import TagCard from "./components/tag-card";
import Text from "./components/text";

/** Every base component name, mapped to the Preact component that renders it. */
const baseRegistry: { [Name in keyof BaseComponents]: ComponentType<any> } = {
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
