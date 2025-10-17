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
| pail server         | 12,290,665.53 | 0.0001 | 1.4513  | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0006 | ±0.58%  | 6145333 |
| pail browser        | 1,097,515.64  | 0.0008 | 0.4108  | 0.0009 | 0.0009 | 0.0017 | 0.0018 | 0.0028 | ±0.40%  | 548758  |
| consola server      | 12,902,679.02 | 0.0001 | 0.4080  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0007 | ±0.67%  | 6451340 |
| consola browser     | 12,585,814.39 | 0.0001 | 3.8451  | 0.0001 | 0.0001 | 0.0002 | 0.0002 | 0.0007 | ±1.98%  | 6292908 |
| tslog               | 1,959,956.40  | 0.0004 | 0.2665  | 0.0005 | 0.0005 | 0.0010 | 0.0012 | 0.0015 | ±0.45%  | 979979  |
| bunyan node stream  | 515,100.34    | 0.0016 | 2.7677  | 0.0019 | 0.0018 | 0.0032 | 0.0036 | 0.0073 | ±2.00%  | 257551  |
| winston node stream | 549,091.82    | 0.0011 | 40.5901 | 0.0018 | 0.0013 | 0.0027 | 0.0032 | 0.0067 | ±18.60% | 282351  |
| pino destination    | 1,911,173.56  | 0.0003 | 12.5170 | 0.0005 | 0.0003 | 0.0007 | 0.0009 | 0.0013 | ±17.12% | 960745  |
| pino node stream    | 1,287,182.89  | 0.0005 | 3.2815  | 0.0008 | 0.0006 | 0.0036 | 0.0040 | 0.0080 | ±3.92%  | 643594  |
| pino min length     | 1,940,377.58  | 0.0003 | 11.0352 | 0.0005 | 0.0003 | 0.0007 | 0.0009 | 0.0013 | ±15.66% | 970189  |
| ogma logger         | 991,721.31    | 0.0008 | 3.6747  | 0.0010 | 0.0009 | 0.0024 | 0.0026 | 0.0055 | ±3.49%  | 495863  |
| ogma json logger    | 1,080,907.16  | 0.0005 | 5.2984  | 0.0009 | 0.0007 | 0.0033 | 0.0042 | 0.0317 | ±3.99%  | 540454  |
| diary               | 12,303,855.06 | 0.0001 | 0.6664  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0005 | ±0.40%  | 6151928 |
| signale             | 1,997,379.11  | 0.0003 | 9.7696  | 0.0005 | 0.0004 | 0.0020 | 0.0023 | 0.0052 | ±6.93%  | 998690  |

### object logging

| Name                | Hz            | Min    | Max     | Mean   | P75    | P99    | P995   | P999   | RME     | Samples |
| ------------------- | ------------- | ------ | ------- | ------ | ------ | ------ | ------ | ------ | ------- | ------- |
| pail server         | 11,995,458.63 | 0.0001 | 6.2126  | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0014 | ±2.92%  | 5997730 |
| pail browser        | 1,005,922.88  | 0.0008 | 0.3350  | 0.0010 | 0.0009 | 0.0019 | 0.0020 | 0.0035 | ±0.31%  | 502962  |
| consola server      | 11,435,290.99 | 0.0001 | 14.6777 | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0010 | ±5.78%  | 5717646 |
| consola browser     | 10,223,817.51 | 0.0001 | 0.4148  | 0.0001 | 0.0001 | 0.0003 | 0.0004 | 0.0009 | ±0.58%  | 5111909 |
| tslog               | 1,310,861.02  | 0.0006 | 0.3236  | 0.0008 | 0.0007 | 0.0014 | 0.0016 | 0.0032 | ±0.48%  | 655431  |
| bunyan node stream  | 480,079.65    | 0.0018 | 2.6082  | 0.0021 | 0.0019 | 0.0039 | 0.0052 | 0.0084 | ±2.31%  | 240041  |
| winston node stream | 497,116.73    | 0.0012 | 34.2847 | 0.0020 | 0.0014 | 0.0033 | 0.0045 | 0.0088 | ±17.74% | 248559  |
| pino destination    | 1,790,703.38  | 0.0003 | 10.6995 | 0.0006 | 0.0004 | 0.0008 | 0.0010 | 0.0014 | ±16.05% | 903531  |
| pino node stream    | 1,211,612.89  | 0.0006 | 3.6969  | 0.0008 | 0.0007 | 0.0037 | 0.0041 | 0.0083 | ±3.89%  | 605807  |
| pino min length     | 1,754,440.93  | 0.0003 | 13.2331 | 0.0006 | 0.0004 | 0.0009 | 0.0011 | 0.0018 | ±15.29% | 882484  |
| ogma logger         | 614,664.93    | 0.0012 | 3.5153  | 0.0016 | 0.0015 | 0.0033 | 0.0045 | 0.0108 | ±2.98%  | 307333  |
| ogma json logger    | 660,522.86    | 0.0009 | 3.3039  | 0.0015 | 0.0013 | 0.0052 | 0.0071 | 0.0322 | ±2.88%  | 330262  |
| diary               | 12,191,949.54 | 0.0001 | 1.0866  | 0.0001 | 0.0001 | 0.0002 | 0.0002 | 0.0007 | ±0.53%  | 6095975 |

