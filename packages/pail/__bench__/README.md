# Benchmark

Compare the performance of different logger packages.

## System Information

These benchmarks were run on the following system:

- **OS**: Linux (Arch Linux, kernel 6.12.51-1-lts)
- **CPU**: AMD Ryzen 5 7500F 6-Core Processor (6 cores, 12 threads)
- **Memory**: 64GB
- **Node.js**: v24.9.0
- **npm**: 11.6.2

## Logger Overview

This benchmark compares various JavaScript/TypeScript logging libraries across different use cases:

### Tested Loggers

- **pail server/browser**: Visulima's own pail logger (the library being benchmarked)
    - **Synchronous API** - Logging calls return immediately without blocking the event loop
    - Handles stream backpressure asynchronously through event listeners
    - Feature-rich with structured logging, custom reporters, and browser support
    - Designed for both server and client-side usage
    - Great developer experience with colored console output

- **consola server/browser**: Universal logger with beautiful output
    - Great developer experience with colored console output
    - Supports both server and browser environments
    - Known for its clean, readable log formatting

- **tslog**: TypeScript-first logger with JSON output
    - Strong TypeScript integration and type safety
    - Outputs structured JSON logs
    - Good for production environments needing structured data

- **pino**: High-performance JSON logger
    - Extremely fast JSON logging optimized for production
    - Low overhead and high throughput
    - Excellent for high-volume logging scenarios

- **bunyan**: Mature JSON logging library
    - Battle-tested with good ecosystem support
    - Structured logging with JSON output
    - Good choice for enterprise applications

- **winston**: Feature-rich logging framework
    - Highly configurable with multiple transports
    - Supports various output formats and storage backends
    - Popular choice with extensive plugin ecosystem

- **ogma logger/json**: Modern logger with beautiful output
    - Focuses on developer experience and readability
    - Supports both human-readable and JSON formats
    - Good balance of performance and usability

- **diary**: Simple and fast structured logger
    - Lightweight with focus on performance
    - JSON output with minimal overhead
    - Good for applications needing simple, fast logging

- **signale**: Beautiful console logging
    - Excellent for CLI tools and development
    - Highly customizable visual output
    - Not optimized for production/structured logging

- **rslog**: Fast and lightweight logger
    - High-performance logging with minimal overhead
    - Supports multiple log levels and custom overrides
    - Excellent for applications requiring fast logging

### Blocking vs Non-Blocking Behavior

Most logging libraries in these benchmarks use **synchronous APIs** - logging calls return immediately without waiting for I/O operations to complete. However, they handle stream backpressure asynchronously:

- **Synchronous API**: Logging methods return immediately (non-blocking calls)
- **Async backpressure handling**: Libraries listen for 'drain' events when streams are full
- **Performance impact**: Synchronous APIs generally perform better in benchmarks but may drop messages during high load if streams can't keep up

### Benchmark Scenarios

- **Basic logging**: Simple string messages
- **Object logging**: Structured data with objects
- **Deep object logging**: Complex nested object structures
- **Long string logging**: Large text content (2KB strings)

## Run benchmark

```bash
pnpm --filter "pail" run test:bench
```

### basic logging

| Name                | Hz            | Min    | Max     | Mean   | P75    | P99    | P995   | P999   | RME     | Samples |
| ------------------- | ------------- | ------ | ------- | ------ | ------ | ------ | ------ | ------ | ------- | ------- |
| rslog               | 13,162,500.55 | 0.0001 | 0.5726  | 0.0001 | 0.0001 | 0.0001 | 0.0001 | 0.0003 | ±0.28%  | 6581251 |
| pail server         | 12,476,229.65 | 0.0001 | 0.4835  | 0.0001 | 0.0001 | 0.0001 | 0.0001 | 0.0003 | ±0.21%  | 6238115 |
| consola browser     | 11,880,371.52 | 0.0001 | 0.2646  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0003 | ±0.45%  | 5940186 |
| consola server      | 11,871,555.95 | 0.0001 | 0.7111  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0003 | ±0.45%  | 5935778 |
| diary               | 11,642,853.44 | 0.0001 | 0.0797  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0004 | ±0.06%  | 5821427 |
| roarr               | 5,045,712.19  | 0.0001 | 0.9590  | 0.0002 | 0.0001 | 0.0004 | 0.0005 | 0.0007 | ±2.36%  | 2523109 |
| signale             | 1,984,662.70  | 0.0003 | 4.1051  | 0.0005 | 0.0004 | 0.0018 | 0.0020 | 0.0040 | ±3.47%  | 992332  |
| tslog               | 1,822,567.08  | 0.0005 | 0.2064  | 0.0005 | 0.0005 | 0.0008 | 0.0009 | 0.0011 | ±0.55%  | 911284  |
| pino destination    | 1,807,156.72  | 0.0003 | 6.9131  | 0.0006 | 0.0004 | 0.0007 | 0.0009 | 0.0018 | ±9.19%  | 908137  |
| pino min length     | 1,701,986.97  | 0.0003 | 4.4917  | 0.0006 | 0.0004 | 0.0006 | 0.0007 | 0.0010 | ±10.11% | 850994  |
| pino node stream    | 1,276,284.59  | 0.0005 | 2.4021  | 0.0008 | 0.0006 | 0.0023 | 0.0025 | 0.0351 | ±3.34%  | 638332  |
| ogma json logger    | 1,056,603.13  | 0.0005 | 6.7761  | 0.0009 | 0.0006 | 0.0015 | 0.0027 | 0.0459 | ±5.15%  | 528302  |
| ogma logger         | 935,970.86    | 0.0008 | 2.0083  | 0.0011 | 0.0009 | 0.0024 | 0.0027 | 0.0049 | ±3.41%  | 467986  |
| pail browser        | 687,939.22    | 0.0013 | 0.6968  | 0.0015 | 0.0014 | 0.0023 | 0.0025 | 0.0035 | ±0.79%  | 343970  |
| winston node stream | 580,504.13    | 0.0010 | 11.1005 | 0.0017 | 0.0012 | 0.0031 | 0.0037 | 0.0095 | ±7.43%  | 291530  |
| bunyan node stream  | 570,976.84    | 0.0015 | 0.9858  | 0.0018 | 0.0017 | 0.0030 | 0.0032 | 0.0057 | ±1.57%  | 285489  |

