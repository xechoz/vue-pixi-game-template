export const TRACK_LENGTH = 40
export const HOME_STEPS = 4
export const FINISH_STEP = TRACK_LENGTH + HOME_STEPS

export type GameMode = 1 | 2 | 3 | 4

export type PieceLocation = 'base' | 'track' | 'home' | 'finished'

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
  humanControlled: boolean
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

export const SAFE_CELLS = new Set([0, 10, 20, 30])
export const FLIGHT_JUMPS = new Map<number, number>([
  [5, 9],
  [12, 16],
  [22, 26],
  [31, 35],
])

export function getTurnOrder(mode: GameMode): number[] {
  void mode
  return [0, 1, 2, 3]
}

export function clampPiecesPerPlayer(value: number): number {
  return Math.min(4, Math.max(1, Math.trunc(value) || 1))
}

export function getWeightedDiceRoll(trackPieceCount: number, randomValue = Math.random()): number {
  if (trackPieceCount <= 0) {
    if (randomValue < 0.5) return 6
    return Math.floor((randomValue - 0.5) / (0.5 / 5)) + 1
  }

  return Math.floor(randomValue * 6) + 1
}

export function createGame(settings: GameSettings): GameState {
  const mode = settings.mode
  const piecesPerPlayer = clampPiecesPerPlayer(settings.piecesPerPlayer)
  const turnOrder = getTurnOrder(mode)

  const players = PLAYER_DEFS.map((player) => ({
    ...player,
    active: true,
    humanControlled: player.index < mode,
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
    status: '点击“掷骰子”开始；掷出 6 才能把棋子从基地放到起点。',
    winnerIndex: null,
    turnCount: 1,
  }
}

export function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex]
}

export function getPieceLocation(_player: PlayerState, piece: PieceState): PieceLocation {
  if (piece.progress < 0) return 'base'
  if (piece.progress < TRACK_LENGTH) return 'track'
  if (piece.progress < FINISH_STEP) return 'home'
  return 'finished'
}

export function getTrackCellIndex(player: PlayerState, piece: PieceState): number | null {
  if (piece.progress < 0 || piece.progress >= TRACK_LENGTH) return null
  return (player.startIndex + piece.progress) % TRACK_LENGTH
}

export function getHomeLaneIndex(piece: PieceState): number | null {
  if (piece.progress < TRACK_LENGTH || piece.progress >= FINISH_STEP) return null
  return piece.progress - TRACK_LENGTH
}

function canPieceMove(state: GameState, piece: PieceState): boolean {
  if (state.dice === null || state.winnerIndex !== null) return false
  if (piece.progress < 0) return state.dice === 6
  return piece.progress + state.dice <= FINISH_STEP
}

export function buildMoveTrajectory(player: PlayerState, piece: PieceState, dice: number): number[] {
  const steps: number[] = []
  let progress = piece.progress

  if (progress < 0) {
    if (dice !== 6) return steps
    progress = 0
    steps.push(progress)
    return steps
  }

  const target = Math.min(progress + dice, FINISH_STEP)
  while (progress < target) {
    progress += 1
    steps.push(progress)

    while (progress >= 0 && progress < TRACK_LENGTH) {
      const tempPiece = { id: piece.id, progress }
      const landingCell = getTrackCellIndex(player, tempPiece)
      const jumpTarget = landingCell === null ? undefined : FLIGHT_JUMPS.get(landingCell)
      if (jumpTarget === undefined || landingCell === null) break

      progress += jumpTarget - landingCell
      steps.push(progress)
    }
  }

  return steps
}

export function chooseAutoMovePieceId(state: GameState): string | null {
  if (state.dice === null || state.winnerIndex !== null) return null

  const player = getCurrentPlayer(state)
  const candidates = player.pieces
    .filter((piece) => canPieceMove(state, piece))
    .map((piece) => ({
      piece,
      trajectory: buildMoveTrajectory(player, piece, state.dice as number),
    }))

  if (candidates.length === 0) return null

  candidates.sort((left, right) => {
    const leftEnd = left.trajectory.at(-1) ?? left.piece.progress
    const rightEnd = right.trajectory.at(-1) ?? right.piece.progress
    if (rightEnd !== leftEnd) return rightEnd - leftEnd
    return left.piece.progress - right.piece.progress
  })

  return candidates[0]?.piece.id ?? null
}

export function getLegalPieceIds(state: GameState): string[] {
  if (state.dice === null || state.winnerIndex !== null) return []

  const player = getCurrentPlayer(state)
  return player.pieces.filter((piece) => canPieceMove(state, piece)).map((piece) => piece.id)
}

