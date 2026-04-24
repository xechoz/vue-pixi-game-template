export const TRACK_LENGTH = 40

export type GameMode = 2 | 3 | 4

export type PieceLocation = 'base' | 'track' | 'finished'

export interface GameSettings {
  mode: GameMode
  piecesPerPlayer: number
}

export interface PieceState {
  id: string
  progress: number
}

export interface PlayerMeta {
  index: number
  name: string
  color: string
  startIndex: number
  corner: string
}

export interface PlayerState extends PlayerMeta {
  active: boolean
  pieces: PieceState[]
}

export interface GameState {
  mode: GameMode
  piecesPerPlayer: number
  players: PlayerState[]
  turnOrder: number[]
  turnPointer: number
  currentPlayerIndex: number
  dice: number | null
  status: string
  winnerIndex: number | null
  turnCount: number
}

export const PLAYER_DEFS: PlayerMeta[] = [
  { index: 0, name: '红方', color: '#ef4444', startIndex: 0, corner: '左上' },
  { index: 1, name: '黄方', color: '#f59e0b', startIndex: 10, corner: '右上' },
  { index: 2, name: '蓝方', color: '#3b82f6', startIndex: 20, corner: '右下' },
  { index: 3, name: '绿方', color: '#22c55e', startIndex: 30, corner: '左下' },
]

const SAFE_CELLS = new Set([0, 10, 20, 30])

export function getTurnOrder(mode: GameMode): number[] {
  if (mode === 2) return [0, 2]
  if (mode === 3) return [0, 1, 3]
  return [0, 1, 2, 3]
}

export function clampPiecesPerPlayer(value: number): number {
  return Math.min(4, Math.max(1, Math.trunc(value) || 1))
}

export function createGame(settings: GameSettings): GameState {
  const mode = settings.mode
  const piecesPerPlayer = clampPiecesPerPlayer(settings.piecesPerPlayer)
  const turnOrder = getTurnOrder(mode)

  const players = PLAYER_DEFS.map((player) => ({
    ...player,
    active: turnOrder.includes(player.index),
    pieces: Array.from({ length: piecesPerPlayer }, (_, pieceIndex) => ({
      id: `${player.index}-${pieceIndex}`,
      progress: -1,
    })),
  }))

  return {
    mode,
    piecesPerPlayer,
    players,
    turnOrder,
    turnPointer: 0,
    currentPlayerIndex: turnOrder[0],
    dice: null,
    status: '点击“掷骰子”开始，先把棋子从基地送上赛道。',
    winnerIndex: null,
    turnCount: 1,
  }
}

export function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex]
}

export function getPieceLocation(_player: PlayerState, piece: PieceState): PieceLocation {
  if (piece.progress < 0) return 'base'
  if (piece.progress >= TRACK_LENGTH) return 'finished'
  return 'track'
}

export function getTrackCellIndex(player: PlayerState, piece: PieceState): number | null {
  if (piece.progress < 0 || piece.progress >= TRACK_LENGTH) return null
  return (player.startIndex + piece.progress) % TRACK_LENGTH
}

export function getLegalPieceIds(state: GameState): string[] {
  if (state.dice === null || state.winnerIndex !== null) return []

  const player = getCurrentPlayer(state)
  const legal: string[] = []

  for (const piece of player.pieces) {
    const location = getPieceLocation(player, piece)
    if (location === 'base' && state.dice === 6) {
      legal.push(piece.id)
      continue
    }

    if (location === 'track' && piece.progress + state.dice <= TRACK_LENGTH) {
      legal.push(piece.id)
    }
  }

  return legal
}

export function getPieceLabel(piece: PieceState): string {
  if (piece.progress < 0) return '基地'
  if (piece.progress >= TRACK_LENGTH) return '已到终点'
  return `前进 ${piece.progress}/${TRACK_LENGTH}`
}