### deep object logging

| Name                | Hz            | Min    | Max     | Mean   | P75    | P99    | P995   | P999    | RME     | Samples |
| ------------------- | ------------- | ------ | ------- | ------ | ------ | ------ | ------ | ------- | ------- | ------- |
| pail server         | 12,387,823.75 | 0.0001 | 9.0259  | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0014  | ±4.03%  | 6193912 |
| pail browser        | 114,466.72    | 0.0077 | 0.6090  | 0.0087 | 0.0085 | 0.0143 | 0.0164 | 0.0442  | ±0.40%  | 57234   |
| consola server      | 12,380,250.91 | 0.0001 | 0.3265  | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0014  | ±0.48%  | 6190126 |
| consola browser     | 12,893,958.66 | 0.0001 | 0.2711  | 0.0001 | 0.0001 | 0.0001 | 0.0002 | 0.0007  | ±0.45%  | 6446980 |
| tslog               | 46,758.80     | 0.0191 | 0.3404  | 0.0214 | 0.0207 | 0.0377 | 0.0403 | 0.1848  | ±0.52%  | 23380   |
| bunyan node stream  | 86,254.19     | 0.0105 | 0.7543  | 0.0116 | 0.0113 | 0.0189 | 0.0208 | 0.0391  | ±0.39%  | 43128   |
| winston node stream | 19,012.20     | 0.0259 | 23.7780 | 0.0526 | 0.0335 | 0.0908 | 0.1110 | 12.5720 | ±18.96% | 10000   |
| pino destination    | 79,177.29     | 0.0081 | 11.5115 | 0.0126 | 0.0093 | 0.0160 | 0.0176 | 0.0409  | ±13.83% | 39589   |
| pino node stream    | 51,440.48     | 0.0134 | 10.1162 | 0.0194 | 0.0177 | 0.0507 | 0.0592 | 0.1073  | ±4.51%  | 25721   |
| pino min length     | 80,469.28     | 0.0082 | 10.2504 | 0.0124 | 0.0094 | 0.0163 | 0.0184 | 0.0439  | ±12.52% | 40235   |
| ogma logger         | 22,845.44     | 0.0301 | 11.9149 | 0.0438 | 0.0460 | 0.0998 | 0.1123 | 0.1784  | ±4.94%  | 11423   |
| ogma json logger    | 28,832.74     | 0.0264 | 11.4514 | 0.0347 | 0.0323 | 0.0784 | 0.0842 | 0.1073  | ±4.70%  | 14417   |
| diary               | 10,791,310.62 | 0.0001 | 1.0526  | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0008  | ±0.71%  | 5395656 |

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
| pail server         | 12,143,473.71 | 0.0001 | 9.7162  | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0016 | ±3.81%  | 6071737 |
| pail browser        | 203,227.89    | 0.0043 | 0.4759  | 0.0049 | 0.0048 | 0.0079 | 0.0086 | 0.0165 | ±0.35%  | 101614  |
| consola server      | 12,866,464.00 | 0.0001 | 0.3174  | 0.0001 | 0.0001 | 0.0002 | 0.0002 | 0.0007 | ±0.45%  | 6433232 |
| consola browser     | 10,939,554.23 | 0.0001 | 8.8005  | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0009 | ±3.49%  | 5469778 |
| tslog               | 1,966,781.44  | 0.0004 | 0.2828  | 0.0005 | 0.0005 | 0.0011 | 0.0012 | 0.0016 | ±0.42%  | 983391  |
| bunyan node stream  | 61,918.94     | 0.0128 | 4.2729  | 0.0162 | 0.0158 | 0.0268 | 0.0367 | 0.0929 | ±2.04%  | 30960   |
| winston node stream | 70,904.31     | 0.0096 | 8.3007  | 0.0141 | 0.0126 | 0.0230 | 0.0307 | 0.1053 | ±6.76%  | 35536   |
| pino destination    | 174,752.91    | 0.0037 | 8.4652  | 0.0057 | 0.0041 | 0.0070 | 0.0078 | 0.0169 | ±12.50% | 87666   |
| pino node stream    | 90,760.62     | 0.0088 | 7.1395  | 0.0110 | 0.0100 | 0.0227 | 0.0263 | 0.0898 | ±4.08%  | 45381   |
| pino min length     | 175,657.49    | 0.0036 | 12.4916 | 0.0057 | 0.0041 | 0.0070 | 0.0077 | 0.0134 | ±12.73% | 87829   |
| ogma logger         | 152,555.59    | 0.0044 | 9.9806  | 0.0066 | 0.0059 | 0.0120 | 0.0148 | 0.0641 | ±6.48%  | 76301   |
| ogma json logger    | 80,878.13     | 0.0089 | 5.4549  | 0.0124 | 0.0118 | 0.0214 | 0.0288 | 0.0932 | ±4.45%  | 40440   |
| diary               | 11,633,766.74 | 0.0001 | 1.0682  | 0.0001 | 0.0001 | 0.0002 | 0.0003 | 0.0006 | ±0.58%  | 5816884 |
