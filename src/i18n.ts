import { computed, reactive, type ComputedRef } from 'vue'

type Locale = 'en' | 'zh'

type MessageParams = Record<string, string | number | boolean>

const supportedLocales = ['en', 'zh'] as const

type SupportedLocale = (typeof supportedLocales)[number]

function getBrowserLocale(): SupportedLocale {
  if (typeof navigator === 'object' && navigator) {
    const languages = Array.isArray(navigator.languages)
      ? navigator.languages
      : [navigator.language]

    console.log('Detected browser languages:', languages)

    for (const raw of languages) {
      const normalized = String(raw).trim().toLowerCase()
      if (normalized.startsWith('zh')) return 'zh'
      if (normalized.startsWith('en')) return 'en'
    }
  }
  return 'en'
}

const state = reactive({ locale: getBrowserLocale() as SupportedLocale })

function replaceParams(message: string, params?: MessageParams): string {
  if (!params) return message
  return Object.entries(params).reduce((current, [key, value]) => {
    return current.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }, message)
}

const messages: Record<SupportedLocale, Record<string, string>> = {
  en: {
    beginGame: 'Click “Roll” to start; a 6 is required to leave base.',
    base: 'Base',
    track: 'Track {progress}/{trackLength}',
    home: 'Home {progress}/{homeSteps}',
    completed: 'Finished',
    gameEnded: 'The game has ended.',
    diceAlreadyRolled: 'This turn already has a dice result; move a piece first.',
    moveBeforeRoll: 'Please roll the dice first.',
    cannotMovePiece: 'This piece cannot move right now.',
    onlyCurrentPlayerPiece: 'You can only move the current player’s piece.',
    playerRollNone: '{playerName} rolled {rolled} but cannot move; it is now {nextPlayerName}’s turn.',
    playerRolledChoosePiece: '{playerName} rolled {dice}. Select a piece to move.',
    playerVictory: '{playerName} has completed all pieces and won!',
    playerCapturedVictory: '{playerName} captured {captured} piece(s) and won!',
    playerCapturedContinue: '{playerName} captured {captured} piece(s) and continues this turn.',
    playerCanContinue: '{playerName} can continue this turn.',
    playerRollSixExtra: '{playerName} rolled a 6 and gets another action.',
    playerCapturedNext: '{playerName} captured {captured} piece(s); next turn in 2 seconds.',
    playerFlewNext: '{playerName} jumped ahead; next turn in 2 seconds.',
    playerMovedNext: '{playerName} moved one step; next turn in 2 seconds.',
    nextPlayerRoll: '{playerName}’s turn. Please roll the dice.',
    quickMode: 'Quick mode',
    normalMode: 'Normal mode',
    hellMode: 'Hell mode',
    difficultyMode: 'Difficulty mode',
    backToPrepare: 'Back to prepare',
    rollCanvas: 'Flight chess game canvas',
    playAgain: 'Play again',
    winnerPlaneAlt: '{winnerName} plane',
    backButton: 'Back to prepare',
    onceMoreButton: 'Play again',
    redPlayerAvatarAlt: 'Red player avatar',
    bluePlayerAvatarAlt: 'Blue player avatar',
    greenPlayerAvatarAlt: 'Green player avatar',
    yellowPlayerAvatarAlt: 'Yellow player avatar',
    playerMode: '{count}-player mode',
    singlePlayer: 'Solo challenge',
    twoPlayer: 'Two-player battle',
    threePlayer: 'Three-player free-for-all',
    fourPlayer: 'Four-player brawl',
    stepsPerEdge: '{steps} steps/edge',
    redPlayer: 'Red player',
    yellowPlayer: 'Yellow player',
    bluePlayer: 'Blue player',
    greenPlayer: 'Green player',
  },
  zh: {
    beginGame: '点击“掷骰子”开始；掷出 6 才能把棋子从基地放到起点。',
    base: '基地',
    track: '赛道 {progress}/{trackLength}',
    home: '内圈 {progress}/{homeSteps}',
    completed: '已完成',
    gameEnded: '游戏已经结束了。',
    diceAlreadyRolled: '当前回合已经有骰子结果，先移动棋子。',
    moveBeforeRoll: '请先掷骰子。',
    cannotMovePiece: '这枚棋子当前不能移动。',
    onlyCurrentPlayerPiece: '只能移动当前玩家的棋子。',
    playerRollNone: '{playerName} 掷出 {rolled} 点，但没有可移动棋子，已轮到 {nextPlayerName}。',
    playerRolledChoosePiece: '{playerName} 掷出 {dice} 点，请选择一枚可移动棋子。',
    playerVictory: '{playerName} 已完成全部棋子，赢得胜利！',
    playerCapturedVictory: '{playerName} 吃子 {captured} 枚，并且拿下胜利！',
    playerCapturedContinue: '{playerName} 吃子 {captured} 枚，继续本回合。',
    playerCanContinue: '{playerName} 可以继续行动。',
    playerRollSixExtra: '{playerName} 掷出 6，获得一次额外行动。',
    playerCapturedNext: '{playerName} 吃子 {captured} 枚，2 秒后轮到下一位。',
    playerFlewNext: '{playerName} 飞跃前进，2 秒后轮到下一位。',
    playerMovedNext: '{playerName} 走了一步，2 秒后轮到下一位。',
    nextPlayerRoll: '{playerName} 回合，请掷骰子。',
    quickMode: '快速模式',
    normalMode: '正常模式',
    hellMode: '地狱模式',
    difficultyMode: '难度模式',
    backToPrepare: '返回准备',
    rollCanvas: '飞行棋游戏画布',
    playAgain: '再来一次',
    winnerPlaneAlt: '{winnerName} 飞机',
    backButton: '返回准备页',
    onceMoreButton: '再来一次',
    redPlayerAvatarAlt: '红色玩家头像',
    bluePlayerAvatarAlt: '蓝色玩家头像',
    greenPlayerAvatarAlt: '绿色玩家头像',
    yellowPlayerAvatarAlt: '黄色玩家头像',
    playerMode: '{count}人模式',
    singlePlayer: '单人闯关',
    twoPlayer: '双人对战',
    threePlayer: '三人混战',
    fourPlayer: '四人乱斗',
    stepsPerEdge: '{steps}步/边',
    redPlayer: '红方',
    yellowPlayer: '黄方',
    bluePlayer: '蓝方',
    greenPlayer: '绿方',
  },
}

export function t(key: string, params?: MessageParams): string {
  const localeKey = state.locale
  const localeMessages = messages[localeKey] ?? messages.en
  const template = localeMessages[key] ?? messages.en[key] ?? key
  return replaceParams(template, params)
}

export function setLocale(localeValue: Locale): void {
  if (supportedLocales.includes(localeValue)) {
    state.locale = localeValue
  }
}

export function useI18n(): {
  locale: ComputedRef<Locale>
  setLocale: (localeValue: Locale) => void
  t: (key: string, params?: MessageParams) => string
} {
  return {
    locale: computed(() => state.locale),
    setLocale,
    t,
  }
}
