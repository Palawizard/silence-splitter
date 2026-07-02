import type { RefObject } from 'react'
import type { TimeRegion } from '@core/models/timeline-preview'
import {
  formatTimeLabel,
  RULER_HEIGHT,
  SEGMENT_BAR_HEIGHT,
  toX,
  TRACK_HEIGHT,
  WAVE_LANE_HEIGHT,
  WAVE_LANE_TOP
} from './geometry'

type TimelineTrackProps = {
  canvasWidth: number
  pixelsPerSecond: number
  ticks: number[]
  cutRegions: TimeRegion[]
  keepRegions: TimeRegion[]
  viewportWidth: number
  waveformLeft: number
  waveformCanvasRef: RefObject<HTMLCanvasElement | null>
  playheadRef: RefObject<HTMLDivElement | null>
}

function RegionRects({
  regions,
  pixelsPerSecond,
  kind,
  lane
}: {
  regions: TimeRegion[]
  pixelsPerSecond: number
  kind: 'cut' | 'keep'
  lane: 'bar' | 'fill'
}) {
  const isBar = lane === 'bar'
  return regions.map((region, index) => (
    <rect
      key={`${kind}-${lane}-${index}`}
      x={toX(region.startSeconds, pixelsPerSecond)}
      y={isBar ? RULER_HEIGHT : WAVE_LANE_TOP}
      width={Math.max(1, toX(region.endSeconds - region.startSeconds, pixelsPerSecond))}
      height={isBar ? SEGMENT_BAR_HEIGHT : WAVE_LANE_HEIGHT}
      className={`timeline-${kind}-${isBar ? 'marker' : 'zone'}`}
    />
  ))
}

export default function TimelineTrack({
  canvasWidth,
  pixelsPerSecond,
  ticks,
  cutRegions,
  keepRegions,
  viewportWidth,
  waveformLeft,
  waveformCanvasRef,
  playheadRef
}: TimelineTrackProps) {
  return (
    <div className="timeline-canvas" style={{ width: canvasWidth }}>
      <svg
        className="timeline-track"
        width={canvasWidth}
        height={TRACK_HEIGHT}
        viewBox={`0 0 ${canvasWidth} ${TRACK_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-hidden="true"
      >
        <rect width={canvasWidth} height={RULER_HEIGHT} className="timeline-ruler-background" />
        <line
          x1={0}
          y1={RULER_HEIGHT - 0.5}
          x2={canvasWidth}
          y2={RULER_HEIGHT - 0.5}
          className="timeline-ruler-baseline"
        />
        {ticks.map((tick, index) => {
          const x = toX(tick, pixelsPerSecond)
          return (
            <g key={`ruler-${index}`}>
              <line x1={x} y1={RULER_HEIGHT - 8} x2={x} y2={RULER_HEIGHT} className="timeline-ruler-tick" />
              <text
                x={x}
                y={12}
                className="timeline-ruler-label"
                textAnchor={index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle'}
              >
                {formatTimeLabel(tick)}
              </text>
            </g>
          )
        })}
        <RegionRects regions={cutRegions} pixelsPerSecond={pixelsPerSecond} kind="cut" lane="bar" />
        <RegionRects regions={keepRegions} pixelsPerSecond={pixelsPerSecond} kind="keep" lane="bar" />
        <rect y={WAVE_LANE_TOP} width={canvasWidth} height={WAVE_LANE_HEIGHT} className="timeline-background" />
        <RegionRects regions={cutRegions} pixelsPerSecond={pixelsPerSecond} kind="cut" lane="fill" />
        <RegionRects regions={keepRegions} pixelsPerSecond={pixelsPerSecond} kind="keep" lane="fill" />
      </svg>

      {viewportWidth > 0 && (
        <canvas
          ref={waveformCanvasRef}
          className="timeline-waveform-canvas"
          style={{ top: WAVE_LANE_TOP, left: waveformLeft, width: viewportWidth, height: WAVE_LANE_HEIGHT }}
          aria-hidden="true"
        />
      )}
      <div ref={playheadRef} className="timeline-playhead" aria-hidden="true" />
    </div>
  )
}