### object logging

| Name                | Hz            | Min    | Max     | Mean   | P75    | P99    | P995   | P999   | RME     | Samples |
| ------------------- | ------------- | ------ | ------- | ------ | ------ | ------ | ------ | ------ | ------- | ------- |
| pail server         | 10,766,053.18 | 0.0001 | 0.1354  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0004 | ±0.15%  | 5383027 |
| rslog               | 10,698,199.02 | 0.0001 | 0.5483  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0004 | ±0.41%  | 5349100 |
| consola server      | 9,589,876.52  | 0.0001 | 0.3544  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0004 | ±0.55%  | 4794939 |
| diary               | 9,511,740.46  | 0.0001 | 1.4519  | 0.0001 | 0.0001 | 0.0002 | 0.0002 | 0.0004 | ±0.59%  | 4755871 |
| consola browser     | 9,374,803.16  | 0.0001 | 0.5702  | 0.0001 | 0.0001 | 0.0002 | 0.0002 | 0.0004 | ±0.89%  | 4687402 |
| roarr               | 5,057,179.17  | 0.0001 | 0.8295  | 0.0002 | 0.0002 | 0.0005 | 0.0005 | 0.0007 | ±1.95%  | 2530069 |
| pino destination    | 1,540,513.35  | 0.0003 | 4.9371  | 0.0006 | 0.0004 | 0.0007 | 0.0008 | 0.0011 | ±10.94% | 773876  |
| pino min length     | 1,451,903.42  | 0.0003 | 5.0706  | 0.0007 | 0.0004 | 0.0007 | 0.0008 | 0.0011 | ±11.63% | 726182  |
| pino node stream    | 1,205,575.52  | 0.0005 | 2.4651  | 0.0008 | 0.0007 | 0.0023 | 0.0026 | 0.0046 | ±4.56%  | 602788  |
| tslog               | 837,304.72    | 0.0010 | 0.6700  | 0.0012 | 0.0011 | 0.0026 | 0.0028 | 0.0058 | ±1.34%  | 418653  |
| pail browser        | 680,564.11    | 0.0013 | 0.2749  | 0.0015 | 0.0015 | 0.0018 | 0.0020 | 0.0026 | ±0.35%  | 340283  |
| ogma json logger    | 606,532.75    | 0.0010 | 5.4349  | 0.0016 | 0.0012 | 0.0032 | 0.0270 | 0.0488 | ±5.04%  | 303267  |
| ogma logger         | 535,209.38    | 0.0013 | 9.0980  | 0.0019 | 0.0015 | 0.0026 | 0.0030 | 0.0276 | ±6.44%  | 268045  |
| winston node stream | 502,853.82    | 0.0011 | 4.0436  | 0.0020 | 0.0013 | 0.0031 | 0.0038 | 0.0076 | ±8.16%  | 251515  |
| bunyan node stream  | 495,741.15    | 0.0016 | 1.0285  | 0.0020 | 0.0018 | 0.0034 | 0.0038 | 0.0079 | ±1.96%  | 247871  |

### deep object logging

