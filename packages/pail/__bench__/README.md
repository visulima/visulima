# Benchmark

Compare the performance of different logger packages.

## Run benchmark

```bash
pnpm --filter "pail" run test:bench
```

### basic logging

| Name                | Hz            | Min    | Max     | Mean   | P75    | P99    | P995   | P999   | RME     | Samples |
| ------------------- | ------------- | ------ | ------- | ------ | ------ | ------ | ------ | ------ | ------- | ------- |
| pail server         | 10,040,179.85 | 0.0001 | 2.6018  | 0.0001 | 0.0001 | 0.0003 | 0.0004 | 0.0009 | ±1.34%  | 5020092 |
| pail browser        | 196,046.49    | 0.0035 | 9.5510  | 0.0051 | 0.0042 | 0.0091 | 0.0104 | 0.0239 | ±6.42%  | 98024   |
| consola basic       | 1,567,183.98  | 0.0005 | 0.8279  | 0.0006 | 0.0006 | 0.0011 | 0.0014 | 0.0021 | ±1.55%  | 783592  |
| consola server      | 11,230,469.33 | 0.0001 | 0.9449  | 0.0001 | 0.0001 | 0.0003 | 0.0003 | 0.0005 | ±1.68%  | 5615235 |
| consola browser     | 1,472,326.89  | 0.0005 | 0.9454  | 0.0007 | 0.0006 | 0.0013 | 0.0016 | 0.0027 | ±1.96%  | 736164  |
| tslog               | 18,869.46     | 0.0433 | 5.6807  | 0.0530 | 0.0513 | 0.0868 | 0.2611 | 0.3465 | ±2.39%  | 10000   |
| bunyan node stream  | 453,827.03    | 0.0013 | 8.3086  | 0.0022 | 0.0023 | 0.0051 | 0.0059 | 0.0101 | ±4.89%  | 226914  |
| winston node stream | 472,886.33    | 0.0010 | 7.3014  | 0.0021 | 0.0013 | 0.0035 | 0.0041 | 0.0081 | ±10.83% | 236875  |
| pino destination    | 1,125,266.88  | 0.0002 | 34.9560 | 0.0009 | 0.0004 | 0.0009 | 0.0011 | 0.0292 | ±22.17% | 565158  |
| pino node stream    | 973,973.08    | 0.0005 | 14.5526 | 0.0010 | 0.0010 | 0.0029 | 0.0033 | 0.0059 | ±7.74%  | 486987  |
| pino min length     | 1,639,999.22  | 0.0002 | 6.5830  | 0.0006 | 0.0003 | 0.0006 | 0.0007 | 0.0010 | ±13.85% | 820000  |

### object logging

| Name                | Hz           | Min    | Max     | Mean   | P75    | P99    | P995   | P999   | RME     | Samples |
| ------------------- | ------------ | ------ | ------- | ------ | ------ | ------ | ------ | ------ | ------- | ------- |
| pail server         | 9,284,636.76 | 0.0001 | 2.4155  | 0.0001 | 0.0001 | 0.0003 | 0.0005 | 0.0012 | ±1.45%  | 4642319 |
| pail browser        | 143,337.23   | 0.0035 | 7.7656  | 0.0070 | 0.0065 | 0.0109 | 0.0128 | 0.0346 | ±6.14%  | 71669   |
| consola basic       | 1,418,213.45 | 0.0005 | 0.3751  | 0.0007 | 0.0007 | 0.0013 | 0.0016 | 0.0023 | ±0.65%  | 709107  |
| consola server      | 9,249,110.24 | 0.0001 | 0.5054  | 0.0001 | 0.0001 | 0.0004 | 0.0005 | 0.0008 | ±1.06%  | 4624556 |
| consola browser     | 1,360,671.15 | 0.0006 | 0.5902  | 0.0007 | 0.0007 | 0.0015 | 0.0017 | 0.0026 | ±0.96%  | 680336  |
| tslog               | 18,046.41    | 0.0443 | 3.0612  | 0.0554 | 0.0533 | 0.1123 | 0.3928 | 0.4967 | ±1.80%  | 10000   |
| bunyan node stream  | 482,903.00   | 0.0014 | 4.5062  | 0.0021 | 0.0017 | 0.0048 | 0.0060 | 0.0113 | ±3.81%  | 241452  |
| winston node stream | 395,083.87   | 0.0011 | 8.7136  | 0.0025 | 0.0018 | 0.0039 | 0.0048 | 0.0114 | ±12.34% | 197542  |
| pino destination    | 1,257,313.61 | 0.0003 | 23.5762 | 0.0008 | 0.0003 | 0.0008 | 0.0009 | 0.0015 | ±19.32% | 633871  |
| pino node stream    | 844,349.98   | 0.0005 | 69.6978 | 0.0012 | 0.0009 | 0.0031 | 0.0037 | 0.0325 | ±27.86% | 422175  |
| pino min length     | 1,103,192.81 | 0.0003 | 27.4102 | 0.0009 | 0.0004 | 0.0009 | 0.0010 | 0.0015 | ±22.28% | 555336  |

