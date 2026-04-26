type AssetUrlResolver = (name: string) => string

export function createSceneAudio(assetUrl: AssetUrlResolver) {
  let audioCtx: AudioContext | null = null
  let bgmAudio: HTMLAudioElement | null = null

  function ensureAudioContext() {
    if (audioCtx) return audioCtx
    const AudioCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioCtor) return null
    audioCtx = new AudioCtor()
    return audioCtx
  }

  function stopBackgroundMusic() {
    if (bgmAudio) {
      bgmAudio.pause()
      bgmAudio.currentTime = 0
      bgmAudio = null
    }
  }

  function startBackgroundMusic() {
    if (bgmAudio) return
    const audio = new Audio(assetUrl('bgm.mp3'))
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = 0.09
    bgmAudio = audio
    audio.play().catch(() => {
      // Autoplay may be blocked until the first user gesture; keep the element ready.
    })
  }

  function playFailSound() {
    const audio = new Audio(assetUrl('fail.wav'))
    audio.preload = 'auto'
    audio.volume = 0.9
    audio.play().catch(() => {})
  }

  function playTone(
    frequency: number,
    duration = 0.09,
    type: OscillatorType = 'sine',
    gainValue = 0.04,
  ) {
    const ctx = ensureAudioContext()
    if (!ctx) return
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gainNode.gain.value = gainValue
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    const now = ctx.currentTime
    gainNode.gain.setValueAtTime(gainValue, now)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }

  function playRollSound() {
    playTone(660, 0.06, 'square', 0.03)
    window.setTimeout(() => playTone(880, 0.09, 'square', 0.035), 60)
  }

  function playMoveSound() {
    playTone(392, 0.08, 'triangle', 0.03)
    window.setTimeout(() => playTone(523.25, 0.08, 'triangle', 0.028), 70)
  }

  function playWinSound() {
    playTone(523.25, 0.12, 'triangle', 0.03)
    window.setTimeout(() => playTone(659.25, 0.12, 'triangle', 0.028), 110)
    window.setTimeout(() => playTone(783.99, 0.16, 'triangle', 0.03), 220)
  }

  function disposeAudio() {
    stopBackgroundMusic()
    audioCtx?.close().catch(() => {})
    audioCtx = null
  }

  return {
    disposeAudio,
    playFailSound,
    playMoveSound,
    playRollSound,
    playWinSound,
    startBackgroundMusic,
    stopBackgroundMusic,
  }
}
