/** @jsxImportSource preact */
import type { Attributes, JSX } from "preact";

import type { ComponentType } from "./types";

// =============================================================================
// Wireframe Skeleton Renderers
// =============================================================================
//
// Each component type gets a skeleton wireframe that scales to the given dimensions.
// Uses inline styles referencing CSS custom properties from the layout mode overlay.

type SkeletonProps = { height: number; text?: string; width: number };

const Bar = ({ h = 3, strong, w }: Readonly<Attributes & { h?: number; strong?: boolean; w: number | string }>): JSX.Element => (
    <div
      style={{
          background: strong ? "var(--agd-bar-strong)" : "var(--agd-bar)",
          borderRadius: 2,
          flexShrink: 0,
          height: h,
          width: typeof w === "number" ? `${w}px` : w,
      }}
    />
);

const Block = ({
    h,
    radius = 3,
    style,
    w,
}: Readonly<Attributes & {
    h: number | string;
    radius?: number;
    style?: JSX.CSSProperties;
    w: number | string;
}>): JSX.Element => (
    <div
      style={{
          background: "var(--agd-fill)",
          border: "1px dashed var(--agd-stroke)",
          borderRadius: radius,
          flexShrink: 0,
          height: typeof h === "number" ? `${h}px` : h,
          width: typeof w === "number" ? `${w}px` : w,
          // eslint-disable-next-line @typescript-eslint/no-misused-spread -- JSX.CSSProperties is a plain object record
          ...style,
      }}
    />
);

const Circle = ({ size }: Readonly<Attributes & { size: number }>): JSX.Element => (
    <div
      style={{
          background: "var(--agd-fill)",
          border: "1px dashed var(--agd-stroke)",
          borderRadius: "50%",
          flexShrink: 0,
          height: size,
          width: size,
      }}
    />
);

// --- Skeleton renderers per type ---

const NavigationSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const pad = Math.max(8, height * 0.2);

    return (
    <div style={{ alignItems: "center", display: "flex", gap: width * 0.02, height: "100%", padding: `0 ${pad}px` }}>
      <Block h={Math.max(12, height * 0.4)} radius={2} w={Math.max(20, height * 0.5)} />
      <div style={{ display: "flex", flex: 1, gap: width * 0.03, marginLeft: width * 0.04 }}>
        <Bar w={width * 0.06} />
        <Bar w={width * 0.07} />
        <Bar w={width * 0.05} />
        <Bar w={width * 0.06} />
      </div>
      <Block h={Math.min(28, height * 0.5)} radius={4} w={width * 0.1} />
    </div>
    );
};

const HeroSkeleton = ({ height, text, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: height * 0.05, height: "100%", justifyContent: "center" }}>
      {text ? (
        <span style={{ color: "var(--agd-text-3)", fontSize: Math.min(20, height * 0.08), fontWeight: 600, maxWidth: "80%", textAlign: "center" }}>{text}</span>
      ) : (
        <Bar h={Math.max(6, height * 0.04)} strong w={width * 0.5} />
      )}
      <Bar w={width * 0.6} />
      <Bar w={width * 0.4} />
      <Block h={Math.min(36, height * 0.12)} radius={6} style={{ marginTop: height * 0.06 }} w={Math.min(140, width * 0.2)} />
    </div>
);

const SidebarSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const items = Math.max(3, Math.floor(height / 36));

    return (
    <div style={{ display: "flex", flexDirection: "column", gap: height * 0.03, padding: width * 0.08 }}>
      <Bar h={4} strong w={width * 0.6} />
      {Array.from({ length: items }, (_, i) => (
        <div key={i} style={{ alignItems: "center", display: "flex", gap: 6 }}>
          <Block h={10} radius={2} w={10} />
          <Bar w={width * (0.4 + ((i * 17) % 30) / 100)} />
        </div>
      ))}
    </div>
    );
};

const FooterSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const cols = Math.max(2, Math.min(4, Math.floor(width / 160)));

    return (
    <div style={{ display: "flex", gap: width * 0.05, padding: `${height * 0.12}px ${width * 0.03}px` }}>
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} style={{ display: "flex", flex: 1, flexDirection: "column", gap: 4 }}>
          <Bar h={3} strong w="60%" />
          <Bar h={2} w="80%" />
          <Bar h={2} w="70%" />
          <Bar h={2} w="60%" />
        </div>
      ))}
    </div>
    );
};

const ModalSkeleton = ({ width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ alignItems: "center", borderBottom: "1px solid var(--agd-stroke)", display: "flex", justifyContent: "space-between", padding: "10px 12px" }}>
        <Bar h={4} strong w={width * 0.3} />
        <div style={{ border: "1px solid var(--agd-stroke)", borderRadius: 3, height: 14, width: 14 }} />
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 6, padding: 12 }}>
        <Bar w="90%" />
        <Bar w="70%" />
        <Bar w="80%" />
      </div>
      <div style={{ borderTop: "1px solid var(--agd-stroke)", display: "flex", gap: 8, justifyContent: "flex-end", padding: "10px 12px" }}>
        <Block h={26} radius={4} w={70} />
        <Block h={26} radius={4} style={{ background: "var(--agd-bar)" }} w={70} />
      </div>
    </div>
);

const CardSkeleton = (_props: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: "var(--agd-fill)", borderBottom: "1px dashed var(--agd-stroke)", height: "40%" }} />
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 5, padding: 10 }}>
        <Bar h={4} strong w="70%" />
        <Bar h={2} w="95%" />
        <Bar h={2} w="85%" />
        <Bar h={2} w="50%" />
      </div>
    </div>
);

const TextSkeleton = ({ height, text, width }: Readonly<SkeletonProps>): JSX.Element => {
    if (text) {
        return (
      <div style={{ color: "var(--agd-text-3)", fontSize: Math.min(14, height * 0.3), lineHeight: 1.5, overflow: "hidden", padding: 4, wordBreak: "break-word" }}>
        {text}
      </div>
        );
    }

    const lines = Math.max(2, Math.floor(height / 18));

    return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 4 }}>
      <Bar h={5} strong w={width * 0.6} />
      {Array.from({ length: lines }, (_, i) => (
        <Bar h={2} key={i} w={`${70 + ((i * 13) % 25)}%`} />
      ))}
    </div>
    );
};

const ImageSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ height: "100%", position: "relative" }}>
      <svg fill="none" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} width="100%">
        <line stroke="var(--agd-stroke)" strokeWidth="1" x1="0" x2={width} y1="0" y2={height} />
        <line stroke="var(--agd-stroke)" strokeWidth="1" x1={width} x2="0" y1="0" y2={height} />
        <circle cx={width * 0.3} cy={height * 0.3} fill="var(--agd-fill)" r={Math.min(width, height) * 0.08} stroke="var(--agd-stroke)" strokeWidth="0.8" />
      </svg>
    </div>
);

const TableSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const cols = Math.max(2, Math.min(5, Math.floor(width / 100)));
    const rows = Math.max(2, Math.min(6, Math.floor(height / 32)));

    return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ borderBottom: "1px solid var(--agd-stroke)", display: "flex", padding: "6px 0" }}>
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} style={{ flex: 1, padding: "0 8px" }}><Bar h={3} strong w="70%" /></div>
        ))}
      </div>
      {Array.from({ length: rows }, (_outer, r) => (
        <div key={r} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", padding: "6px 0" }}>
          {Array.from({ length: cols }, (_inner, c) => (
            <div key={c} style={{ flex: 1, padding: "0 8px" }}><Bar h={2} w={`${50 + ((r * 7 + c * 13) % 40)}%`} /></div>
          ))}
        </div>
      ))}
    </div>
    );
};

const ListSkeleton = ({ height }: Readonly<SkeletonProps>): JSX.Element => {
    const items = Math.max(2, Math.floor(height / 28));

    return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 4 }}>
      {Array.from({ length: items }, (_, i) => (
        <div key={i} style={{ alignItems: "center", display: "flex", gap: 8, padding: "4px 0" }}>
          <Circle size={8} />
          <Bar h={2} w={`${55 + ((i * 17) % 35)}%`} />
        </div>
      ))}
    </div>
    );
};

const ButtonSkeleton = ({ height, text, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{
        alignItems: "center",
        background: "var(--agd-fill)",
        border: "1px solid var(--agd-stroke)",
        borderRadius: Math.min(8, height / 3),
        display: "flex",
        height: "100%",
        justifyContent: "center",
    }}>
      {text ? (
        <span style={{ color: "var(--agd-text-3)", fontSize: Math.min(13, height * 0.4), fontWeight: 500, letterSpacing: "-0.01em" }}>{text}</span>
      ) : (
        <Bar h={3} strong w={Math.max(20, width * 0.5)} />
      )}
    </div>
);

const InputSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, height: "100%", justifyContent: "center" }}>
      <Bar h={2} w={Math.min(80, width * 0.3)} />
      <div style={{
          alignItems: "center",
          background: "var(--agd-fill)",
          border: "1px dashed var(--agd-stroke)",
          borderRadius: 4,
          display: "flex",
          height: Math.min(36, height * 0.6),
          paddingLeft: 8,
      }}>
        <Bar h={2} w="40%" />
      </div>
    </div>
);

const FormSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const fields = Math.max(2, Math.min(5, Math.floor(height / 56)));

    return (
    <div style={{ display: "flex", flexDirection: "column", gap: height * 0.04, padding: 8 }}>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Bar h={2} w={60 + ((i * 17) % 30)} />
          <Block h={28} radius={4} w="100%" />
        </div>
      ))}
      <Block h={30} radius={6} style={{ alignSelf: "flex-end", background: "var(--agd-bar)", marginTop: 8 }} w={Math.min(120, width * 0.35)} />
    </div>
    );
};

const TabsSkeleton = ({ width }: Readonly<SkeletonProps>): JSX.Element => {
    const tabCount = Math.max(2, Math.min(4, Math.floor(width / 120)));

    return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ borderBottom: "1px solid var(--agd-stroke)", display: "flex", gap: 2 }}>
        {Array.from({ length: tabCount }, (_, i) => (
          <div key={i} style={{ borderBottom: i === 0 ? "2px solid var(--agd-bar-strong)" : "none", padding: "8px 12px" }}>
            <Bar h={3} strong={i === 0} w={60} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 6, padding: 12 }}>
        <Bar h={2} w="80%" />
        <Bar h={2} w="65%" />
        <Bar h={2} w="75%" />
      </div>
    </div>
    );
};

const AvatarSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const r = Math.min(width, height) / 2;

    return (
    <svg fill="none" height="100%" viewBox={`0 0 ${width} ${height}`} width="100%">
      <circle cx={width / 2} cy={height / 2} fill="var(--agd-fill)" r={r - 1} stroke="var(--agd-stroke)" strokeDasharray="3 2" strokeWidth="1.5" />
      <circle cx={width / 2} cy={height * 0.38} fill="var(--agd-fill)" r={r * 0.28} stroke="var(--agd-stroke)" strokeWidth="0.8" />
      <path
        d={`M${width / 2 - r * 0.55} ${height * 0.78} C${width / 2 - r * 0.55} ${height * 0.55} ${width / 2 + r * 0.55} ${height * 0.55} ${width / 2 + r * 0.55} ${height * 0.78}`}
        fill="var(--agd-fill)"
        stroke="var(--agd-stroke)"
        strokeWidth="0.8"
      />
    </svg>
    );
};

const BadgeSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{
        alignItems: "center",
        background: "var(--agd-fill)",
        border: "1px solid var(--agd-stroke)",
        borderRadius: height / 2,
        display: "flex",
        height: "100%",
        justifyContent: "center",
    }}>
      <Bar h={2} strong w={Math.max(16, width * 0.5)} />
    </div>
);

const HeaderSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: height * 0.08, height: "100%", justifyContent: "center" }}>
      <Bar h={Math.max(5, height * 0.06)} strong w={width * 0.5} />
      <Bar w={width * 0.35} />
    </div>
);

const SectionSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ display: "flex", flexDirection: "column", gap: height * 0.04, height: "100%", padding: width * 0.04 }}>
      <Bar h={4} strong w={width * 0.3} />
      <Bar w={width * 0.7} />
      <Bar w={width * 0.5} />
      <div style={{ display: "flex", flex: 1, gap: width * 0.03, marginTop: height * 0.06 }}>
        <Block h="100%" radius={4} w="33%" />
        <Block h="100%" radius={4} w="33%" />
        <Block h="100%" radius={4} w="33%" />
      </div>
    </div>
);

const GridSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const cols = Math.max(2, Math.min(4, Math.floor(width / 140)));
    const rows = Math.max(1, Math.min(3, Math.floor(height / 120)));

    return (
    <div style={{ display: "grid", gap: 6, gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, height: "100%" }}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <Block h="100%" key={i} radius={4} w="100%" />
      ))}
    </div>
    );
};

const DropdownSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const items = Math.max(2, Math.floor((height - 32) / 28));

    return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ borderBottom: "1px solid var(--agd-stroke)", padding: "6px 8px" }}>
        <Bar h={3} strong w={width * 0.5} />
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, padding: 4 }}>
        {Array.from({ length: items }, (_, i) => (
          <div key={i} style={{ background: i === 0 ? "var(--agd-fill)" : "transparent", borderRadius: 3, padding: "4px 6px" }}>
            <Bar h={2} strong={i === 0} w={`${50 + ((i * 17) % 35)}%`} />
          </div>
        ))}
      </div>
    </div>
    );
};

const ToggleSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const r = Math.min(width, height) / 2;

    return (
    <svg fill="none" height="100%" viewBox={`0 0 ${width} ${height}`} width="100%">
      <rect height={height - 2} rx={r} stroke="var(--agd-stroke)" strokeWidth="1" width={width - 2} x="1" y="1" />
      <circle cx={width - r} cy={height / 2} fill="var(--agd-bar)" r={r * 0.7} />
    </svg>
    );
};

const SearchSkeleton = ({ height }: Readonly<SkeletonProps>): JSX.Element => {
    const r = Math.min(height / 2, 20);

    return (
    <div style={{ alignItems: "center", background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderRadius: r, display: "flex", gap: 6, height: "100%", padding: `0 ${r * 0.6}px` }}>
      <Circle size={Math.min(14, height * 0.4)} />
      <Bar h={2} w="50%" />
    </div>
    );
};

const ToastSkeleton = ({ height }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderRadius: 8, display: "flex", gap: 8, height: "100%", padding: "0 10px" }}>
      <Circle size={Math.min(20, height * 0.5)} />
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 3 }}>
        <Bar h={3} strong w="60%" />
        <Bar h={2} w="80%" />
      </div>
      <div style={{ border: "1px solid var(--agd-stroke)", borderRadius: 3, flexShrink: 0, height: 14, width: 14 }} />
    </div>
);

const ProgressSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <svg fill="none" height="100%" viewBox={`0 0 ${width} ${height}`} width="100%">
      <rect height={height} rx={height / 2} stroke="var(--agd-stroke)" strokeWidth="0.8" width={width} x="0" y="0" />
      <rect fill="var(--agd-bar)" height={height - 2} rx={(height - 2) / 2} width={width * 0.65} x="1" y="1" />
    </svg>
);

const ChartSkeleton = ({ width }: Readonly<SkeletonProps>): JSX.Element => {
    const bars = Math.max(3, Math.min(7, Math.floor(width / 50)));
    const barW = width / (bars * 2);

    return (
    <div style={{ alignItems: "flex-end", borderBottom: "1px solid var(--agd-stroke)", display: "flex", height: "100%", justifyContent: "space-around", padding: "0 4px" }}>
      {Array.from({ length: bars }, (_, i) => {
          const h = 30 + ((i * 37 + 17) % 55);

          return <Block h={`${h}%`} key={i} radius={2} w={barW} />;
      })}
    </div>
    );
};

const VideoSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const btnR = Math.min(width, height) * 0.12;

    return (
    <div style={{ alignItems: "center", display: "flex", height: "100%", justifyContent: "center", position: "relative" }}>
      <Block h="100%" radius={4} w="100%" />
      <div style={{ alignItems: "center", background: "var(--agd-fill)", border: "1.5px solid var(--agd-stroke)", borderRadius: "50%", display: "flex", height: btnR * 2, justifyContent: "center", position: "absolute", width: btnR * 2 }}>
        <div style={{ borderBottom: `${btnR * 0.4}px solid transparent`, borderLeft: `${btnR * 0.6}px solid var(--agd-bar-strong)`, borderTop: `${btnR * 0.4}px solid transparent`, height: 0, marginLeft: btnR * 0.15, width: 0 }} />
      </div>
    </div>
    );
};

const TooltipSkeleton = (_props: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ alignItems: "center", background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderRadius: 6, display: "flex", flex: 1, justifyContent: "center", width: "100%" }}>
        <Bar h={2} w="60%" />
      </div>
      <div style={{ background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderLeft: "none", borderTop: "none", height: 8, marginTop: -5, transform: "rotate(45deg)", width: 8 }} />
    </div>
);

const BreadcrumbSkeleton = ({ width }: Readonly<SkeletonProps>): JSX.Element => {
    const items = Math.max(2, Math.min(4, Math.floor(width / 80)));

    return (
    <div style={{ alignItems: "center", display: "flex", gap: 4, height: "100%" }}>
      {Array.from({ length: items }, (_, i) => (
        <div key={i} style={{ alignItems: "center", display: "flex", gap: 4 }}>
          {i > 0 && <span style={{ color: "var(--agd-stroke)", fontSize: 10 }}>/</span>}
          <Bar h={2} strong={i === items - 1} w={40 + ((i * 13) % 20)} />
        </div>
      ))}
    </div>
    );
};

const PaginationSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const count = Math.max(3, Math.min(5, Math.floor(width / 40)));
    const sz = Math.min(28, height * 0.8);

    return (
    <div style={{ alignItems: "center", display: "flex", gap: 4, height: "100%", justifyContent: "center" }}>
      {Array.from({ length: count }, (_, i) => (
        <Block h={sz} key={i} radius={4} style={i === 1 ? { background: "var(--agd-bar)" } : undefined} w={sz} />
      ))}
    </div>
    );
};

const DividerSkeleton = (_props: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", display: "flex", height: "100%" }}>
      <div style={{ background: "var(--agd-stroke)", height: 1, width: "100%" }} />
    </div>
);

const AccordionSkeleton = ({ height }: Readonly<SkeletonProps>): JSX.Element => {
    const items = Math.max(2, Math.min(4, Math.floor(height / 40)));

    return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {Array.from({ length: items }, (_, i) => (
        <div key={i} style={{ alignItems: "center", borderBottom: "1px solid var(--agd-stroke)", display: "flex", flex: i === 0 ? 2 : 1, justifyContent: "space-between", padding: "8px 6px" }}>
          <Bar h={3} strong w={`${40 + ((i * 17) % 25)}%`} />
          <span style={{ color: "var(--agd-stroke)", fontSize: 8 }}>{i === 0 ? "▼" : "▶"}</span>
        </div>
      ))}
    </div>
    );
};

const CarouselSkeleton = (_props: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%" }}>
      <div style={{ alignItems: "center", display: "flex", flex: 1, gap: 6 }}>
        <span style={{ color: "var(--agd-stroke)", fontSize: 12 }}>‹</span>
        <Block h="100%" radius={4} w="100%" />
        <span style={{ color: "var(--agd-stroke)", fontSize: 12 }}>›</span>
      </div>
      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
        <Circle size={5} />
        <Circle size={5} />
        <Circle size={5} />
      </div>
    </div>
);

const PricingSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: height * 0.04, height: "100%", padding: 10 }}>
      <Bar h={3} strong w={width * 0.4} />
      <Bar h={6} strong w={width * 0.3} />
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 4, padding: "8px 0", width: "100%" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ alignItems: "center", display: "flex", gap: 4 }}>
            <Circle size={5} />
            <Bar h={2} w={`${50 + ((i * 17) % 35)}%`} />
          </div>
        ))}
      </div>
      <Block h={Math.min(32, height * 0.1)} radius={6} style={{ background: "var(--agd-bar)" }} w={width * 0.7} />
    </div>
);

const TestimonialSkeleton = (_props: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%", padding: 10 }}>
      <span style={{ color: "var(--agd-stroke)", fontFamily: "serif", fontSize: 18, lineHeight: 1 }}>&ldquo;</span>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 4 }}>
        <Bar h={2} w="90%" />
        <Bar h={2} w="75%" />
        <Bar h={2} w="60%" />
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: 6 }}>
        <Circle size={20} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Bar h={3} strong w={60} />
          <Bar h={2} w={40} />
        </div>
      </div>
    </div>
);

const CtaSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: height * 0.08, height: "100%", justifyContent: "center" }}>
      <Bar h={Math.max(4, height * 0.05)} strong w={width * 0.5} />
      <Bar w={width * 0.35} />
      <Block h={Math.min(32, height * 0.15)} radius={6} style={{ background: "var(--agd-bar)", marginTop: height * 0.04 }} w={Math.min(140, width * 0.25)} />
    </div>
);

const AlertSkeleton = (_props: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderRadius: 6, display: "flex", gap: 8, height: "100%", padding: "0 10px" }}>
      <div style={{ alignItems: "center", border: "1.5px solid var(--agd-bar-strong)", borderRadius: "50%", display: "flex", flexShrink: 0, height: 16, justifyContent: "center", width: 16 }}>
        <div style={{ background: "var(--agd-bar-strong)", borderRadius: 1, height: 6, width: 2 }} />
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 3 }}>
        <Bar h={3} strong w="40%" />
        <Bar h={2} w="70%" />
      </div>
    </div>
);

const BannerSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", background: "var(--agd-fill)", display: "flex", gap: 8, height: "100%", justifyContent: "center", padding: "0 12px" }}>
      <Bar h={3} strong w={width * 0.4} />
      <Block h={Math.min(24, height * 0.6)} radius={4} w={60} />
    </div>
);

const StatSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: height * 0.06, height: "100%", justifyContent: "center" }}>
      <Bar h={2} w={width * 0.5} />
      <Bar h={Math.max(8, height * 0.18)} strong w={width * 0.4} />
      <Bar h={2} w={width * 0.3} />
    </div>
);

const StepperSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const steps = Math.max(3, Math.min(5, Math.floor(width / 100)));
    const dotR = Math.min(12, height * 0.35);

    return (
    <div style={{ alignItems: "center", display: "flex", height: "100%", justifyContent: "space-between", padding: "0 8px" }}>
      {Array.from({ length: steps }, (_, i) => (
        <div key={i} style={{ alignItems: "center", display: "flex", flex: 1, gap: 0 }}>
          <div style={{ background: i === 0 ? "var(--agd-bar)" : "transparent", border: "1.5px solid var(--agd-stroke)", borderRadius: "50%", flexShrink: 0, height: dotR, width: dotR }} />
          {i < steps - 1 && <div style={{ background: "var(--agd-stroke)", flex: 1, height: 1, margin: "0 4px" }} />}
        </div>
      ))}
    </div>
    );
};

