# Benchmark

Compare the performance of different packages.

## Run benchmark

```bash
pnpm --filter "fmt" run test:bench
```

## Simple benchmark

| Name                   | Hz           | Min    | Max    | Mean   | P75    | P99    | P995   | P999   | RME    | Samples |
| ---------------------- | ------------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------- |
| util.format            | 2,408,653.10 | 0.0003 | 0.9203 | 0.0004 | 0.0004 | 0.0006 | 0.0008 | 0.0017 | ±0.42% | 1204327 |
| @visulima/fmt          | 2,558,663.97 | 0.0003 | 0.1314 | 0.0004 | 0.0004 | 0.0004 | 0.0005 | 0.0006 | ±0.22% | 1279333 |
| quick-format-unescaped | 1,799,797.87 | 0.0005 | 0.1132 | 0.0006 | 0.0006 | 0.0007 | 0.0007 | 0.0009 | ±0.16% | 899899  |

## Tail object benchmark

| Name                   | Hz           | Min    | Max    | Mean   | P75    | P99    | P995   | P999   | RME    | Samples |
| ---------------------- | ------------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------- |
| util.format            | 1,031,921.82 | 0.0008 | 0.1199 | 0.0010 | 0.0010 | 0.0013 | 0.0017 | 0.0022 | ±0.24% | 515961  |
| @visulima/fmt          | 3,239,056.85 | 0.0003 | 0.1750 | 0.0003 | 0.0003 | 0.0004 | 0.0004 | 0.0006 | ±0.36% | 1619529 |
| quick-format-unescaped | 2,149,133.34 | 0.0004 | 0.1456 | 0.0005 | 0.0005 | 0.0006 | 0.0006 | 0.0008 | ±0.22% | 1074567 |