export function rollDice(state: GameState): { rolled: boolean; skipped: boolean; message: string } {
  if (state.winnerIndex !== null) {
    return { rolled: false, skipped: false, message: '游戏已经结束了。' }
  }

  if (state.dice !== null) {
    return { rolled: false, skipped: false, message: '当前回合已经有骰子结果，先移动棋子。' }
  }

  const player = getCurrentPlayer(state)
  state.dice = Math.floor(Math.random() * 6) + 1

  const legalPieces = getLegalPieceIds(state)
  if (legalPieces.length === 0) {
    const rolled = state.dice
    state.status = `${player.name} 掷出 ${rolled} 点，但没有可移动的棋子，自动跳过。`
    state.dice = null
    advanceTurn(state)
    return { rolled: true, skipped: true, message: state.status }
  }

  state.status = `${player.name} 掷出 ${state.dice} 点，选择一个可以移动的棋子。`
  return { rolled: true, skipped: false, message: state.status }
}

export function movePiece(state: GameState, pieceId: string): { moved: boolean; message: string } {
  if (state.dice === null) {
    return { moved: false, message: '请先掷骰子。' }
  }

  if (state.winnerIndex !== null) {
    return { moved: false, message: '游戏已经结束了。' }
  }

  const player = getCurrentPlayer(state)
  const piece = player.pieces.find((item) => item.id === pieceId)
  if (!piece) {
    return { moved: false, message: '只能移动当前玩家的棋子。' }
  }

  const legalPieceIds = getLegalPieceIds(state)
  if (!legalPieceIds.includes(pieceId)) {
    return { moved: false, message: '这枚棋子当前不能移动。' }
  }

  const dice = state.dice
  const rolledSix = dice === 6

  if (piece.progress < 0) {
    piece.progress = 0
  } else {
    piece.progress += dice
  }

  const landingCell = getTrackCellIndex(player, piece)
  let captured = 0

  if (piece.progress >= TRACK_LENGTH) {
    piece.progress = TRACK_LENGTH
  } else if (landingCell !== null && !SAFE_CELLS.has(landingCell)) {
    for (const enemy of state.players) {
      if (!enemy.active || enemy.index === player.index) continue

      for (const enemyPiece of enemy.pieces) {
        if (enemyPiece.progress < 0 || enemyPiece.progress >= TRACK_LENGTH) continue

        const enemyCell = getTrackCellIndex(enemy, enemyPiece)
        if (enemyCell === landingCell) {
          enemyPiece.progress = -1
          captured += 1
        }
      }
    }
  }

  state.dice = null

  const finishedCount = player.pieces.filter((item) => item.progress >= TRACK_LENGTH).length
  if (finishedCount === player.pieces.length) {
    state.winnerIndex = player.index
    state.status = `${player.name} 已经率先完成全部棋子，赢得胜利！`
    return {
      moved: true,
      message: captured > 0 ? `${player.name} 吃子 ${captured} 枚并完成了最后一步！` : `${player.name} 完成了最后一步！`,
    }
  }

  if (rolledSix) {
    state.status = `${player.name} 掷出 6，获得一次额外行动。`
    return {
      moved: true,
      message: captured > 0 ? `${player.name} 吃子 ${captured} 枚，继续本回合。` : `${player.name} 可以继续行动。`,
    }
  }

  advanceTurn(state)
  return {
    moved: true,
    message: captured > 0 ? `${player.name} 吃子 ${captured} 枚，轮到下一位。` : `${player.name} 走了一步，轮到下一位。`,
  }
}

export function advanceTurn(state: GameState): void {
  if (state.winnerIndex !== null) return

  state.dice = null
  state.turnPointer = (state.turnPointer + 1) % state.turnOrder.length
  state.currentPlayerIndex = state.turnOrder[state.turnPointer]
  state.turnCount += 1
  state.status = `${getCurrentPlayer(state).name} 回合，请掷骰子。`
}

export function resetGame(settings: GameSettings): GameState {
  return createGame(settings)
}

export function getPlayerFinishedCount(player: PlayerState): number {
  return player.pieces.filter((piece) => piece.progress >= TRACK_LENGTH).length
}

export function getPlayerTrackCount(player: PlayerState): number {
  return player.pieces.filter((piece) => piece.progress >= 0 && piece.progress < TRACK_LENGTH).length
}

export function isSafeCell(cellIndex: number): boolean {
  return SAFE_CELLS.has(cellIndex)
}