const TagSkeleton = ({ width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", background: "var(--agd-fill)", border: "1px solid var(--agd-stroke)", borderRadius: 4, display: "flex", gap: 4, height: "100%", justifyContent: "center", padding: "0 6px" }}>
      <Bar h={2} strong w={Math.max(16, width * 0.5)} />
      <div style={{ border: "1px solid var(--agd-stroke)", borderRadius: "50%", flexShrink: 0, height: 8, width: 8 }} />
    </div>
);

const RatingSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const stars = 5;
    const sz = Math.min(height * 0.7, width / (stars * 1.5));

    return (
    <div style={{ alignItems: "center", display: "flex", gap: sz * 0.2, height: "100%", justifyContent: "center" }}>
      {Array.from({ length: stars }, (_, i) => (
        <svg fill="none" height={sz} key={i} viewBox="0 0 16 16" width={sz}>
          <path d="M8 1.5l2 4 4.5.7-3.25 3.1.75 4.5L8 11.4l-4 2.4.75-4.5L1.5 6.2 6 5.5z" fill={i < 3 ? "var(--agd-bar)" : "none"} stroke="var(--agd-stroke)" strokeWidth="0.8" />
        </svg>
      ))}
    </div>
    );
};

const MapSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderRadius: 4, height: "100%", overflow: "hidden", position: "relative" }}>
      <svg fill="none" height="100%" style={{ inset: 0, position: "absolute" }} viewBox={`0 0 ${width} ${height}`} width="100%">
        <line opacity=".2" stroke="var(--agd-stroke)" strokeWidth="0.5" x1={0} x2={width} y1={height * 0.3} y2={height * 0.7} />
        <line opacity=".15" stroke="var(--agd-stroke)" strokeWidth="0.5" x1={0} x2={width} y1={height * 0.6} y2={height * 0.2} />
        <line opacity=".15" stroke="var(--agd-stroke)" strokeWidth="0.5" x1={width * 0.4} x2={width * 0.6} y1={0} y2={height} />
      </svg>
      <div style={{ left: "50%", position: "absolute", top: "40%", transform: "translate(-50%, -100%)" }}>
        <svg fill="none" height="22" viewBox="0 0 16 22" width="16">
          <path d="M8 0C3.6 0 0 3.6 0 8c0 6 8 14 8 14s8-8 8-14c0-4.4-3.6-8-8-8z" fill="var(--agd-bar)" opacity=".4" />
          <circle cx="8" cy="8" fill="var(--agd-fill)" r="3" />
        </svg>
      </div>
    </div>
);

const TimelineSkeleton = ({ height }: Readonly<SkeletonProps>): JSX.Element => {
    const items = Math.max(3, Math.min(5, Math.floor(height / 60)));

    return (
    <div style={{ display: "flex", height: "100%", padding: "8px 0" }}>
      <div style={{ alignItems: "center", display: "flex", flexDirection: "column", width: 16 }}>
        {Array.from({ length: items }, (_, i) => (
          <div key={i} style={{ alignItems: "center", display: "flex", flex: 1, flexDirection: "column" }}>
            <Circle size={8} />
            {i < items - 1 && <div style={{ background: "var(--agd-stroke)", flex: 1, width: 1 }} />}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-around", paddingLeft: 8 }}>
        {Array.from({ length: items }, (_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Bar h={3} strong w={`${35 + ((i * 13) % 25)}%`} />
            <Bar h={2} w={`${50 + ((i * 17) % 30)}%`} />
          </div>
        ))}
      </div>
    </div>
    );
};

const FileUploadSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", border: "2px dashed var(--agd-stroke)", borderRadius: 8, display: "flex", flexDirection: "column", gap: height * 0.06, height: "100%", justifyContent: "center" }}>
      <svg fill="none" height="24" viewBox="0 0 24 24" width="24">
        <path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="var(--agd-stroke)" strokeWidth="1.5" />
        <path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" stroke="var(--agd-stroke)" strokeWidth="1.5" />
      </svg>
      <Bar h={2} w={width * 0.4} />
      <Bar h={2} w={width * 0.25} />
    </div>
);

const CodeBlockSkeleton = ({ height }: Readonly<SkeletonProps>): JSX.Element => {
    const lines = Math.max(3, Math.min(8, Math.floor(height / 20)));

    return (
    <div style={{ background: "var(--agd-fill)", border: "1px solid var(--agd-stroke)", borderRadius: 6, display: "flex", flexDirection: "column", gap: 4, height: "100%", padding: 8 }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
        <Circle size={6} />
        <Circle size={6} />
        <Circle size={6} />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 6, paddingLeft: ((i > 0 && i < lines - 1) ? 12 : 0) }}>
          <Bar h={2} strong={i === 0} w={`${25 + ((i * 23) % 50)}%`} />
        </div>
      ))}
    </div>
    );
};

const CalendarSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const cols = 7;
    const rows = 5;
    const cellSz = Math.min((width - 16) / cols, (height - 40) / (rows + 1));

    return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", padding: "6px 8px" }}>
        <span style={{ color: "var(--agd-stroke)", fontSize: 8 }}>‹</span>
        <Bar h={3} strong w={width * 0.3} />
        <span style={{ color: "var(--agd-stroke)", fontSize: 8 }}>›</span>
      </div>
      <div style={{ display: "grid", flex: 1, gap: 2, gridTemplateColumns: `repeat(${cols}, 1fr)`, padding: "0 4px" }}>
        {Array.from({ length: cols }, (_, i) => (
          <div key={`h${i}`} style={{ alignItems: "center", display: "flex", height: cellSz * 0.6, justifyContent: "center" }}>
            <Bar h={2} w={cellSz * 0.5} />
          </div>
        ))}
        {Array.from({ length: cols * rows }, (_, i) => (
          <div key={i} style={{ alignItems: "center", display: "flex", height: cellSz, justifyContent: "center" }}>
            <div style={{ alignItems: "center", background: i === 12 ? "var(--agd-bar)" : "transparent", borderRadius: "50%", display: "flex", height: cellSz * 0.6, justifyContent: "center", width: cellSz * 0.6 }}>
              <div style={{ background: "var(--agd-bar-strong)", borderRadius: 1, height: 2, opacity: i === 12 ? 1 : 0.3, width: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
    );
};

const NotificationSkeleton = ({ height }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderRadius: 8, display: "flex", gap: 8, height: "100%", padding: "0 10px" }}>
      <Circle size={Math.min(32, height * 0.55)} />
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 3 }}>
        <Bar h={3} strong w="50%" />
        <Bar h={2} w="75%" />
      </div>
      <Bar h={2} w={30} />
    </div>
);

