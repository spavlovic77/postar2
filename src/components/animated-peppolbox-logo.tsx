'use client'

import { useState, useEffect, useCallback } from 'react'

const WORDS = ['mail', 'peppol']
const LONGEST_WORD = 'peppol'
const TYPE_SPEED = 85
const DELETE_SPEED = 50
const PAUSE_AFTER_WORD = 1600
const PAUSE_BEFORE_TYPE = 500

type Phase =
  | { kind: 'typing'; wordIndex: number; charIndex: number }
  | { kind: 'pausing'; wordIndex: number }
  | { kind: 'deleting'; wordIndex: number; charIndex: number }
  | { kind: 'gap'; nextWordIndex: number }

export function AnimatedPeppolboxLogo() {
  const [phase, setPhase] = useState<Phase>({ kind: 'gap', nextWordIndex: 0 })
  const [displayText, setDisplayText] = useState('')

  const getDisplayFromPhase = useCallback((p: Phase): string => {
    switch (p.kind) {
      case 'typing':
        return WORDS[p.wordIndex].slice(0, p.charIndex + 1)
      case 'pausing':
        return WORDS[p.wordIndex]
      case 'deleting':
        return WORDS[p.wordIndex].slice(0, p.charIndex)
      case 'gap':
        return ''
    }
  }, [])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    switch (phase.kind) {
      case 'gap':
        timeout = setTimeout(() => {
          const nextIndex = phase.nextWordIndex < WORDS.length ? phase.nextWordIndex : 0
          setPhase({ kind: 'typing', wordIndex: nextIndex, charIndex: 0 })
        }, PAUSE_BEFORE_TYPE)
        break

      case 'typing': {
        const word = WORDS[phase.wordIndex]
        if (phase.charIndex < word.length - 1) {
          timeout = setTimeout(() => {
            setPhase({ kind: 'typing', wordIndex: phase.wordIndex, charIndex: phase.charIndex + 1 })
          }, TYPE_SPEED)
        } else {
          setPhase({ kind: 'pausing', wordIndex: phase.wordIndex })
        }
        break
      }

      case 'pausing':
        timeout = setTimeout(() => {
          setPhase({ kind: 'deleting', wordIndex: phase.wordIndex, charIndex: WORDS[phase.wordIndex].length })
        }, PAUSE_AFTER_WORD)
        break

      case 'deleting':
        if (phase.charIndex > 0) {
          timeout = setTimeout(() => {
            setPhase({ kind: 'deleting', wordIndex: phase.wordIndex, charIndex: phase.charIndex - 1 })
          }, DELETE_SPEED)
        } else {
          setPhase({ kind: 'gap', nextWordIndex: phase.wordIndex + 1 })
        }
        break
    }

    setDisplayText(getDisplayFromPhase(phase))

    return () => clearTimeout(timeout)
  }, [phase, getDisplayFromPhase])

  return (
    <div className="h-[1.2em] text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight flex items-center justify-center">
      <span className="whitespace-nowrap inline-flex items-baseline">
        {/* Fixed-width container for animated text, right-aligned so it always touches "box" */}
        <span className="inline-grid">
          {/* Invisible spacer sets the column width to longest word */}
          <span className="[grid-area:1/1] invisible select-none" aria-hidden="true">{LONGEST_WORD}</span>
          {/* Visible text, right-aligned within the same cell */}
          <span className="[grid-area:1/1] text-right text-[#EE1C25]">{displayText}</span>
        </span>
        <span className="text-[#0B4EA2]">box</span>
        <span className="text-foreground">.sk</span>
      </span>
    </div>
  )
}
