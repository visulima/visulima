// @ts-nocheck
/// <reference types="vite/client" />
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
} & {
  DocData: {
    docs: {
      /**
       * Last modified date of document file, obtained from version control.
       *
       */
      lastModified?: Date;
    },
  }
}>({"doc":{"passthroughs":["extractedReferences","lastModified"]}});

export const docs = await create.docsLazy("docs", "src/content/docs", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../src/content/docs",
  "query": {
    "collection": "docs"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../src/content/docs",
  "query": {
    "collection": "docs",
    "only": "frontmatter"
  },
  "import": "frontmatter",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../src/content/docs",
  "query": {
    "collection": "docs"
  },
  "eager": false
}));