const ProductCardSkeleton = ({ width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: "var(--agd-fill)", borderBottom: "1px dashed var(--agd-stroke)", height: "50%" }} />
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 5, padding: 10 }}>
        <Bar h={4} strong w="65%" />
        <Bar h={3} w="40%" />
        <div style={{ flex: 1 }} />
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
          <Bar h={5} strong w="30%" />
          <Block h={26} radius={4} style={{ background: "var(--agd-bar)" }} w={Math.min(70, width * 0.3)} />
        </div>
      </div>
    </div>
);

const ProfileSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const avatarSz = Math.min(48, height * 0.3);

    return (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: height * 0.06, height: "100%", justifyContent: "center" }}>
      <Circle size={avatarSz} />
      <Bar h={4} strong w={width * 0.45} />
      <Bar h={2} w={width * 0.3} />
      <div style={{ display: "flex", gap: width * 0.08, marginTop: height * 0.04 }}>
        <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2 }}>
          <Bar h={3} strong w={20} />
          <Bar h={2} w={28} />
        </div>
        <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2 }}>
          <Bar h={3} strong w={20} />
          <Bar h={2} w={28} />
        </div>
        <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 2 }}>
          <Bar h={3} strong w={20} />
          <Bar h={2} w={28} />
        </div>
      </div>
    </div>
    );
};

const DrawerSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const panelW = Math.max(width * 0.6, 80);
    const items = Math.max(3, Math.floor(height / 40));

    return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ background: "var(--agd-fill)", opacity: 0.3, width: width - panelW }} />
      <div style={{ borderLeft: "1px solid var(--agd-stroke)", display: "flex", flex: 1, flexDirection: "column", padding: width * 0.04 }}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: height * 0.06 }}>
          <Bar h={4} strong w={panelW * 0.4} />
          <div style={{ border: "1px solid var(--agd-stroke)", borderRadius: 3, height: 12, width: 12 }} />
        </div>
        {Array.from({ length: items }, (_, i) => (
          <div key={i} style={{ padding: "6px 0" }}>
            <Bar h={2} strong={i === 0} w={`${50 + ((i * 17) % 35)}%`} />
          </div>
        ))}
      </div>
    </div>
    );
};

const PopoverSkeleton = (_props: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderRadius: 8, display: "flex", flex: 1, flexDirection: "column", gap: 5, padding: 10, width: "100%" }}>
        <Bar h={3} strong w="70%" />
        <Bar h={2} w="90%" />
        <Bar h={2} w="60%" />
      </div>
      <div style={{ background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderLeft: "none", borderTop: "none", height: 10, marginTop: -6, transform: "rotate(45deg)", width: 10 }} />
    </div>
);

const LogoSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const iconSz = Math.min(height * 0.7, width * 0.3);

    return (
    <div style={{ alignItems: "center", display: "flex", gap: width * 0.08, height: "100%" }}>
      <Block h={iconSz} radius={iconSz * 0.25} w={iconSz} />
      <Bar h={Math.max(4, height * 0.2)} strong w={width * 0.45} />
    </div>
    );
};

const FaqSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const items = Math.max(2, Math.min(5, Math.floor(height / 56)));

    return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {Array.from({ length: items }, (_, i) => (
        <div key={i} style={{ alignItems: "center", borderBottom: "1px solid var(--agd-stroke)", display: "flex", flex: i === 0 ? 2 : 1, justifyContent: "space-between", padding: "8px 6px" }}>
          <div style={{ alignItems: "center", display: "flex", gap: 6 }}>
            <span style={{ color: "var(--agd-stroke)", fontSize: 9, fontWeight: 700 }}>Q</span>
            <Bar h={3} strong w={width * (0.3 + ((i * 13) % 25) / 100)} />
          </div>
          <span style={{ color: "var(--agd-stroke)", fontSize: 8 }}>{i === 0 ? "▼" : "▶"}</span>
        </div>
      ))}
    </div>
    );
};

const GallerySkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const cols = Math.max(2, Math.min(4, Math.floor(width / 120)));
    const rows = Math.max(1, Math.min(3, Math.floor(height / 120)));

    return (
    <div style={{ display: "grid", gap: 4, gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, height: "100%" }}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <div key={i} style={{ background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
          <svg fill="none" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" width="100%">
            <line stroke="var(--agd-stroke)" strokeWidth="0.5" x1="0" x2="100" y1="0" y2="100" />
            <line stroke="var(--agd-stroke)" strokeWidth="0.5" x1="100" x2="0" y1="0" y2="100" />
          </svg>
        </div>
      ))}
    </div>
    );
};

const CheckboxSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const sz = Math.min(width, height);

    return (
    <svg fill="none" height="100%" viewBox={`0 0 ${width} ${height}`} width="100%">
      <rect height={sz - 2} rx={sz * 0.15} stroke="var(--agd-stroke)" strokeWidth="1.5" width={sz - 2} x="1" y={(height - sz + 2) / 2} />
      <path d={`M${sz * 0.25} ${height / 2}l${sz * 0.2} ${sz * 0.2} ${sz * 0.3}-${sz * 0.35}`} fill="none" stroke="var(--agd-bar)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
    );
};

const RadioSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const r = Math.min(width, height) / 2 - 1;

    return (
    <svg fill="none" height="100%" viewBox={`0 0 ${width} ${height}`} width="100%">
      <circle cx={width / 2} cy={height / 2} r={r} stroke="var(--agd-stroke)" strokeWidth="1.5" />
      <circle cx={width / 2} cy={height / 2} fill="var(--agd-bar)" r={r * 0.45} />
    </svg>
    );
};

const SliderSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const trackH = Math.max(2, height * 0.12);
    const thumbR = Math.min(height * 0.35, 10);
    const fillW = width * 0.55;

    return (
    <div style={{ alignItems: "center", display: "flex", height: "100%", position: "relative" }}>
      <div style={{ background: "var(--agd-fill)", border: "1px solid var(--agd-stroke)", borderRadius: trackH / 2, height: trackH, position: "relative", width: "100%" }}>
        <div style={{ background: "var(--agd-bar)", borderRadius: trackH / 2, height: "100%", width: fillW }} />
      </div>
      <div style={{ background: "var(--agd-fill)", border: "1.5px solid var(--agd-stroke)", borderRadius: "50%", height: thumbR * 2, left: fillW - thumbR, position: "absolute", width: thumbR * 2 }} />
    </div>
    );
};

const DatePickerSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const inputH = Math.min(36, height * 0.15);
    const cols = 7;
    const rows = 4;
    const cellSz = Math.min((width - 16) / cols, (height - inputH - 40) / (rows + 1));

    return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, height: "100%" }}>
      <div style={{ alignItems: "center", background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderRadius: 4, display: "flex", height: inputH, justifyContent: "space-between", padding: "0 8px" }}>
        <Bar h={2} w="40%" />
        <svg fill="none" height="12" viewBox="0 0 16 16" width="12"><rect height="11" rx="1" stroke="var(--agd-stroke)" strokeWidth="1" width="12" x="2" y="3" /><line stroke="var(--agd-stroke)" strokeWidth="0.5" x1="2" x2="14" y1="6" y2="6" /></svg>
      </div>
      <div style={{ background: "var(--agd-fill)", border: "1px dashed var(--agd-stroke)", borderRadius: 6, display: "flex", flex: 1, flexDirection: "column" }}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", padding: "4px 6px" }}>
          <span style={{ color: "var(--agd-stroke)", fontSize: 7 }}>‹</span>
          <Bar h={2} strong w={width * 0.25} />
          <span style={{ color: "var(--agd-stroke)", fontSize: 7 }}>›</span>
        </div>
        <div style={{ display: "grid", flex: 1, gap: 1, gridTemplateColumns: `repeat(${cols}, 1fr)`, padding: "0 4px" }}>
          {Array.from({ length: cols * rows }, (_, i) => (
            <div key={i} style={{ alignItems: "center", display: "flex", height: cellSz, justifyContent: "center" }}>
              <div style={{ background: i === 10 ? "var(--agd-bar)" : "transparent", borderRadius: "50%", height: cellSz * 0.5, width: cellSz * 0.5 }}>
                <div style={{ alignItems: "center", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
                  <div style={{ background: "var(--agd-bar-strong)", borderRadius: 1, height: 1.5, opacity: i === 10 ? 1 : 0.25, width: 1.5 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    );
};

const SkeletonSkeletonRenderer = ({ height }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ display: "flex", flexDirection: "column", gap: height * 0.08, height: "100%", padding: 4 }}>
      <div style={{ background: "var(--agd-fill)", borderRadius: 4, height: height * 0.2, width: "100%" }} />
      <div style={{ background: "var(--agd-fill)", borderRadius: 3, height: Math.max(6, height * 0.1), width: "70%" }} />
      <div style={{ background: "var(--agd-fill)", borderRadius: 3, height: Math.max(4, height * 0.06), width: "90%" }} />
      <div style={{ background: "var(--agd-fill)", borderRadius: 3, height: Math.max(4, height * 0.06), width: "50%" }} />
    </div>
);

const ChipSkeleton = ({ height }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ alignItems: "center", display: "flex", gap: 6, height: "100%" }}>
      <div style={{ alignItems: "center", background: "var(--agd-fill)", border: "1px solid var(--agd-stroke)", borderRadius: height / 2, display: "flex", flex: 1, gap: 4, height: "100%", padding: `0 ${height * 0.3}px` }}>
        <Bar h={2} strong w="60%" />
        <div style={{ border: "1px solid var(--agd-stroke)", borderRadius: "50%", flexShrink: 0, height: Math.max(6, height * 0.3), marginLeft: "auto", width: Math.max(6, height * 0.3) }} />
      </div>
    </div>
);

const IconSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const sz = Math.min(width, height);

    return (
    <svg fill="none" height="100%" viewBox={`0 0 ${width} ${height}`} width="100%">
      <path
        d={`M${width / 2} ${(height - sz) / 2 + sz * 0.1}l${sz * 0.12} ${sz * 0.25} ${sz * 0.28} ${sz * 0.04}-${sz * 0.2} ${sz * 0.2} ${sz * 0.05} ${sz * 0.28}-${sz * 0.25}-${sz * 0.12}-${sz * 0.25} ${sz * 0.12} ${sz * 0.05}-${sz * 0.28}-${sz * 0.2}-${sz * 0.2} ${sz * 0.28}-${sz * 0.04}z`}
        fill="var(--agd-fill)"
        stroke="var(--agd-stroke)"
        strokeWidth="1"
      />
    </svg>
    );
};

const SpinnerSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const r = Math.min(width, height) / 2 - 2;

    return (
    <svg fill="none" height="100%" viewBox={`0 0 ${width} ${height}`} width="100%">
      <circle cx={width / 2} cy={height / 2} opacity=".2" r={r} stroke="var(--agd-stroke)" strokeWidth="1.5" />
      <path d={`M${width / 2} ${height / 2 - r}a${r} ${r} 0 0 1 ${r} ${r}`} stroke="var(--agd-bar-strong)" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
    );
};

const FeatureSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const iconSz = Math.min(36, height * 0.25, width * 0.12);
    const items = Math.max(1, Math.min(3, Math.floor(height / 80)));

    return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-around", padding: 8 }}>
      {Array.from({ length: items }, (_, i) => (
        <div key={i} style={{ alignItems: "flex-start", display: "flex", gap: width * 0.04 }}>
          <Block h={iconSz} radius={iconSz * 0.25} w={iconSz} />
          <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 4 }}>
            <Bar h={3} strong w={`${40 + ((i * 13) % 20)}%`} />
            <Bar h={2} w={`${60 + ((i * 17) % 25)}%`} />
          </div>
        </div>
      ))}
    </div>
    );
};

const TeamSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const cols = Math.max(2, Math.min(4, Math.floor(width / 120)));
    const avatarSz = Math.min(36, height * 0.25);

    return (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: height * 0.06, height: "100%", padding: height * 0.06 }}>
      <Bar h={4} strong w={width * 0.3} />
      <div style={{ alignItems: "center", display: "flex", flex: 1, gap: width * 0.06, justifyContent: "center" }}>
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: 6 }}>
            <Circle size={avatarSz} />
            <Bar h={3} strong w={width * 0.12} />
            <Bar h={2} w={width * 0.08} />
          </div>
        ))}
      </div>
    </div>
    );
};

const LoginSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => {
    const fields = Math.max(2, Math.min(3, Math.floor(height / 80)));

    return (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: height * 0.04, height: "100%", padding: width * 0.06 }}>
      <Bar h={Math.max(5, height * 0.04)} strong w={width * 0.5} />
      <Bar h={2} w={width * 0.35} />
      <div style={{ display: "flex", flexDirection: "column", gap: height * 0.03, marginTop: height * 0.04, width: "100%" }}>
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Bar h={2} w={Math.min(60, width * 0.2)} />
            <Block h={Math.min(32, height * 0.1)} radius={4} w="100%" />
          </div>
        ))}
      </div>
      <Block h={Math.min(36, height * 0.12)} radius={6} style={{ background: "var(--agd-bar)", marginTop: height * 0.03 }} w="100%" />
      <Bar h={2} w={width * 0.4} />
    </div>
    );
};

const ContactSkeleton = ({ height, width }: Readonly<SkeletonProps>): JSX.Element => (
    <div style={{ display: "flex", flexDirection: "column", gap: height * 0.03, height: "100%", padding: width * 0.04 }}>
      <Bar h={4} strong w={width * 0.4} />
      <Bar h={2} w={width * 0.6} />
      <div style={{ display: "flex", gap: 6, marginTop: height * 0.03 }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 3 }}>
          <Bar h={2} w={50} />
          <Block h={Math.min(28, height * 0.1)} radius={4} w="100%" />
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 3 }}>
          <Bar h={2} w={40} />
          <Block h={Math.min(28, height * 0.1)} radius={4} w="100%" />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Bar h={2} w={50} />
        <Block h={Math.min(28, height * 0.1)} radius={4} w="100%" />
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 3 }}>
        <Bar h={2} w={60} />
        <Block h="100%" radius={4} w="100%" />
      </div>
      <Block h={Math.min(30, height * 0.1)} radius={6} style={{ alignSelf: "flex-end", background: "var(--agd-bar)" }} w={Math.min(120, width * 0.3)} />
    </div>
);

// --- Skeleton registry ---

const SKELETON_RENDERERS: Partial<Record<ComponentType, (props: SkeletonProps) => JSX.Element>> = {
    accordion: AccordionSkeleton,
    alert: AlertSkeleton,
    avatar: AvatarSkeleton,
    badge: BadgeSkeleton,
    banner: BannerSkeleton,
    breadcrumb: BreadcrumbSkeleton,
    button: ButtonSkeleton,
    calendar: CalendarSkeleton,
    card: CardSkeleton,
    carousel: CarouselSkeleton,
    chart: ChartSkeleton,
    checkbox: CheckboxSkeleton,
    chip: ChipSkeleton,
    codeBlock: CodeBlockSkeleton,
    contact: ContactSkeleton,
    cta: CtaSkeleton,
    datePicker: DatePickerSkeleton,
    divider: DividerSkeleton,
    drawer: DrawerSkeleton,
    dropdown: DropdownSkeleton,
    faq: FaqSkeleton,
    feature: FeatureSkeleton,
    fileUpload: FileUploadSkeleton,
    footer: FooterSkeleton,
    form: FormSkeleton,
    gallery: GallerySkeleton,
    grid: GridSkeleton,
    header: HeaderSkeleton,
    hero: HeroSkeleton,
    icon: IconSkeleton,
    image: ImageSkeleton,
    input: InputSkeleton,
    list: ListSkeleton,
    login: LoginSkeleton,
    logo: LogoSkeleton,
    map: MapSkeleton,
    modal: ModalSkeleton,
    navigation: NavigationSkeleton,
    notification: NotificationSkeleton,
    pagination: PaginationSkeleton,
    popover: PopoverSkeleton,
    pricing: PricingSkeleton,
    productCard: ProductCardSkeleton,
    profile: ProfileSkeleton,
    progress: ProgressSkeleton,
    radio: RadioSkeleton,
    rating: RatingSkeleton,
    search: SearchSkeleton,
    section: SectionSkeleton,
    sidebar: SidebarSkeleton,
    skeleton: SkeletonSkeletonRenderer,
    slider: SliderSkeleton,
    spinner: SpinnerSkeleton,
    stat: StatSkeleton,
    stepper: StepperSkeleton,
    table: TableSkeleton,
    tabs: TabsSkeleton,
    tag: TagSkeleton,
    team: TeamSkeleton,
    testimonial: TestimonialSkeleton,
    text: TextSkeleton,
    timeline: TimelineSkeleton,
    toast: ToastSkeleton,
    toggle: ToggleSkeleton,
    tooltip: TooltipSkeleton,
    video: VideoSkeleton,
};

export const Skeleton = ({ height, text, type, width }: Readonly<{ height: number; text?: string; type: ComponentType; width: number }>): JSX.Element => {
    const Renderer = SKELETON_RENDERERS[type];

    if (!Renderer) {
        return (
      <div style={{ alignItems: "center", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
        <span style={{ color: "var(--agd-text-3)", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", opacity: 0.5, textTransform: "uppercase" }}>{type}</span>
      </div>
        );
    }

    return (
    <div style={{ height: "100%", padding: 8, pointerEvents: "none", position: "relative", width: "100%" }}>
      <Renderer height={height} text={text} width={width} />
    </div>
    );
};