### deep object logging

| Name                | Hz            | Min    | Max     | Mean   | P75    | P99    | P995   | P999   | RME     | Samples |
| ------------------- | ------------- | ------ | ------- | ------ | ------ | ------ | ------ | ------ | ------- | ------- |
| pail server         | 10,205,267.10 | 0.0001 | 1.7294  | 0.0001 | 0.0001 | 0.0003 | 0.0004 | 0.0009 | ±1.30%  | 5102634 |
| pail browser        | 186,433.61    | 0.0035 | 13.9388 | 0.0054 | 0.0043 | 0.0093 | 0.0108 | 0.0264 | ±8.06%  | 93217   |
| consola basic       | 80,760.18     | 0.0106 | 0.4763  | 0.0124 | 0.0119 | 0.0192 | 0.0240 | 0.2262 | ±0.84%  | 40381   |
| consola server      | 11,424,402.71 | 0.0001 | 0.4683  | 0.0001 | 0.0001 | 0.0003 | 0.0003 | 0.0006 | ±0.95%  | 5712202 |
| consola browser     | 80,313.59     | 0.0106 | 0.6509  | 0.0125 | 0.0120 | 0.0172 | 0.0207 | 0.2652 | ±0.99%  | 40157   |
| bunyan node stream  | 63,745.21     | 0.0129 | 0.4416  | 0.0157 | 0.0146 | 0.0236 | 0.0269 | 0.3249 | ±0.93%  | 31873   |
| winston node stream | 10,756.87     | 0.0337 | 26.7946 | 0.0930 | 0.0615 | 0.2732 | 4.5431 | 6.2458 | ±10.84% | 10000   |
| pino destination    | 33,985.25     | 0.0127 | 8.6157  | 0.0294 | 0.0209 | 0.0321 | 0.0592 | 5.3242 | ±13.20% | 16993   |
| pino node stream    | 24,437.23     | 0.0223 | 15.3209 | 0.0409 | 0.0392 | 0.1147 | 0.3042 | 1.5361 | ±6.87%  | 12219   |
| pino min length     | 30,122.98     | 0.0127 | 22.8595 | 0.0332 | 0.0184 | 0.0463 | 0.0561 | 4.7366 | ±18.81% | 15092   |

### child creation

| Name                | Hz         | Min    | Max     | Mean   | P75    | P99    | P995   | P999   | RME     | Samples |
| ------------------- | ---------- | ------ | ------- | ------ | ------ | ------ | ------ | ------ | ------- | ------- |
| pail server         | 253,464.96 | 0.0026 | 4.9384  | 0.0039 | 0.0034 | 0.0135 | 0.0160 | 0.0305 | ±2.99%  | 126733  |
| pail browser        | 13,358.51  | 0.0559 | 2.3607  | 0.0749 | 0.0732 | 0.2502 | 0.6154 | 0.8444 | ±1.62%  | 10000   |
| bunyan node stream  | 322,585.79 | 0.0020 | 7.4370  | 0.0031 | 0.0031 | 0.0096 | 0.0116 | 0.0197 | ±3.58%  | 161295  |
| winston node stream | 265,707.67 | 0.0016 | 14.5599 | 0.0038 | 0.0020 | 0.0058 | 0.0068 | 0.0147 | ±15.89% | 132854  |
| pino destination    | 535,635.87 | 0.0004 | 54.6366 | 0.0019 | 0.0008 | 0.0030 | 0.0033 | 0.0048 | ±27.40% | 267818  |
| pino node stream    | 751,903.07 | 0.0008 | 4.5502  | 0.0013 | 0.0010 | 0.0039 | 0.0048 | 0.0083 | ±5.30%  | 375952  |
| pino min length     | 616,433.31 | 0.0005 | 13.3866 | 0.0016 | 0.0007 | 0.0024 | 0.0031 | 0.0054 | ±17.53% | 312343  |

