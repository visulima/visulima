# Benchmark

Compare the performance of different packages.

## Run benchmark

```bash
pnpm --filter "colorize" run test:bench
```

### Colorette bench

The benchmark used in [`colorette`](https://github.com/jorgebucaran/colorette/blob/main/bench/index.js).

```js
c.red(`${c.bold(`${c.cyan(`${c.yellow("yellow")}cyan`)}`)}red`);
```

```diff
-> @visulima/colorize     3.833.756 ops/sec ± 0.21%
ansi-colors            1.740.419 ops/sec ± 0.41%
ansis                  3.670.138 ops/sec ± 0.17%
cli-color                401.166 ops/sec ± 0.15%
color-cli                117.956 ops/sec ± 0.17%
colors-js              1.113.107 ops/sec ± 0.15%
+ colorette              5.014.698 ops/sec ± 0.88%
chalk                  2.726.188 ops/sec ± 0.80%
kleur/colors           2.906.865 ops/sec ± 0.29%
kleur                  2.888.852 ops/sec ± 0.23%
picocolors             2.878.073 ops/sec ± 0.45%
```

### Base colors

```js
const colors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
colors.forEach((color) => c[color]("foo"));
```

```diff
-> @visulima/colorize     7.729.428 ops/sec ± 0.13%
ansi-colors            1.487.376 ops/sec ± 0.35%
ansis                  7.404.831 ops/sec ± 0.24%
chalk                  6.083.427 ops/sec ± 0.67%
cli-color                237.798 ops/sec ± 0.34%
color-cli                119.582 ops/sec ± 0.19%
colorette              1.904.846 ops/sec ± 0.16%
colors-js                680.538 ops/sec ± 1.23%
kleur                  7.779.174 ops/sec ± 0.66%
kleur/colors           2.130.189 ops/sec ± 0.32%
+ picocolors             9.506.736 ops/sec ± 1.06%
```

### Chained styles

```js
const colors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
colors.forEach((color) => c[color].bold.underline.italic("foo"));
```

```diff
+ @visulima/colorize               6.957.206 ops/sec ± 1.22%
ansi-colors                        159.755 ops/sec ± 0.31%
ansis                            6.538.496 ops/sec ± 0.22%
chalk                            1.675.528 ops/sec ± 0.34%
cli-color                          126.265 ops/sec ± 0.29%
color-cli                           53.961 ops/sec ± 0.16%
colorette (not supported)             FAIL
colors-js                          137.354 ops/sec ± 0.18%
kleur                              635.561 ops/sec ± 0.53%
kleur/colors (not supported)          FAIL
picocolors (not supported)            FAIL
```

### Nested calls

```js
const colors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
colors.forEach((color) => c[color](c.bold(c.underline(c.italic("foo")))));
```

```diff
-> @visulima/colorize       775.911 ops/sec ± 0.66%
ansi-colors              340.343 ops/sec ± 0.49%
ansis                    800.530 ops/sec ± 0.11%
chalk                    578.272 ops/sec ± 0.15%
cli-color                 55.327 ops/sec ± 0.14%
color-cli                 14.721 ops/sec ± 0.21%
colorette                786.760 ops/sec ± 0.16%
colors-js                174.011 ops/sec ± 0.21%
kleur                    894.323 ops/sec ± 0.19%
kleur/colors             681.712 ops/sec ± 0.18%
+ picocolors             2.186.576 ops/sec ± 0.15%
```

### Nested styles

```js
c.red(
    `a red ${c.white("white")} red ${c.red("red")} red ${c.cyan("cyan")} red ${c.black("black")} red ${c.red("red")} red
  ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red
  ${c.green("green")} red ${c.red("red")} red ${c.yellow("yellow")} red ${c.blue("blue")} red ${c.red("red")} red
  ${c.magenta("magenta")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red
  ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red
  ${c.black("black")} red ${c.yellow("yellow")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red
  ${c.yellow("yellow")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red
  ${c.green("green")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red
  ${c.magenta("magenta")} red ${c.red("red")} red ${c.red("red")} red ${c.cyan("cyan")} red ${c.red("red")} red
  ${c.cyan("cyan")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red ${c.red("red")} red message`,
);
```

```diff
-> @visulima/colorize       253.492 ops/sec ± 0.35%
ansi-colors              152.327 ops/sec ± 0.56%
ansis                    246.551 ops/sec ± 0.19%
chalk                    205.815 ops/sec ± 0.27%
cli-color                 34.267 ops/sec ± 0.17%
color-cli                 16.627 ops/sec ± 0.16%
+ colorette                305.319 ops/sec ± 0.26%
colors.js                 87.139 ops/sec ± 0.10%
kleur                    267.911 ops/sec ± 0.20%
kleur/colors             284.389 ops/sec ± 0.46%
picocolors               296.257 ops/sec ± 0.41%
```

### Deep nested styles

```js
c.green(
    `green ${c.cyan(
        `cyan ${c.red(
            `red ${c.yellow(
                `yellow ${c.blue(`blue ${c.magenta(`magenta ${c.underline(`underline ${c.italic(`italic`)} underline`)} magenta`)} blue`)} yellow`,
            )} red`,
        )} cyan`,
    )} green`,
);
```

```diff
-> @visulima/colorize     1.166.131 ops/sec ± 0.37%
ansi-colors              507.814 ops/sec ± 0.37%
ansis                  1.158.778 ops/sec ± 0.12%
chalk                    707.794 ops/sec ± 0.15%
cli-color                185.600 ops/sec ± 0.33%
color-cli                 46.299 ops/sec ± 0.10%
+ colorette              1.464.090 ops/sec ± 0.16%
colors.js                468.172 ops/sec ± 0.19%
kleur                    674.589 ops/sec ± 0.12%
kleur/colors             689.403 ops/sec ± 0.16%
picocolors             1.284.482 ops/sec ± 0.27%
```

### New Line

```js
c.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`);
```

```diff
-> @visulima/colorize     2.829.644 ops/sec ± 0.20%
ansi-colors            1.805.387 ops/sec ± 0.26%
ansis                  3.040.513 ops/sec ± 0.21%
+ chalk                  6.572.364 ops/sec ± 0.40%
colors.js              1.533.999 ops/sec ± 0.54%
```

### RGB colors

```js
for (let index = 0; index < 256; index++) colorize.rgb(index, 150, 200)("foo");
```

```diff
@visulima/colorize 40.163 ops/sec ± 1.70%
ansis 42.614 ops/sec ± 0.41%
chalk 39.022 ops/sec ± 0.18%
```

### HEX colors

Only this libraries support truecolor: `@visulima/colorize`, `ansis` and `chalk`

```js
c.hex("#FBA")("foo");
```

```diff
-> @visulima/colorize 4.756.591 ops/sec ± 0.41%
+ ansis 4.958.752 ops/sec ± 0.32%
chalk 2.924.040 ops/sec ± 0.23%
```

### Template literals

```js
red`red ${yellow`yellow ${green`green`} yellow`} red`;
```

```diff
-> @visulima/colorize 1.267.322 ops/sec ± 0.93%
+ ansis 1.300.249 ops/sec ± 0.21%
```