| Name                | Hz            | Min    | Max     | Mean   | P75    | P99    | P995   | P999    | RME     | Samples |
| ------------------- | ------------- | ------ | ------- | ------ | ------ | ------ | ------ | ------- | ------- | ------- |
| pail server         | 12,228,274.97 | 0.0001 | 0.2649  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0004  | ±0.17%  | 6114138 |
| consola server      | 11,948,241.55 | 0.0001 | 0.3279  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0003  | ±0.52%  | 5974121 |
| consola browser     | 11,909,039.76 | 0.0001 | 0.4719  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0003  | ±0.76%  | 5954520 |
| diary               | 10,177,447.65 | 0.0001 | 3.4220  | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0004  | ±1.41%  | 5088724 |
| rslog               | 8,973,650.51  | 0.0001 | 0.4934  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0004  | ±0.29%  | 4486826 |
| roarr               | 5,212,457.06  | 0.0001 | 0.9548  | 0.0002 | 0.0001 | 0.0004 | 0.0005 | 0.0006  | ±2.14%  | 2606229 |
| bunyan node stream  | 76,490.79     | 0.0122 | 0.3502  | 0.0131 | 0.0130 | 0.0188 | 0.0202 | 0.0506  | ±0.35%  | 38246   |
| pino destination    | 57,733.48     | 0.0117 | 3.5912  | 0.0173 | 0.0125 | 0.0179 | 0.0200 | 2.8866  | ±8.00%  | 28867   |
| pino min length     | 53,939.26     | 0.0117 | 4.5702  | 0.0185 | 0.0128 | 0.0391 | 0.0435 | 2.7806  | ±8.12%  | 27013   |
| pail browser        | 47,012.48     | 0.0199 | 0.3165  | 0.0213 | 0.0212 | 0.0263 | 0.0305 | 0.1350  | ±0.36%  | 23507   |
| tslog               | 45,018.91     | 0.0206 | 0.3497  | 0.0222 | 0.0216 | 0.0265 | 0.0358 | 0.2236  | ±0.68%  | 22510   |
| pino node stream    | 44,553.78     | 0.0140 | 4.0725  | 0.0224 | 0.0186 | 0.0716 | 0.0852 | 0.6019  | ±2.94%  | 22281   |
| ogma json logger    | 30,652.55     | 0.0240 | 3.5808  | 0.0326 | 0.0268 | 0.0843 | 0.0947 | 0.6269  | ±3.02%  | 15327   |
| ogma logger         | 29,426.59     | 0.0262 | 2.4213  | 0.0340 | 0.0286 | 0.0919 | 0.1116 | 0.8105  | ±2.46%  | 14714   |
| winston node stream | 17,216.94     | 0.0246 | 10.9716 | 0.0581 | 0.0292 | 0.1444 | 2.9448 | 3.5113  | ±10.42% | 10000   |

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
| rslog               | 13,073,734.93 | 0.0001 | 1.8546  | 0.0001 | 0.0001 | 0.0001 | 0.0001 | 0.0003 | ±0.95%  | 6536868 |
| pail server         | 12,231,343.68 | 0.0001 | 0.2676  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0003 | ±0.21%  | 6115672 |
| consola server      | 12,103,718.35 | 0.0001 | 0.3456  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0003 | ±0.52%  | 6051860 |
| consola browser     | 11,663,785.09 | 0.0001 | 0.6209  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0003 | ±0.69%  | 5831893 |
| diary               | 10,912,978.87 | 0.0001 | 4.6154  | 0.0001 | 0.0001 | 0.0002 | 0.0002 | 0.0004 | ±1.87%  | 5456490 |
| roarr               | 4,483,773.65  | 0.0001 | 1.4440  | 0.0002 | 0.0001 | 0.0005 | 0.0005 | 0.0008 | ±3.28%  | 2241887 |
| tslog               | 1,857,675.80  | 0.0004 | 0.1992  | 0.0005 | 0.0005 | 0.0008 | 0.0009 | 0.0011 | ±0.46%  | 928838  |
| pino destination    | 173,828.95    | 0.0033 | 2.5314  | 0.0058 | 0.0038 | 0.0054 | 0.0062 | 1.6682 | ±7.22%  | 86915   |
| pino min length     | 158,913.17    | 0.0034 | 3.8143  | 0.0063 | 0.0039 | 0.0121 | 0.0147 | 1.8524 | ±8.20%  | 79457   |
| ogma logger         | 132,776.86    | 0.0039 | 6.9562  | 0.0075 | 0.0056 | 0.0235 | 0.0284 | 0.0679 | ±6.67%  | 66389   |
| pail browser        | 109,269.53    | 0.0078 | 0.3948  | 0.0092 | 0.0091 | 0.0139 | 0.0154 | 0.1005 | ±0.50%  | 54640   |
| bunyan node stream  | 78,809.20     | 0.0092 | 2.5466  | 0.0127 | 0.0125 | 0.0185 | 0.0412 | 0.2151 | ±1.40%  | 39405   |
| ogma json logger    | 76,807.73     | 0.0081 | 4.6466  | 0.0130 | 0.0096 | 0.0328 | 0.0438 | 0.7952 | ±5.42%  | 38404   |
| pino node stream    | 72,459.29     | 0.0081 | 4.5863  | 0.0138 | 0.0118 | 0.0367 | 0.0550 | 0.5005 | ±3.99%  | 36230   |
| winston node stream | 61,600.30     | 0.0089 | 52.8699 | 0.0162 | 0.0121 | 0.0243 | 0.0659 | 1.2511 | ±21.40% | 30874   |
