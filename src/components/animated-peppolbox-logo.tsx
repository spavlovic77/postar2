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
    <span className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight inline-flex items-baseline">
      {/* Animated word area — invisible spacer holds width, visible text overlaid */}
      <span className="relative inline-flex items-baseline">
        {/* Invisible spacer: always renders longest word to hold stable width */}
        <span className="invisible whitespace-nowrap select-none" aria-hidden="true">
          {LONGEST_WORD}
        </span>
        {/* Visible text + cursor, absolutely positioned over spacer */}
        <span className="absolute left-0 top-0 inline-flex items-baseline whitespace-nowrap">
          <span className="text-red-500">{displayText}</span>
          <span
            className="inline-block w-[3px] h-[0.7em] bg-red-500 ml-px self-center rounded-full animate-blink"
            aria-hidden="true"
          />
        </span>
      </span>
      <span className="text-blue-500">box</span>
      <span className="text-foreground">.sk</span>
    </span>
  )
}
