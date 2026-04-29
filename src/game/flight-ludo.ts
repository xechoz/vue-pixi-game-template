import { DEFAULT_BOARD_PRESET_ID, getBoardPreset, type BoardPreset, type BoardPresetId } from './board-presets.ts'

const activeBoardPreset = getBoardPreset()

export const TRACK_STEPS_PER_SIDE = activeBoardPreset.stepsPerEdge
export const TRACK_LENGTH = activeBoardPreset.trackLength
export const HOME_STEPS = activeBoardPreset.homeSteps
export const HOME_ENTRY_STEP = TRACK_LENGTH
export const FINISH_STEP = HOME_ENTRY_STEP + HOME_STEPS

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
  finished: boolean
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
  dice: number
  status: string
  winnerIndex: number
  turnCount: number
  legalPieceIds: string[]
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

function deriveQuarterIndices(trackLength: number): [number, number, number, number] {
  return [
    0,
    Math.floor(trackLength / 4),
    Math.floor(trackLength / 2),
    Math.floor((trackLength * 3) / 4),
  ]
}

function createPlayerDefs(boardPresetId: BoardPresetId): PlayerMeta[] {
  const boardPreset = getBoardPreset(boardPresetId)
  const startIndices = deriveQuarterIndices(boardPreset.trackLength)

  return [
    { index: 0, name: '红方', color: '#ef4444', startIndex: startIndices[0], corner: '左上', boardPresetId },
    { index: 1, name: '黄方', color: '#f59e0b', startIndex: startIndices[1], corner: '右上', boardPresetId },
    { index: 2, name: '蓝方', color: '#3b82f6', startIndex: startIndices[2], corner: '右下', boardPresetId },
    { index: 3, name: '绿方', color: '#22c55e', startIndex: startIndices[3], corner: '左下', boardPresetId },
  ]
}

export const PLAYER_DEFS: PlayerMeta[] = createPlayerDefs(activeBoardPreset.id)
export const SAFE_CELLS = activeBoardPreset.safeCells
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
      progress: 0,
      finished: false,
    })),
  }))

  return {
    mode,
    piecesPerPlayer,
    boardPresetId,
    players,
    turnOrder,
    turnPointer: 0,
    currentPlayerIndex: turnOrder[0] ?? 0,
    dice: 0,
    status: '点击“掷骰子”开始；掷出 6 才能把棋子从基地放到起点。',
    winnerIndex: -1,
    turnCount: 1,
    legalPieceIds: [],
  }
}

export function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex] ?? state.players[0]!
}

export function getPieceLocation(player: PlayerState, piece: PieceState): PieceLocation {
  const boardPreset = getPresetForPlayer(player)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps

  if (piece.progress <= 0) return 'base'
  if (piece.progress <= boardPreset.trackLength) return 'track'
  if (piece.progress < finishStep) return 'home'
  return 'finished'
}

export function getTrackCellIndex(player: PlayerState, piece: PieceState): number {
  const boardPreset = getPresetForPlayer(player)
  if (piece.progress <= 0 || piece.progress > boardPreset.trackLength) return -1
  return (player.startIndex + piece.progress - 1) % boardPreset.trackLength
}

export function getHomeLaneIndex(piece: PieceState, boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): number {
  const boardPreset = getPresetForId(boardPresetId)
  if (piece.progress <= boardPreset.trackLength || piece.progress >= boardPreset.trackLength + boardPreset.homeSteps) return -1
  return piece.progress - boardPreset.trackLength - 1
}

function canPieceMove(state: GameState, piece: PieceState): boolean {
  const boardPreset = getPresetForState(state)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps

  if (state.dice <= 0 || state.winnerIndex !== -1 || piece.finished) return false
  if (piece.progress <= 0) return state.dice === 6
  return piece.progress + state.dice <= finishStep
}

export function buildMoveTrajectory(player: PlayerState, piece: PieceState, dice: number): number[] {
  const boardPreset = getPresetForPlayer(player)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps
  const flightJumps = new Map<number, number>(boardPreset.flightJumps)
  const steps: number[] = []
  let progress = piece.progress

  if (progress <= 0) {
    if (dice !== 6) return steps
    progress = 1
    steps.push(progress)
    return steps
  }

  const target = Math.min(progress + dice, finishStep)
  while (progress < target) {
    progress += 1
    steps.push(progress)

    while (progress >= 1 && progress <= boardPreset.trackLength) {
      const landingCell = getTrackCellIndex(player, { ...piece, progress })
      if (landingCell < 0) break
      const jumpTarget = flightJumps.get(landingCell)
      if (jumpTarget === undefined) break
      progress += jumpTarget - landingCell
      steps.push(progress)
    }
  }

  return steps
}

