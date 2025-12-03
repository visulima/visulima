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
-> @visulima/colorize     3.883.386 ops/sec ± 0.38%
ansi-colors            1.765.657 ops/sec ± 0.27%
ansis                  3.372.162 ops/sec ± 4.06%
cli-color                428.485 ops/sec ± 0.07%
color-cli                117.771 ops/sec ± 0.51%
colors-js              1.112.247 ops/sec ± 0.17%
+ colorette              5.030.518 ops/sec ± 0.28%
chalk                  2.868.150 ops/sec ± 0.32%
kleur/colors           2.938.692 ops/sec ± 0.22%
kleur                  2.860.978 ops/sec ± 0.45%
picocolors             2.862.501 ops/sec ± 0.69%
```

### Base colors

```js
const colors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

colors.forEach((color) => c[color]("foo"));
```

```diff
-> @visulima/colorize     7.779.144 ops/sec ± 0.41%
ansi-colors            1.547.517 ops/sec ± 0.22%
ansis                  7.195.309 ops/sec ± 0.10%
chalk                  6.257.091 ops/sec ± 0.12%
cli-color                249.958 ops/sec ± 0.08%
color-cli                121.728 ops/sec ± 0.24%
colorette              1.950.473 ops/sec ± 0.13%
colors-js                801.105 ops/sec ± 0.44%
kleur                  8.120.722 ops/sec ± 0.89%
kleur/colors           1.870.813 ops/sec ± 0.37%
+ picocolors             9.665.514 ops/sec ± 0.55%

```

### Chained styles

```js
const colors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

colors.forEach((color) => c[color].bold.underline.italic("foo"));
```

```diff
+ @visulima/colorize               7.332.700 ops/sec ± 0.51%
ansi-colors                        172.756 ops/sec ± 0.29%
ansis                            6.478.144 ops/sec ± 1.20%
chalk                            1.903.031 ops/sec ± 0.07%
cli-color                          130.137 ops/sec ± 0.21%
color-cli                           56.042 ops/sec ± 0.98%
colorette (not supported)             FAIL
colors-js                          140.710 ops/sec ± 0.41%
kleur                              704.839 ops/sec ± 0.29%
kleur/colors (not supported)          FAIL
picocolors (not supported)            FAIL

```

### Nested calls

```js
const colors = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

colors.forEach((color) => c[color](c.bold(c.underline(c.italic("foo")))));
```

```diff
-> @visulima/colorize       776.801 ops/sec ± 0.96%
ansi-colors              341.336 ops/sec ± 0.45%
ansis                    754.309 ops/sec ± 1.29%
chalk                    655.428 ops/sec ± 0.50%
cli-color                 56.812 ops/sec ± 0.68%
color-cli                 14.723 ops/sec ± 0.58%
colorette                777.916 ops/sec ± 0.79%
colors-js                172.893 ops/sec ± 0.71%
kleur                    900.249 ops/sec ± 0.16%
kleur/colors             651.001 ops/sec ± 0.88%
+ picocolors             2.159.267 ops/sec ± 0.68%
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
-> @visulima/colorize       256.431 ops/sec ± 0.24%
ansi-colors              153.999 ops/sec ± 0.36%
ansis                    240.313 ops/sec ± 1.07%
chalk                    202.621 ops/sec ± 1.04%
cli-color                 34.107 ops/sec ± 1.10%
color-cli                 16.467 ops/sec ± 0.32%
+ colorette                307.285 ops/sec ± 0.18%
colors.js                 81.626 ops/sec ± 0.28%
kleur                    268.638 ops/sec ± 0.60%
kleur/colors             284.746 ops/sec ± 0.42%
picocolors               283.909 ops/sec ± 4.73%

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
-> @visulima/colorize     1.147.849 ops/sec ± 3.04%
ansi-colors              507.422 ops/sec ± 0.17%
ansis                  1.111.547 ops/sec ± 0.88%
chalk                    701.494 ops/sec ± 0.32%
cli-color                192.739 ops/sec ± 0.84%
color-cli                 46.218 ops/sec ± 0.15%
+ colorette              1.474.752 ops/sec ± 0.18%
colors.js                464.548 ops/sec ± 0.16%
kleur                    671.008 ops/sec ± 0.57%
kleur/colors             691.145 ops/sec ± 0.18%
picocolors             1.275.781 ops/sec ± 1.26%
```

### New Line

```js
c.bgGreen(`\nColor\nNEW LINE\nNEXT NEW LINE\n`);
```

```diff
-> @visulima/colorize     2.797.578 ops/sec ± 0.71%
ansi-colors            1.787.100 ops/sec ± 0.33%
ansis                  2.953.726 ops/sec ± 0.49%
+ chalk                  6.462.183 ops/sec ± 1.47%
colors.js              1.495.718 ops/sec ± 1.15%
```

### RGB colors

```js
for (let index = 0; index < 256; index++) colorize.rgb(index, 150, 200)("foo");
```

```diff
-> @visulima/colorize        42.320 ops/sec ± 1.65%
+ ansis                     43.358 ops/sec ± 0.57%
chalk                     39.128 ops/sec ± 0.39%
```

### HEX colors

Only this libraries support truecolor: `@visulima/colorize`, `ansis` and `chalk`

```js
c.hex("#FBA")("foo");
```

```diff
-> @visulima/colorize     4.117.180 ops/sec ± 0.70%
+ ansis                  4.617.938 ops/sec ± 0.69%
chalk                  2.862.404 ops/sec ± 1.70%
```

### Template literals

```js
red`red ${yellow`yellow ${green`green`} yellow`} red`;
```

```diff
-> @visulima/colorize     1.267.758 ops/sec ± 0.71%
+ ansis                  1.287.445 ops/sec ± 0.27%
```
