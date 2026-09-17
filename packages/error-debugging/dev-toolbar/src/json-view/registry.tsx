/** @jsxImportSource preact */
import type { ComponentType } from "preact";

import type { BaseComponents } from "./catalog";
import HeaderBar from "./components/header-bar";
import KeyValue from "./components/key-value";
import Note from "./components/note";
import PairTable from "./components/pair-table";
import Row from "./components/row";
import Section from "./components/section";
import Stack from "./components/stack";
import StatStrip from "./components/stat-strip";
import TabView from "./components/tab-view";

/** Every base component name, mapped to the Preact component that renders it. */
const baseRegistry: { [Name in keyof BaseComponents]: ComponentType<any> } = {
    HeaderBar,
    KeyValue,
    Note,
    PairTable,
    Row,
    Section,
    Stack,
    StatStrip,
    TabView,
};

export default baseRegistry;