export function chooseAutoMovePieceId(state: GameState): string {
  if (state.dice <= 0 || state.winnerIndex !== -1) return ''

  const player = getCurrentPlayer(state)
  const candidates = player.pieces
    .filter((piece) => canPieceMove(state, piece))
    .map((piece) => ({
      piece,
      trajectory: buildMoveTrajectory(player, piece, state.dice),
    }))

  if (candidates.length === 0) return ''

  candidates.sort((left, right) => {
    const leftEnd = left.trajectory.at(-1) ?? left.piece.progress
    const rightEnd = right.trajectory.at(-1) ?? right.piece.progress
    if (rightEnd !== leftEnd) return rightEnd - leftEnd
    return left.piece.progress - right.piece.progress
  })

  return candidates[0]?.piece.id ?? ''
}

export function getLegalPieceIds(state: GameState): string[] {
  if (state.dice <= 0 || state.winnerIndex !== -1) return []

  const player = getCurrentPlayer(state)
  return player.pieces.filter((piece) => canPieceMove(state, piece)).map((piece) => piece.id)
}

export function getPieceLabel(piece: PieceState, boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): string {
  const boardPreset = getPresetForId(boardPresetId)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps

  if (piece.progress <= 0) return '基地'
  if (piece.progress <= boardPreset.trackLength) return `赛道 ${piece.progress}/${boardPreset.trackLength}`
  if (piece.progress < finishStep) return `内圈 ${piece.progress - boardPreset.trackLength}/${boardPreset.homeSteps}`
  return '已完成'
}

export function rollDice(state: GameState): { rolled: boolean; skipped: boolean; advancePending: boolean; message: string } {
  if (state.winnerIndex !== -1) {
    return { rolled: false, skipped: false, advancePending: false, message: '游戏已经结束了。' }
  }

  if (state.dice !== 0) {
    return { rolled: false, skipped: false, advancePending: false, message: '当前回合已经有骰子结果，先移动棋子。' }
  }

  const player = getCurrentPlayer(state)
  const trackPieceCount = getPlayerTrackCount(player)
  state.dice = getWeightedDiceRoll(trackPieceCount)

  const legalPieces = getLegalPieceIds(state)
  state.legalPieceIds = legalPieces
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

  if (state.dice <= 0) {
    return { moved: false, advancePending: false, message: '请先掷骰子。' }
  }

  if (state.winnerIndex !== -1) {
    return { moved: false, advancePending: false, message: '游戏已经结束了。' }
  }

  const boardPreset = getPresetForState(state)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps
  // const safeCells = new Set(boardPreset.safeCells)
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

  if (piece.progress <= 0) {
    piece.progress = 1
  } else {
    piece.progress += dice
  }

  let jumped = false
  while (piece.progress >= 1 && piece.progress <= boardPreset.trackLength) {
    const landingCell = getTrackCellIndex(player, piece)
    const jumpTarget = flightJumps.get(landingCell)
    if (jumpTarget === undefined) break

    const jumpDelta = jumpTarget - landingCell
    piece.progress += jumpDelta
    jumped = true
  }

  let captured = 0
  const landingCell = getTrackCellIndex(player, piece)

  if (piece.progress <= boardPreset.trackLength && landingCell >= 0 && !boardPreset.safeCells[player.index].includes(landingCell)) {
    for (const enemy of state.players) {
      if (!enemy.active || enemy.index === player.index) continue

      for (const enemyPiece of enemy.pieces) {
        if (enemyPiece.progress <= 0 || enemyPiece.progress > boardPreset.trackLength) continue

        const enemyCell = getTrackCellIndex(enemy, enemyPiece)
        if (enemyCell === landingCell) {
          enemyPiece.progress = 0
          enemyPiece.finished = false
          captured += 1
        }
      }
    }
  }

  state.dice = 0
  state.legalPieceIds = []

  const finishedCount = player.pieces.filter((item) => item.progress >= finishStep).length
  player.pieces.forEach((item) => {
    item.finished = item.progress >= finishStep
    if (item.finished) item.progress = finishStep
  })

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
  if (state.winnerIndex !== -1) return

  state.dice = 0
  state.legalPieceIds = []
  state.turnPointer = (state.turnPointer + 1) % state.turnOrder.length
  state.currentPlayerIndex = state.turnOrder[state.turnPointer] ?? 0
  state.turnCount += 1
  state.status = `${getCurrentPlayer(state).name} 回合，请掷骰子。`
}

export function resetGame(settings: GameSettings): GameState {
  return createGame(settings)
}

export function getPlayerFinishedCount(player: PlayerState): number {
  const boardPreset = getPresetForPlayer(player)
  const finishStep = boardPreset.trackLength + boardPreset.homeSteps
  return player.pieces.filter((piece) => piece.progress >= finishStep || piece.finished).length
}

export function getPlayerTrackCount(player: PlayerState): number {
  const boardPreset = getPresetForPlayer(player)
  return player.pieces.filter((piece) => piece.progress >= 1 && piece.progress <= boardPreset.trackLength && !piece.finished).length
}

export function isSafeCell(playerIndex: number, cellIndex: number, boardPresetId: BoardPresetId = DEFAULT_BOARD_PRESET_ID): boolean {
  return getPresetForId(boardPresetId).safeCells[playerIndex].includes(cellIndex)
}