### child child creation

| Name                | Hz           | Min    | Max     | Mean   | P75    | P99    | P995   | P999   | RME     | Samples |
| ------------------- | ------------ | ------ | ------- | ------ | ------ | ------ | ------ | ------ | ------- | ------- |
| pail server         | 9,471,032.17 | 0.0001 | 4.2687  | 0.0001 | 0.0001 | 0.0003 | 0.0004 | 0.0011 | ±2.02%  | 4735517 |
| pail browser        | 182,562.67   | 0.0035 | 14.4143 | 0.0055 | 0.0051 | 0.0095 | 0.0113 | 0.0271 | ±8.79%  | 91282   |
| bunyan node stream  | 443,631.97   | 0.0015 | 2.4177  | 0.0023 | 0.0024 | 0.0053 | 0.0061 | 0.0119 | ±2.42%  | 221816  |
| winston node stream | 373,399.85   | 0.0011 | 17.2341 | 0.0027 | 0.0018 | 0.0056 | 0.0071 | 0.0417 | ±12.54% | 186700  |
| pino destination    | 2,112,340.27 | 0.0002 | 12.2713 | 0.0005 | 0.0002 | 0.0004 | 0.0005 | 0.0010 | ±14.96% | 1060800 |
| pino node stream    | 1,024,338.85 | 0.0004 | 13.2624 | 0.0010 | 0.0007 | 0.0024 | 0.0053 | 0.0442 | ±8.09%  | 512170  |
| pino min length     | 1,523,193.41 | 0.0002 | 27.2906 | 0.0007 | 0.0002 | 0.0005 | 0.0006 | 0.0012 | ±22.65% | 761597  |

### long-string message

| Name                | Hz            | Min    | Max     | Mean   | P75    | P99    | P995   | P999   | RME     | Samples |
| ------------------- | ------------- | ------ | ------- | ------ | ------ | ------ | ------ | ------ | ------- | ------- |
| pail server         | 10,233,474.43 | 0.0001 | 2.6823  | 0.0001 | 0.0001 | 0.0003 | 0.0004 | 0.0010 | ±1.39%  | 5116738 |
| pail browser        | 78,163.13     | 0.0102 | 15.3111 | 0.0128 | 0.0126 | 0.0182 | 0.0243 | 0.0414 | ±6.50%  | 39082   |
| consola basic       | 171,819.51    | 0.0040 | 0.7873  | 0.0058 | 0.0058 | 0.0088 | 0.0121 | 0.0310 | ±1.47%  | 85910   |
| consola server      | 10,872,150.77 | 0.0001 | 0.7175  | 0.0001 | 0.0001 | 0.0003 | 0.0003 | 0.0006 | ±1.30%  | 5436076 |
| consola browser     | 183,297.62    | 0.0039 | 0.8397  | 0.0055 | 0.0051 | 0.0079 | 0.0084 | 0.0285 | ±1.72%  | 91649   |
| tslog               | 11,154.66     | 0.0567 | 5.9693  | 0.0896 | 0.0958 | 0.4349 | 0.7609 | 1.3466 | ±2.73%  | 10000   |
| bunyan node stream  | 59,917.14     | 0.0099 | 10.0185 | 0.0167 | 0.0173 | 0.0315 | 0.0715 | 0.4408 | ±4.94%  | 29959   |
| winston node stream | 44,448.76     | 0.0101 | 11.5227 | 0.0225 | 0.0199 | 0.0387 | 0.0757 | 2.2577 | ±8.89%  | 22225   |
| pino destination    | 105,419.26    | 0.0030 | 32.1004 | 0.0095 | 0.0058 | 0.0071 | 0.0097 | 2.2912 | ±18.28% | 52710   |
| pino node stream    | 60,414.54     | 0.0092 | 15.7950 | 0.0166 | 0.0150 | 0.0360 | 0.0494 | 1.0004 | ±7.79%  | 30208   |
| pino min length     | 112,993.25    | 0.0030 | 27.5667 | 0.0089 | 0.0057 | 0.0155 | 0.0208 | 2.1150 | ±15.86% | 58172   |
