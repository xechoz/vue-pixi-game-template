import { DEFAULT_BOARD_PRESET_ID, getBoardPreset, type BoardPreset, type BoardPresetId } from './board-presets.ts'

const activeBoardPreset = getBoardPreset()

export const TRACK_STEPS_PER_SIDE = activeBoardPreset.stepsPerSide
export const TRACK_LENGTH = activeBoardPreset.trackLength
export const HOME_STEPS = activeBoardPreset.homeSteps
export const FINISH_STEP = TRACK_LENGTH + HOME_STEPS

export type GameMode = 1 | 2 | 3 | 4

export type PieceLocation = 'base' | 'track' | 'home' | 'finished'

export interface GameSettings {
  mode: GameMode
  piecesPerPlayer: number
  boardPresetId?: BoardPresetId
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
  boardPresetId: BoardPresetId
}

export interface PlayerState extends PlayerMeta {
  active: boolean
  humanControlled: boolean
  pieces: PieceState[]
}

export interface GameState {
  mode: GameMode
  piecesPerPlayer: number
  boardPresetId: BoardPresetId
  players: PlayerState[]
  turnOrder: number[]
  turnPointer: number
  currentPlayerIndex: number
  dice: number | null
  status: string
  winnerIndex: number | null
  turnCount: number
}

function createPlayerDefs(boardPresetId: BoardPresetId): PlayerMeta[] {
  const boardPreset = getBoardPreset(boardPresetId)

  return [
    { index: 0, name: '红方', color: '#ef4444', startIndex: boardPreset.startIndices[0], corner: '左上', boardPresetId },
    { index: 1, name: '黄方', color: '#f59e0b', startIndex: boardPreset.startIndices[1], corner: '右上', boardPresetId },
    { index: 2, name: '蓝方', color: '#3b82f6', startIndex: boardPreset.startIndices[2], corner: '右下', boardPresetId },
    { index: 3, name: '绿方', color: '#22c55e', startIndex: boardPreset.startIndices[3], corner: '左下', boardPresetId },
  ]
}

function getPresetId(boardPresetId?: BoardPresetId): BoardPresetId {
  return boardPresetId ?? DEFAULT_BOARD_PRESET_ID
}

function getPresetForId(boardPresetId?: BoardPresetId): BoardPreset {
  return getBoardPreset(getPresetId(boardPresetId))
}

function getPresetForState(state: Pick<GameState, 'boardPresetId'>): BoardPreset {
  return getPresetForId(state.boardPresetId)
}

function getPresetForPlayer(player: Pick<PlayerState, 'boardPresetId'>): BoardPreset {
  return getPresetForId(player.boardPresetId)
}

export const PLAYER_DEFS: PlayerMeta[] = createPlayerDefs(activeBoardPreset.id)
export const SAFE_CELLS = new Set(activeBoardPreset.safeCells)
export const FLIGHT_JUMPS = new Map<number, number>(activeBoardPreset.flightJumps)

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
  const boardPresetId = getPresetId(settings.boardPresetId)
  const playerDefs = createPlayerDefs(boardPresetId)
  const turnOrder = getTurnOrder(mode)

  const players = playerDefs.map((player) => ({
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
    boardPresetId,
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

export function getPieceLocation(player: PlayerState, piece: PieceState): PieceLocation {
  const boardPreset = getPresetForPlayer(player)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps

  if (piece.progress < 0) return 'base'
  if (piece.progress < boardPreset.trackLength) return 'track'
  if (piece.progress < finishStep) return 'home'
  return 'finished'
}

export function getTrackCellIndex(player: PlayerState, piece: PieceState): number | null {
  const boardPreset = getPresetForPlayer(player)

  if (piece.progress < 0 || piece.progress >= boardPreset.trackLength) return null
  return (player.startIndex + piece.progress) % boardPreset.trackLength
}

export function getHomeLaneIndex(piece: PieceState, boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): number | null {
  const boardPreset = getPresetForId(boardPresetId)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps

  if (piece.progress < boardPreset.trackLength || piece.progress >= finishStep) return null
  return piece.progress - boardPreset.trackLength
}

function canPieceMove(state: GameState, piece: PieceState): boolean {
  const boardPreset = getPresetForState(state)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps

  if (state.dice === null || state.winnerIndex !== null) return false
  if (piece.progress < 0) return state.dice === 6
  return piece.progress + state.dice <= finishStep
}

export function buildMoveTrajectory(player: PlayerState, piece: PieceState, dice: number): number[] {
  const boardPreset = getPresetForPlayer(player)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps
  const flightJumps = new Map<number, number>(boardPreset.flightJumps)
  const steps: number[] = []
  let progress = piece.progress

  if (progress < 0) {
    if (dice !== 6) return steps
    progress = 0
    steps.push(progress)
    return steps
  }

  const target = Math.min(progress + dice, finishStep)
  while (progress < target) {
    progress += 1
    steps.push(progress)

    while (progress >= 0 && progress < boardPreset.trackLength) {
      const tempPiece = { id: piece.id, progress }
      const landingCell = getTrackCellIndex(player, tempPiece)
      const jumpTarget = landingCell === null ? undefined : flightJumps.get(landingCell)
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

export function getPieceLabel(piece: PieceState, boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): string {
  const boardPreset = getPresetForId(boardPresetId)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps

  if (piece.progress < 0) return '基地'
  if (piece.progress < boardPreset.trackLength) return `赛道 ${piece.progress + 1}/${boardPreset.trackLength}`
  if (piece.progress < finishStep) return `内圈 ${piece.progress - boardPreset.trackLength + 1}/${boardPreset.homeSteps}`
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

  const boardPreset = getPresetForState(state)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps
  const safeCells = new Set(boardPreset.safeCells)
  const flightJumps = new Map<number, number>(boardPreset.flightJumps)
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
  while (piece.progress >= 0 && piece.progress < boardPreset.trackLength) {
    const landingCell = getTrackCellIndex(player, piece)
    const jumpTarget = landingCell === null ? undefined : flightJumps.get(landingCell)
    if (jumpTarget === undefined || landingCell === null) break

    const jumpDelta = jumpTarget - landingCell
    piece.progress += jumpDelta
    jumped = true
  }

  let captured = 0
  const landingCell = getTrackCellIndex(player, piece)

  if (piece.progress < boardPreset.trackLength && landingCell !== null && !safeCells.has(landingCell)) {
    for (const enemy of state.players) {
      if (!enemy.active || enemy.index === player.index) continue

      for (const enemyPiece of enemy.pieces) {
        if (enemyPiece.progress < 0 || enemyPiece.progress >= boardPreset.trackLength) continue

        const enemyCell = getTrackCellIndex(enemy, enemyPiece)
        if (enemyCell === landingCell) {
          enemyPiece.progress = -1
          captured += 1
        }
      }
    }
  }

  state.dice = null

  const finishedCount = player.pieces.filter((item) => item.progress >= finishStep).length
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
  const boardPreset = getPresetForPlayer(player)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps

  return player.pieces.filter((piece) => piece.progress >= finishStep).length
}

export function getPlayerTrackCount(player: PlayerState): number {
  const boardPreset = getPresetForPlayer(player)

  return player.pieces.filter((piece) => piece.progress >= 0 && piece.progress < boardPreset.trackLength).length
}

export function isSafeCell(cellIndex: number, boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): boolean {
  return getPresetForId(boardPresetId).safeCells.includes(cellIndex)
}
