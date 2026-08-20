'use client';

/* Plotly's runtime component types are not exported by react-plotly.js. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import dynamic from 'next/dynamic';
import { RiskSurface } from '@/lib/riskEngine';
import { useState } from 'react';
import { Layers, ChevronLeft, ChevronRight } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) as any;

interface RiskSurfaceViewerProps {
  surfaces: RiskSurface[];
}

const surfaceColorscales = [
  [[0, '#0a0a2e'], [0.25, '#1a237e'], [0.5, '#283593'], [0.75, '#ff6f00'], [1, '#ff3d00']],
  [[0, '#1b5e20'], [0.25, '#2e7d32'], [0.5, '#f9a825'], [0.75, '#e65100'], [1, '#b71c1c']],
  [[0, '#01579b'], [0.25, '#0277bd'], [0.5, '#fdd835'], [0.75, '#e65100'], [1, '#bf360c']],
];

export default function RiskSurfaceViewer({ surfaces }: RiskSurfaceViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const surface = surfaces[activeIndex];

  if (!surface) return null;

  const zValues = surface.points.map((row) => row.map((p) => p.z));
  const xValues = surface.points[0].map((p) => p.x);
  const yValues = surface.points.map((row) => row[0].y);

  return (
    <div className="bg-[#18181c] border border-[#2a2a33] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a33]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#a855f7]" />
          <h3 className="text-sm font-semibold text-[#e4e4e7] uppercase tracking-wider">
            3D Risk Surfaces
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            className="p-1 rounded text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#2a2a33] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-[#a1a1aa] font-mono-data">
            {activeIndex + 1} / {surfaces.length}
          </span>
          <button
            onClick={() => setActiveIndex(Math.min(surfaces.length - 1, activeIndex + 1))}
            disabled={activeIndex === surfaces.length - 1}
            className="p-1 rounded text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#2a2a33] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D Plot */}
      <div className="h-[420px]">
        <Plot
          data={[
            {
              type: 'surface' as const,
              z: zValues,
              x: xValues,
              y: yValues,
              colorscale: surfaceColorscales[activeIndex % surfaceColorscales.length] as any,
              contours: {
                z: {
                  show: true,
                  usecolormap: true,
                  highlightcolor: 'rgba(255,255,255,0.4)',
                  project: { z: true },
                },
              } as any,
              lighting: {
                ambient: 0.6,
                diffuse: 0.8,
                roughness: 0.3,
              },
              opacity: 0.9,
            } as any,
          ]}
          layout={{
            title: {
              text: surface.title,
              font: { size: 14, color: '#e4e4e7', family: 'Inter, sans-serif' },
            },
            autosize: true,
            margin: { t: 50, b: 60, l: 70, r: 70 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#a1a1aa', size: 10, family: 'Inter, sans-serif' },
            scene: {
              xaxis: {
                title: surface.xLabel,
                color: '#71717a',
                gridcolor: '#2a2a33',
                zerolinecolor: '#3d3d4a',
                backgroundcolor: 'rgba(0,0,0,0)',
              },
              yaxis: {
                title: surface.yLabel,
                color: '#71717a',
                gridcolor: '#2a2a33',
                zerolinecolor: '#3d3d4a',
                backgroundcolor: 'rgba(0,0,0,0)',
              },
              zaxis: {
                title: surface.zLabel,
                color: '#71717a',
                gridcolor: '#2a2a33',
                zerolinecolor: '#3d3d4a',
                backgroundcolor: 'rgba(0,0,0,0)',
              },
              camera: {
                eye: { x: 1.8, y: 1.8, z: 1.2 },
              },
            },
          } as any}
          config={{
            displayModeBar: true,
            modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'],
            displaylogo: false,
            responsive: true,
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
        />
      </div>

      {/* Interpretation */}
      <div className="px-4 py-3 border-t border-[#2a2a33] bg-[#0c0c0f]">
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 bg-[#a855f7]" />
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            {surface.interpretation}
          </p>
        </div>
      </div>
    </div>
  );
}
