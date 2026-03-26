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
    <span className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
      {/* Inline-grid: spacer + visible text share same cell = stable width + correct baseline */}
      <span className="inline-grid [grid-template-areas:'s'] align-baseline">
        {/* Spacer: holds width of longest word, invisible but in flow */}
        <span
          className="[grid-area:s] invisible whitespace-nowrap select-none"
          aria-hidden="true"
        >
          {LONGEST_WORD}
        </span>
        {/* Visible animated text overlaid in same cell */}
        <span className="[grid-area:s] whitespace-nowrap inline-flex items-center">
          <span className="text-red-500">{displayText}</span>
          <span
            className="inline-block w-[3px] h-[0.65em] bg-red-500 ml-px rounded-full animate-blink"
            aria-hidden="true"
          />
        </span>
      </span>
      <span className="text-blue-500">box</span>
      <span className="text-foreground">.sk</span>
    </span>
  )
}
