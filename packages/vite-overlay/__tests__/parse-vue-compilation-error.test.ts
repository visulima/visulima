import { describe, expect, it } from "vitest";

import { parseVueCompilationError } from "../src/utils/error-processing/parse-vue-compilation-error";

describe(parseVueCompilationError, () => {
    describe("vue SFC compilation error parsing", () => {
        it("should parse valid Vue compilation error with position", () => {
            expect.assertions(1);

            const errorMessage = `[vue/compiler-sfc] Unexpected token, expected "," (4:2)

src/components/HelloWorld.vue
2  |  defineProps<{
3  |    msg: string;
4  >  |}>();
5    |
6    |  const count = ref(0);`;

            const result = parseVueCompilationError(errorMessage);

            expect(result).toStrictEqual({
                column: 2,
                line: 4,
                message: '[vue/compiler-sfc] Unexpected token, expected "," (4:2)',
                originalFilePath: "src/components/HelloWorld.vue",
            });
        });

        it("should parse Vue compilation error with different position", () => {
            expect.assertions(1);

            const errorMessage = `[vue/compiler-sfc] Property 'invalidProp' does not exist on type (10:15)

components/Button.vue
8  |  <template>
9  |    <button @click="handleClick">
10 >  |      {{ invalidProp }}
11 |    </button>
12 |  </template>`;

            const result = parseVueCompilationError(errorMessage);

            expect(result).toStrictEqual({
                column: 15,
                line: 10,
                message: "[vue/compiler-sfc] Property 'invalidProp' does not exist on type (10:15)",
                originalFilePath: "components/Button.vue",
            });
        });

        it("should return null for non-Vue compilation errors", () => {
            expect.assertions(1);

            const errorMessage = "SyntaxError: Unexpected token '}'";
            const result = parseVueCompilationError(errorMessage);

            expect(result).toBeNull();
        });

        it("should return null when no position information is found", () => {
            expect.assertions(1);

            const errorMessage = `[vue/compiler-sfc] Some error without position info

src/App.vue
<template>
  <div>Content</div>
</template>`;

            const result = parseVueCompilationError(errorMessage);

            expect(result).toBeNull();
        });

        it("should return null when no file path is found", () => {
            expect.assertions(1);

            const errorMessage = `[vue/compiler-sfc] Error without file path (5:10)

2  |  <template>
3  |    <div>
4  |      Content
5  |    </div>
6  |  </template>`;

            const result = parseVueCompilationError(errorMessage);

            expect(result).toBeNull();
        });

        it("should handle multiline error messages", () => {
            expect.assertions(1);

            const errorMessage = `[vue/compiler-sfc] Type 'string' is not assignable to type 'number' (8:25)

src/components/Counter.vue
6  |  <script setup lang="ts">
7  |    const count = ref<number>(0);
8  |    const message: string = count; // This should be a number
9  |  </script>
10 |
11 |  <template>
12 |    <div>{{ message }}</div>
13 |  </template>`;

            const result = parseVueCompilationError(errorMessage);

            expect(result).toStrictEqual({
                column: 25,
                line: 8,
                message: "[vue/compiler-sfc] Type 'string' is not assignable to type 'number' (8:25)",
                originalFilePath: "src/components/Counter.vue",
            });
        });

        it("should handle edge case with zero line/column", () => {
            expect.assertions(1);

            const errorMessage = `[vue/compiler-sfc] Some error (0:0)

src/App.vue`;

            const result = parseVueCompilationError(errorMessage);

            expect(result).toBeNull();
        });

        it("should handle relative file paths", () => {
            expect.assertions(1);

            const errorMessage = `[vue/compiler-sfc] Missing required prop (3:5)

../shared/components/Modal.vue
1  |  <template>
2  |    <div class="modal">
3  |      <slot />
4  |    </div>
5  |  </template>`;

            const result = parseVueCompilationError(errorMessage);

            expect(result).toStrictEqual({
                column: 5,
                line: 3,
                message: "[vue/compiler-sfc] Missing required prop (3:5)",
                originalFilePath: "../shared/components/Modal.vue",
            });
        });
    });
});
