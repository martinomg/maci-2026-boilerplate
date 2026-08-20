/**
 * A trend sparkline rendered as inline SVG on the server.
 *
 * Per-lot trends are decorative and identical in shape, so paying for an
 * ECharts instance per table row would be wasteful. The full charts on the page
 * still use ECharts; this stays static markup with zero client JavaScript and
 * inherits colour through `currentColor`.
 */
export function Sparkline({
  values,
  ariaLabel,
  width = 96,
  height = 28,
  className,
}: {
  /** Series in chronological order. `null` marks a gap and ends the line. */
  values: (number | null)[];
  ariaLabel: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const points = values.filter((value): value is number => value !== null);

  if (points.length < 2) {
    return (
      <svg
        className={className}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const padding = 2;
  const usableHeight = height - padding * 2;
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const coordinates = points.map((value, index) => {
    const x = index * step;
    const y = padding + usableHeight - ((value - min) / span) * usableHeight;
    return [x, y] as const;
  });

  const line = coordinates
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${width.toFixed(2)},${height} L0,${height} Z`;
  const last = coordinates[coordinates.length - 1];

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <path d={area} fill="currentColor" fillOpacity={0.14} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill="currentColor" />
    </svg>
  );
}
