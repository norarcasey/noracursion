import type { CSSProperties } from 'react'
import type { RunController } from './useRun'

export interface ControlsProps {
  readonly run: RunController
  readonly speedMs: number
  readonly onSpeedChange: (speedMs: number) => void
  /** False for a display-only language, where nothing can be executed (§4). */
  readonly runnable: boolean
}

const SPEED_MIN = 50
const SPEED_MAX = 1500

/**
 * Play, pause, step, reset and a speed slider (§3.6).
 *
 * Every control is a real `<button>` or `<input>`, so the whole transport is
 * reachable and operable from the keyboard without any handler of ours. The
 * shortcuts in the parent are a convenience on top of that, not the mechanism.
 */
export function Controls({ run, speedMs, onSpeedChange, runnable }: ControlsProps) {
  const total = run.frames.length - 1

  return (
    <div
      className="nrc__controls"
      style={controlsStyle}
      role="group"
      aria-label="Playback controls"
    >
      <button
        type="button"
        className="nrc__control nrc__control--reset"
        style={buttonStyle}
        onClick={run.reset}
        disabled={!runnable || run.atStart}
        aria-label="Reset to the start"
        title="Reset"
      >
        ⏮
      </button>

      <button
        type="button"
        className="nrc__control nrc__control--back"
        style={buttonStyle}
        onClick={run.stepBack}
        disabled={!runnable || run.atStart}
        aria-label="Step backward"
        title="Step back"
      >
        ◀
      </button>

      <button
        type="button"
        className="nrc__control nrc__control--play"
        style={{ ...buttonStyle, ...primaryButtonStyle }}
        onClick={run.toggle}
        disabled={!runnable || total === 0}
        aria-label={run.playing ? 'Pause' : 'Play'}
        aria-pressed={run.playing}
        title={run.playing ? 'Pause (space)' : 'Play (space)'}
      >
        {run.playing ? '⏸' : '▶'}
      </button>

      <button
        type="button"
        className="nrc__control nrc__control--forward"
        style={buttonStyle}
        onClick={run.stepForward}
        disabled={!runnable || run.atEnd}
        aria-label="Step forward"
        title="Step forward"
      >
        ▶
      </button>

      <label className="nrc__speed" style={speedStyle}>
        <span style={speedLabelStyle}>Speed</span>
        <input
          type="range"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={50}
          // The slider reads left-to-right as faster, so it carries the
          // inverse of the delay it controls.
          value={SPEED_MIN + SPEED_MAX - speedMs}
          onChange={(event) => onSpeedChange(SPEED_MIN + SPEED_MAX - Number(event.target.value))}
          aria-label={`Speed: ${speedMs} milliseconds per step`}
          aria-valuetext={`${speedMs} milliseconds per step`}
        />
      </label>

      <output className="nrc__position" style={positionStyle} aria-live="polite">
        {`Step ${run.index} of ${total}`}
      </output>
    </div>
  )
}

const controlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
}

const buttonStyle: CSSProperties = {
  minWidth: '2.25rem',
  minHeight: '2.25rem',
  padding: '0.25rem 0.5rem',
  borderRadius: '6px',
  border: '1px solid var(--nrc-edge-stroke, #4a5a94)',
  background: 'var(--nrc-stage, #0b1020)',
  color: 'var(--nrc-text, #e7ecff)',
  cursor: 'pointer',
  fontSize: '0.9rem',
  lineHeight: 1,
}

const primaryButtonStyle: CSSProperties = {
  borderColor: 'var(--nrc-node-stroke, #38e1ff)',
}

const speedStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  marginLeft: '0.25rem',
}

const speedLabelStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--nrc-muted, #9fb0e8)',
}

const positionStyle: CSSProperties = {
  marginLeft: 'auto',
  fontSize: '0.8rem',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--nrc-muted, #9fb0e8)',
}