export function getPieceLabel(piece: PieceState): string {
  if (piece.progress < 0) return '基地'
  if (piece.progress < TRACK_LENGTH) return `赛道 ${piece.progress + 1}/${TRACK_LENGTH}`
  if (piece.progress < FINISH_STEP) return `内圈 ${piece.progress - TRACK_LENGTH + 1}/${HOME_STEPS}`
  return '已完成'
}

export function rollDice(state: GameState): { rolled: boolean; skipped: boolean; advancePending: boolean; message: string } {
  if (state.winnerIndex !== null) {
    return { rolled: false, skipped: false, advancePending: false, message: '游戏已经结束了。' }
  }

  if (state.dice !== null) {
    return { rolled: false, skipped: false, advancePending: false, message: '当前回合已经有骰子结果，先移动棋子。' }
  }

  const player = getCurrentPlayer(state)
  const trackPieceCount = getPlayerTrackCount(player)
  state.dice = getWeightedDiceRoll(trackPieceCount)

  const legalPieces = getLegalPieceIds(state)
  if (legalPieces.length === 0) {
    const rolled = state.dice
    advanceTurn(state)
    state.status = `${player.name} 掷出 ${rolled} 点，但没有可移动棋子，已轮到 ${getCurrentPlayer(state).name}。`
    return { rolled: true, skipped: true, advancePending: false, message: state.status }
  }

  state.status = `${player.name} 掷出 ${state.dice} 点，请选择一枚可移动棋子。`
  return { rolled: true, skipped: false, advancePending: false, message: state.status }
}

export function movePiece(
  state: GameState,
  pieceId: string,
  options: { deferAdvanceTurn?: boolean } = {},
): { moved: boolean; advancePending: boolean; message: string } {
  void options

  if (state.dice === null) {
    return { moved: false, advancePending: false, message: '请先掷骰子。' }
  }

  if (state.winnerIndex !== null) {
    return { moved: false, advancePending: false, message: '游戏已经结束了。' }
  }

  const player = getCurrentPlayer(state)
  const piece = player.pieces.find((item) => item.id === pieceId)
  if (!piece) {
    return { moved: false, advancePending: false, message: '只能移动当前玩家的棋子。' }
  }

  if (!canPieceMove(state, piece)) {
    return { moved: false, advancePending: false, message: '这枚棋子当前不能移动。' }
  }

  const dice = state.dice
  const rolledSix = dice === 6

  if (piece.progress < 0) {
    piece.progress = 0
  } else {
    piece.progress += dice
  }

  let jumped = false
  while (piece.progress >= 0 && piece.progress < TRACK_LENGTH) {
    const landingCell = getTrackCellIndex(player, piece)
    const jumpTarget = landingCell === null ? undefined : FLIGHT_JUMPS.get(landingCell)
    if (jumpTarget === undefined || landingCell === null) break

    const jumpDelta = jumpTarget - landingCell
    piece.progress += jumpDelta
    jumped = true
  }

  let captured = 0
  const landingCell = getTrackCellIndex(player, piece)

  if (piece.progress < TRACK_LENGTH && landingCell !== null && !SAFE_CELLS.has(landingCell)) {
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

  const finishedCount = player.pieces.filter((item) => item.progress >= FINISH_STEP).length
  if (finishedCount === player.pieces.length) {
    state.winnerIndex = player.index
    state.status = `${player.name} 已完成全部棋子，赢得胜利！`
    return {
      moved: true,
      advancePending: false,
      message:
        captured > 0
          ? `${player.name} 吃子 ${captured} 枚，并且拿下胜利！`
          : `${player.name} 获得胜利！`,
    }
  }

  if (rolledSix) {
    state.status = `${player.name} 掷出 6，获得一次额外行动。`
    return {
      moved: true,
      advancePending: false,
      message:
        captured > 0
          ? `${player.name} 吃子 ${captured} 枚，继续本回合。`
          : `${player.name} 可以继续行动。`,
    }
  }

  state.status = captured > 0
    ? `${player.name} 吃子 ${captured} 枚，2 秒后轮到下一位。`
    : jumped
      ? `${player.name} 飞跃前进，2 秒后轮到下一位。`
      : `${player.name} 走了一步，2 秒后轮到下一位。`
  return {
    moved: true,
    advancePending: true,
    message: state.status,
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
  return player.pieces.filter((piece) => piece.progress >= FINISH_STEP).length
}

export function getPlayerTrackCount(player: PlayerState): number {
  return player.pieces.filter((piece) => piece.progress >= 0 && piece.progress < TRACK_LENGTH).length
}

export function isSafeCell(cellIndex: number): boolean {
  return SAFE_CELLS.has(cellIndex)
}
