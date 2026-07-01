import { useEffect, useState } from 'react'
import { DEFAULT_HOTKEY } from '../../shared/hotkey'
import { eventToAccelerator, acceleratorToGlyphs } from '../utils/accelerator'

type Feedback = { kind: 'error' | 'success'; text: string }

type Props = {
  value: string
  onChange: (accelerator: string) => void
}

export default function HotkeyField({ value, onChange }: Props) {
  const [recording, setRecording] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function apply(accelerator: string) {
    const ok = await window.electronAPI.changeHotkey(accelerator)
    setRecording(false)
    if (ok) {
      onChange(accelerator)
      setFeedback({ kind: 'success', text: 'Hotkey updated' })
    } else {
      setFeedback({ kind: 'error', text: 'That shortcut is unavailable — try another' })
    }
  }

  useEffect(() => {
    if (!recording) return
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(false)
        return
      }
      const result = eventToAccelerator(e)
      if (result.status === 'incomplete') return
      if (result.status === 'invalid') {
        setFeedback({ kind: 'error', text: result.message })
        return
      }
      void apply(result.accelerator)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [recording])

  function startRecording() {
    setFeedback(null)
    setRecording(true)
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm text-white/80">Global hotkey</span>
      <div className="flex items-center gap-3">
        {recording ? (
          <div className="hotkey-recording flex-1">Press a shortcut…</div>
        ) : (
          <div className="flex flex-1 items-center gap-1.5">
            {acceleratorToGlyphs(value).map((glyph, i) => (
              <kbd key={i} className="dict-key">
                {glyph}
              </kbd>
            ))}
          </div>
        )}

        {recording ? (
          <button className="btn-ghost text-sm" onClick={() => setRecording(false)}>
            Cancel
          </button>
        ) : (
          <>
            <button className="btn-ghost text-sm" onClick={startRecording}>
              Change
            </button>
            <button
              className="btn-ghost text-sm"
              onClick={() => {
                setFeedback(null)
                void apply(DEFAULT_HOTKEY)
              }}
              disabled={value === DEFAULT_HOTKEY}
            >
              Reset
            </button>
          </>
        )}
      </div>
      {feedback && (
        <p className={`text-xs ${feedback.kind === 'error' ? 'text-red-300' : 'text-white/60'}`}>
          {feedback.kind === 'error' ? '⚠ ' : '✓ '}
          {feedback.text}
        </p>
      )}
    </div>
  )
}
