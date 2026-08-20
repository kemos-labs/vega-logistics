'use client';

import { memo, useMemo } from 'react';

interface SparklineProps {
  data: { i: number; v: number }[];
  color: string;
}

const Sparkline = memo(function Sparkline({ data, color }: SparklineProps) {
  const points = useMemo(() => {
    if (data.length === 0) return '';

    const values = data.map((point) => point.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return data
      .map((point, index) => {
        const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 50;
        const y = 28 - ((point.v - min) / range) * 24;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [data]);

  return (
    <div className="w-full h-8 min-w-0 overflow-hidden">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
});

export default Sparkline;
