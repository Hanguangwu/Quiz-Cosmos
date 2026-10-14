import { useCallback, useEffect, useState } from 'react'

/**
 * 复习音效（WebAudio 合成，不引入任何音频资源）。
 *
 * 用振荡器现场合成，音色由频率与衰减包络决定：
 *   · flip    短促单音，像纸片翻过去
 *   · again   下沉双音（忘了）
 *   · hard    中音上扬
 *   · good    明亮三度（记住了）
 *   · easy    更宽的四度五音（轻松）
 *
 * 偏好：开关持久化在 localStorage。因为音效只由「翻面 / 评分」这类用户手势
 * 触发，不存在自动播放问题，所以默认开启；而 `prefers-reduced-motion` 的用户
 * 对额外刺激的期待更低，一并降级为静音。
 */

const STORAGE_KEY = 'kc:sound'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export type ReviewSound = 'flip' | 'again' | 'hard' | 'good' | 'easy'

interface Note {
  freq: number
  /** 相对播放起点的偏移，秒。 */
  at: number
  dur: number
}

const RECIPES: Record<ReviewSound, Note[]> = {
  flip: [{ freq: 520, at: 0, dur: 0.09 }],
  again: [
    { freq: 320, at: 0, dur: 0.1 },
    { freq: 240, at: 0.07, dur: 0.12 },
  ],
  hard: [
    { freq: 380, at: 0, dur: 0.08 },
    { freq: 460, at: 0.06, dur: 0.12 },
  ],
  good: [
    { freq: 587, at: 0, dur: 0.08 },
    { freq: 740, at: 0.06, dur: 0.1 },
    { freq: 880, at: 0.12, dur: 0.14 },
  ],
  easy: [
    { freq: 659, at: 0, dur: 0.08 },
    { freq: 880, at: 0.06, dur: 0.12 },
    { freq: 1175, at: 0.13, dur: 0.16 },
  ],
}

type AudioContextCtor = typeof AudioContext

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(REDUCED_MOTION).matches
}

/** 静音开关。默认 false（开启音效）。 */
export function useSoundPreference(): [boolean, (next: boolean) => void] {
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'on'
    } catch {
      return false
    }
  })
  const [reduced, setReduced] = useState<boolean>(prefersReducedMotion)

  // 跟随系统设置实时变化。
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia(REDUCED_MOTION)
    const sync = () => setReduced(query.matches)
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const setSound = useCallback((next: boolean) => {
    setMuted(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
    } catch {
      /* storage blocked — 仅在内存中生效 */
    }
  }, [])

  return [muted || reduced, setSound]
}

/**
 * 播放器。`play` 对任何环境都安全：没有 AudioContext 或被静音时静默返回。
 * AudioContext 惰性创建并在 suspended 时 resume。
 */
export function useReviewSound(enabled: boolean): (sound: ReviewSound) => void {
  const [context, setContext] = useState<AudioContext | null>(null)

  useEffect(() => {
    // 关闭时释放已创建的 AudioContext，避免后台线程空转。
    return () => {
      if (context && context.state !== 'closed') void context.close()
    }
  }, [context])

  return useCallback(
    (sound: ReviewSound) => {
      if (!enabled) return
      const Ctor: AudioContextCtor | undefined =
        typeof window === 'undefined'
          ? undefined
          : (window.AudioContext ??
            (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext)
      if (!Ctor) return

      try {
        const audio = context ?? new Ctor()
        if (!context) setContext(audio)
        if (audio.state === 'suspended') void audio.resume()

        const started = audio.currentTime
        for (const note of RECIPES[sound]) {
          const oscillator = audio.createOscillator()
          const gain = audio.createGain()
          oscillator.type = 'sine'
          oscillator.frequency.value = note.freq

          const from = started + note.at
          const to = from + note.dur
          gain.gain.setValueAtTime(0.0001, from)
          gain.gain.exponentialRampToValueAtTime(0.16, from + 0.012)
          gain.gain.exponentialRampToValueAtTime(0.0001, to)

          oscillator.connect(gain).connect(audio.destination)
          oscillator.start(from)
          oscillator.stop(to)
        }
      } catch {
        /* 音频被禁用或被打断 —— 静默降级 */
      }
    },
    [context, enabled],
  )
}
