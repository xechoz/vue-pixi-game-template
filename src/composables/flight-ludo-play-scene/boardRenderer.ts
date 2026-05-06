import * as PIXI from 'pixi.js'

import {
  getPieceLocation,
  getTrackCellIndex,
  isSafeCell,
  type BoardPreset,
  type BoardRenderLayout,
  type GameState,
  type PlayerState,
} from '../../game'
import { deriveOuterAnchorPoints } from './boardView'
import type { BoardLayout, LandingPoint, Point } from './types'

type DiceRenderState = {
  isRolling: boolean
  diceSpinScale: number
  diceSpinRotation: number
  diceSpinFlip: number
  diceLandingLift: number
  diceLandingSquash: number
  diceResultPop: number
  diceIdlePulse: number
  diceIdleShake: number
  diceIdleLift: number
  getDiceDisplayValue: () => number
}

type MoveRenderState = {
  replayingPieceId: string
  movePath: number[]
  replayingStartProgress: number
  movingPoint: Point | null
  landingPoint: LandingPoint | null
}

type TurnRenderState = {
  legalPulse: number
  isTurnTransitioning: boolean
  diceHandoffHiding: boolean
  isHumanTurn: () => boolean
}

type RenderPlaySceneOptions = {
  app: PIXI.Application
  scene: PIXI.Container
  layout: BoardLayout
  boardPreset: BoardPreset
  boardRenderLayout: BoardRenderLayout
  game: GameState
  legalPieces: string[]
  winner: PlayerState | null
  autoPlayMode: boolean
  dice: DiceRenderState
  move: MoveRenderState
  turn: TurnRenderState
  onRoll: (fromAuto?: boolean) => void
  onMove: (pieceId: string) => void
  getPlayerPieceTexture: (playerIndex: number) => PIXI.Texture | null
}

type PieceRenderInfo = {
  player: RenderPlaySceneOptions['game']['players'][number]
  piece: RenderPlaySceneOptions['game']['players'][number]['pieces'][number]
  pieceIndex: number
  x: number
  y: number
  location: 'base' | 'track' | 'home' | 'finished'
}

export function hexToNumber(color: string) {
  return Number.parseInt(color.replace('#', ''), 16)
}

const DIE_PIP_GRID = {
  left: -0.24,
  center: 0,
  right: 0.24,
  top: -0.24,
  middle: 0,
  bottom: 0.24,
} as const

const DIE_PIP_LAYOUTS: Record<number, Array<{ x: number; y: number }>> = {
  1: [{ x: DIE_PIP_GRID.center, y: DIE_PIP_GRID.middle }],
  2: [
    { x: DIE_PIP_GRID.left, y: DIE_PIP_GRID.top },
    { x: DIE_PIP_GRID.right, y: DIE_PIP_GRID.bottom },
  ],
  3: [
    { x: DIE_PIP_GRID.left, y: DIE_PIP_GRID.top },
    { x: DIE_PIP_GRID.center, y: DIE_PIP_GRID.middle },
    { x: DIE_PIP_GRID.right, y: DIE_PIP_GRID.bottom },
  ],
  4: [
    { x: DIE_PIP_GRID.left, y: DIE_PIP_GRID.top },
    { x: DIE_PIP_GRID.right, y: DIE_PIP_GRID.top },
    { x: DIE_PIP_GRID.left, y: DIE_PIP_GRID.bottom },
    { x: DIE_PIP_GRID.right, y: DIE_PIP_GRID.bottom },
  ],
  5: [
    { x: DIE_PIP_GRID.left, y: DIE_PIP_GRID.top },
    { x: DIE_PIP_GRID.right, y: DIE_PIP_GRID.top },
    { x: DIE_PIP_GRID.center, y: DIE_PIP_GRID.middle },
    { x: DIE_PIP_GRID.left, y: DIE_PIP_GRID.bottom },
    { x: DIE_PIP_GRID.right, y: DIE_PIP_GRID.bottom },
  ],
  6: [
    { x: DIE_PIP_GRID.left, y: DIE_PIP_GRID.top },
    { x: DIE_PIP_GRID.right, y: DIE_PIP_GRID.top },
    { x: DIE_PIP_GRID.left, y: DIE_PIP_GRID.middle },
    { x: DIE_PIP_GRID.right, y: DIE_PIP_GRID.middle },
    { x: DIE_PIP_GRID.left, y: DIE_PIP_GRID.bottom },
    { x: DIE_PIP_GRID.right, y: DIE_PIP_GRID.bottom },
  ],
}

function buildDiceFaceGraphic(options: {
  size: number
  color: number
  value: number
  isIdle: boolean
  idlePulse: number
  isRolling: boolean
  diceLandingSquash: number
}) {
  const container = new PIXI.Container()
  const faceSize = options.size * 0.92
  const halfFace = faceSize / 2
  const cornerRadius = faceSize * 0.22
  const pipRadius = Math.max(3, faceSize * 0.072)
  const outlineAlpha = options.isIdle
    ? 0.8 + options.idlePulse * 0.14
    : options.isRolling
      ? 0.92
      : 0.88

  const shadow = new PIXI.Graphics()
    .roundRect(
      -halfFace,
      -halfFace + faceSize * 0.05,
      faceSize,
      faceSize,
      cornerRadius,
    )
    .fill({ color: 0x020617, alpha: 0.14 + options.diceLandingSquash * 0.08 })
  container.addChild(shadow)

  const plate = new PIXI.Graphics()
    .roundRect(-halfFace, -halfFace, faceSize, faceSize, cornerRadius)
    .fill({ color: 0xffffff, alpha: 0.98 })
    .stroke({ color: options.color, width: Math.max(2, faceSize * 0.05), alpha: outlineAlpha })
  container.addChild(plate)

  const gloss = new PIXI.Graphics()
    .roundRect(
      -faceSize * 0.28,
      -faceSize * 0.32,
      faceSize * 0.56,
      faceSize * 0.24,
      faceSize * 0.08,
    )
    .fill({ color: 0xffffff, alpha: 0.26 })
  container.addChild(gloss)

  if (options.isIdle) {
    const idleBackdrop = new PIXI.Graphics()
      .circle(0, 0, faceSize * 0.17)
      .fill({ color: options.color, alpha: 0.08 + options.idlePulse * 0.05 })
    container.addChild(idleBackdrop)

    const questionMark = new PIXI.Text({
      text: '?',
      style: {
        fill: options.color,
        fontFamily: 'Trebuchet MS',
        fontSize: faceSize * 0.42,
        fontWeight: '800',
      },
    })
    questionMark.anchor.set(0.5)
    questionMark.position.set(0, -faceSize * 0.02)
    container.addChild(questionMark)
    return container
  }

  for (const pip of DIE_PIP_LAYOUTS[options.value] ?? []) {
    const pipGraphic = new PIXI.Graphics()
      .circle(pip.x * faceSize, pip.y * faceSize, pipRadius)
      .fill({ color: options.color, alpha: 0.98 })
    container.addChild(pipGraphic)
  }

  return container
}

export function resolvePiecePoint(
  layout: BoardLayout,
  boardPreset: BoardPreset,
  player: { index: number; startIndex: number },
  piece: { progress: number },
) {
  const homeEntryStep = boardPreset.trackLength - Math.ceil(boardPreset.stepsPerEdge / 2)
  const finishStep = homeEntryStep + boardPreset.homeSteps

  const centerX = layout.trackPoints[0]?.x ?? 0
  const centerY = layout.trackPoints[0]?.y ?? 0

  if (piece.progress < 0) {
    return layout.baseSlots[player.index]?.[0] ?? { x: centerX, y: centerY }
  }

  if (piece.progress < homeEntryStep) {
    const trackIndex =
      (player.startIndex + piece.progress) % boardPreset.trackLength
    return layout.trackPoints[trackIndex] ?? { x: centerX, y: centerY }
  }

  if (piece.progress < finishStep) {
    const laneIndex = piece.progress - homeEntryStep
    return (
      layout.finishSlots[player.index]?.[laneIndex] ?? {
        x: centerX,
        y: centerY,
      }
    )
  }

  return (
    layout.finishSlots[player.index]?.[boardPreset.homeSteps - 1] ?? {
      x: centerX,
      y: centerY,
    }
  )
}

export function getPlayerByPieceId(state: GameState, pieceId: string) {
  return (
    state.players.find((player) =>
      player.pieces.some((piece) => piece.id === pieceId),
    ) ?? null
  )
}

export function getStackOffsets(count: number, step: number) {
  const patterns = [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
    { x: -2, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: -2 },
    { x: 0, y: 2 },
  ] as const

  return Array.from({ length: count }, (_, index) => {
    const pattern =
      patterns[index] ?? {
        x: (index % 5) - 2,
        y: Math.floor(index / 5) - 1,
      }

    return {
      x: pattern.x * step,
      y: pattern.y * step,
    }
  })
}

function getPaddedPointBounds(points: Point[], padding: number) {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxY = Math.max(...points.map((point) => point.y))

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}

function drawDottedPolyline(
  graphics: PIXI.Graphics,
  points: Point[],
  options: {
    color: number
    alpha: number
    dotRadius: number
    dotSpacing: number
    closed?: boolean
  },
) {
  if (points.length === 0) return

  const drawDot = (x: number, y: number) => {
    graphics.circle(x, y, options.dotRadius).fill({
      color: options.color,
      alpha: options.alpha,
    })
  }

  drawDot(points[0].x, points[0].y)

  const segmentCount = options.closed ? points.length : points.length - 1
  for (let index = 0; index < segmentCount; index += 1) {
    const from = points[index]
    const to = points[(index + 1) % points.length]
    const dx = to.x - from.x
    const dy = to.y - from.y
    const distance = Math.hypot(dx, dy)
    const steps = Math.max(1, Math.floor(distance / options.dotSpacing))

    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps
      drawDot(from.x + dx * t, from.y + dy * t)
    }
  }
}

const STATIC_LAYER_NAME = 'flight-ludo-static-layer'
const DYNAMIC_LAYER_NAME = 'flight-ludo-dynamic-layer'
const DYNAMIC_OVERLAY_LAYER_NAME = 'flight-ludo-dynamic-overlay-layer'
const DYNAMIC_PIECES_LAYER_NAME = 'flight-ludo-dynamic-pieces-layer'
const PIECE_GLOW_NAME = 'flight-ludo-piece-glow'
const PIECE_BODY_NAME = 'flight-ludo-piece-body'

type SceneRenderState = {
  staticBoardKey: string
  pieceGroups: Map<string, PIXI.Container>
}

const sceneRenderStates = new WeakMap<PIXI.Container, SceneRenderState>()

function clearContainer(container: PIXI.Container) {
  const removable = container.removeChildren()
  for (const child of removable) {
    child.destroy({ children: true })
  }
}

function getSceneRenderState(scene: PIXI.Container) {
  let state = sceneRenderStates.get(scene)
  if (!state) {
    state = {
      staticBoardKey: '',
      pieceGroups: new Map<string, PIXI.Container>(),
    }
    sceneRenderStates.set(scene, state)
  }

  return state
}

function findNamedChild(container: PIXI.Container, name: string) {
  return container.children.find((child) => child.label === name) ?? null
}

function getOrCreateSceneLayer(scene: PIXI.Container, name: string) {
  const existing = findNamedChild(scene, name)
  if (existing instanceof PIXI.Container) {
    return existing
  }

  const layer = new PIXI.Container()
  layer.label = name
  scene.addChild(layer)
  return layer
}

function syncPieceGlow(options: {
  pieceGroup: PIXI.Container
  isVisible: boolean
  pieceRadius: number
  color: string
  legalPulse: number
}) {
  const existingGlow = findNamedChild(options.pieceGroup, PIECE_GLOW_NAME)
  let glow: PIXI.Graphics
  if (existingGlow instanceof PIXI.Graphics) {
    glow = existingGlow
  } else {
    if (existingGlow) {
      options.pieceGroup.removeChild(existingGlow)
      existingGlow.destroy({ children: true })
    }
    glow = new PIXI.Graphics()
    glow.label = PIECE_GLOW_NAME
    options.pieceGroup.addChildAt(glow, 0)
  }

  if (!options.isVisible) {
    glow.visible = false
    glow.clear()
    return
  }

  glow.visible = true
  glow.clear()
  glow.circle(0, 0, options.pieceRadius + 6).stroke({
    color: hexToNumber(options.color),
    width: 2,
    alpha: 0.12 + options.legalPulse * 0.16,
  })
}

function syncPieceBody(options: {
  pieceGroup: PIXI.Container
  texture: PIXI.Texture | null
  tint: number
  pieceRadius: number
  pieceBodyScale: number
  isBasePiece: boolean
}) {
  const existingBody = findNamedChild(options.pieceGroup, PIECE_BODY_NAME)

  if (options.texture) {
    let body: PIXI.Sprite
    if (existingBody instanceof PIXI.Sprite) {
      body = existingBody
    } else {
      if (existingBody) {
        options.pieceGroup.removeChild(existingBody)
        existingBody.destroy({ children: true })
      }
      body = new PIXI.Sprite(options.texture)
      body.label = PIECE_BODY_NAME
      options.pieceGroup.addChild(body)
    }

    body.texture = options.texture
    body.anchor.set(0.5)
    body.position.set(0, options.isBasePiece ? -3 : -1.5)
    body.width = options.pieceRadius * options.pieceBodyScale
    body.height = options.pieceRadius * options.pieceBodyScale
    body.tint = 0xffffff
    return
  }

  let body: PIXI.Graphics
  if (existingBody instanceof PIXI.Graphics) {
    body = existingBody
  } else {
    if (existingBody) {
      options.pieceGroup.removeChild(existingBody)
      existingBody.destroy({ children: true })
    }
    body = new PIXI.Graphics()
    body.label = PIECE_BODY_NAME
    options.pieceGroup.addChild(body)
  }

  body.clear()
  body
    .circle(0, 0, options.pieceRadius + 5)
    .fill({ color: options.tint, alpha: 1 })
    .stroke({ color: 0xffffff, width: 2, alpha: 0.88 })
}

function removeStalePieceGroups(
  piecesLayer: PIXI.Container,
  sceneState: SceneRenderState,
  activePieceIds: Set<string>,
) {
  for (const [pieceId, pieceGroup] of Array.from(sceneState.pieceGroups.entries())) {
    if (activePieceIds.has(pieceId)) continue
    if (pieceGroup.parent === piecesLayer) {
      piecesLayer.removeChild(pieceGroup)
    }
    pieceGroup.destroy({ children: true })
    sceneState.pieceGroups.delete(pieceId)
  }
}

function buildStaticBoardKey(options: {
  width: number
  height: number
  safeBoardSize: number
  boardPresetId: string
  boardPreset: BoardPreset
  boardRenderLayout: BoardRenderLayout
  game: GameState
}) {
  const playerSignature = options.game.players
    .map((player) => `${player.index}:${player.color}:${player.startIndex}`)
    .join('|')

  return [
    options.width,
    options.height,
    options.safeBoardSize,
    options.boardPresetId,
    options.boardPreset.trackLength,
    options.boardPreset.stepsPerEdge,
    options.boardPreset.homeSteps,
    options.boardRenderLayout.trackInsetRatio,
    options.boardRenderLayout.baseZonePaddingRatio,
    options.boardRenderLayout.finishGapRatio,
    options.boardRenderLayout.finishBoxSizeRatio,
    playerSignature,
  ].join(':')
}

export function renderPlayScene(options: RenderPlaySceneOptions) {
  const staticLayer = getOrCreateSceneLayer(options.scene, STATIC_LAYER_NAME)
  const dynamicLayer = getOrCreateSceneLayer(options.scene, DYNAMIC_LAYER_NAME)
  for (const child of options.scene.children.slice()) {
    if (child !== staticLayer && child !== dynamicLayer) {
      options.scene.removeChild(child)
      child.destroy({ children: true })
    }
  }
  options.scene.setChildIndex(staticLayer, 0)
  options.scene.setChildIndex(dynamicLayer, 1)

  const { width, height } = options.app.screen
  const boardSize = Math.min(width, height) - 20
  const safeBoardSize = Math.max(240, boardSize)
  const originX = (width - safeBoardSize) / 2
  const originY = (height - safeBoardSize) / 2
  const cellSize = safeBoardSize * 0.06
  const trackSize = cellSize * 0.68
  const pieceRadius = cellSize * 0.28
  const trackPieceBodyScale = 7.2
  const basePieceBodyScale = 8.15
  const basePlaneBoundsPadding = Math.max(
    pieceRadius + 7,
    (pieceRadius * basePieceBodyScale) / 2 + 3,
  )

  const centerX = originX + safeBoardSize / 2
  const centerY = originY + safeBoardSize / 2

  const layout = options.layout
  const { trackPoints, baseSlots, finishSlots, outerBorderPoints, homeEntryPoints } = layout
  const outerAnchorPoints = deriveOuterAnchorPoints(trackPoints)
  const homeEntryStep =
    options.boardPreset.trackLength - Math.ceil(options.boardPreset.stepsPerEdge / 2)

  const sceneState = getSceneRenderState(options.scene)
  const staticBoardKey = buildStaticBoardKey({
    width,
    height,
    safeBoardSize,
    boardPresetId: options.game.boardPresetId,
    boardPreset: options.boardPreset,
    boardRenderLayout: options.boardRenderLayout,
    game: options.game,
  })

  if (sceneState.staticBoardKey !== staticBoardKey) {
    clearContainer(staticLayer)

    // Draw the raw track cells first. These cells are the actual movement path.
    for (let index = 0; index < trackPoints.length; index += 1) {
      const point = trackPoints[index]
      const cell = new PIXI.Graphics()
      const playerIndex =
        Math.floor(index / options.boardPreset.stepsPerEdge) %
        options.game.players.length
      const activeColor = options.game.players[playerIndex].color
      const isStartCell = index % options.boardPreset.stepsPerEdge === 0
      const isSafeTrackCell = isSafeCell(playerIndex, index, options.game.boardPresetId)
      cell
        .roundRect(
          point.x - trackSize / 2,
          point.y - trackSize / 2,
          trackSize,
          trackSize,
          9,
        )
        .fill({
          color: isSafeTrackCell ? 0xf8fafc : 0xe2e8f0,
          alpha: isSafeTrackCell ? 0.16 : 0.07,
        })
        .stroke({
          color: activeColor,
          width: isStartCell ? 3 : isSafeTrackCell ? 2 : 1,
          alpha: isSafeTrackCell ? 0.55 : 0.35,
        })
      staticLayer.addChild(cell)
    }

    const outerBorderGuide = new PIXI.Graphics()
    drawDottedPolyline(outerBorderGuide, outerBorderPoints, {
      color: 0xf59e0b,
      alpha: 0.48,
      dotRadius: Math.max(2.2, trackSize * 0.08),
      dotSpacing: trackSize * 0.72,
      closed: true,
    })
    staticLayer.addChild(outerBorderGuide)

    for (const player of options.game.players) {
      const finish = finishSlots[player.index]
      const finishGuide = new PIXI.Graphics()
      drawDottedPolyline(finishGuide, finish, {
        color: hexToNumber(player.color),
        alpha: 0.35,
        dotRadius: Math.max(2, trackSize * 0.09),
        dotSpacing: trackSize * 0.65,
      })
      staticLayer.addChild(finishGuide)

      const finishBoxRadius =
        safeBoardSize * options.boardRenderLayout.finishBoxSizeRatio
      for (const [laneIndex, lanePoint] of finish.entries()) {
        const laneCell = new PIXI.Graphics()
        laneCell
          .roundRect(
            lanePoint.x - finishBoxRadius,
            lanePoint.y - finishBoxRadius,
            finishBoxRadius * 2,
            finishBoxRadius * 2,
            12,
          )
          .fill({
            color: player.color,
            alpha: laneIndex === finish.length - 1 ? 0.13 : 0.08,
          })
          .stroke({
            color: player.color,
            width: laneIndex === finish.length - 1 ? 2 : 1,
            alpha: laneIndex === finish.length - 1 ? 0.35 : 0.24,
          })
        staticLayer.addChild(laneCell)
      }

      const entryPoint = homeEntryPoints[player.index]
      if (entryPoint && finish.length > 0) {
        const homeConnector = new PIXI.Graphics()
        drawDottedPolyline(homeConnector, [entryPoint, finish[0], ...finish.slice(1)], {
          color: hexToNumber(player.color),
          alpha: 0.34,
          dotRadius: Math.max(2, trackSize * 0.075),
          dotSpacing: trackSize * 0.48,
        })
        staticLayer.addChild(homeConnector)
      }

      if (player.index === 0) {
        const baseBounds = getPaddedPointBounds(
          baseSlots[player.index],
          basePlaneBoundsPadding,
        )
        const baseAnchor = {
          x: baseBounds.x + baseBounds.width / 2,
          y: baseBounds.y + baseBounds.height / 2,
        }
        const redRoutePoints = [
          ...trackPoints.slice(player.startIndex, homeEntryStep),
          entryPoint ?? trackPoints[homeEntryStep] ?? trackPoints[0],
          ...finish,
        ]
        const redRoute = new PIXI.Graphics()
        drawDottedPolyline(redRoute, redRoutePoints, {
          color: 0xffd400,
          alpha: 0.42,
          dotRadius: Math.max(2, trackSize * 0.08),
          dotSpacing: trackSize * 0.55,
        })
        staticLayer.addChild(redRoute)

        const redAnchorLabels = [
          { point: baseAnchor, label: '0' },
          ...outerAnchorPoints.map((point, index) => ({
            point,
            label: String(index + 1),
          })),
        ]

        redAnchorLabels.forEach(({ point, label: text }) => {
          const label = new PIXI.Text({
            text,
            style: {
              fontFamily: 'Arial, sans-serif',
              fontSize: Math.max(11, Math.round(trackSize * 0.34)),
              fill: '#111827',
              fontWeight: '700',
              align: 'center',
              stroke: { color: '#ffffff', width: 4, alpha: 0.95 },
              dropShadow: false,
            },
          })
          label.anchor.set(0.5)
          label.position.set(point.x, point.y - trackSize * 0.12)
          staticLayer.addChild(label)
        })
      }
    }

    sceneState.staticBoardKey = staticBoardKey
  }

  const overlayLayer = getOrCreateSceneLayer(dynamicLayer, DYNAMIC_OVERLAY_LAYER_NAME)
  const piecesLayer = getOrCreateSceneLayer(dynamicLayer, DYNAMIC_PIECES_LAYER_NAME)
  for (const child of dynamicLayer.children.slice()) {
    if (child !== overlayLayer && child !== piecesLayer) {
      dynamicLayer.removeChild(child)
      child.destroy({ children: true })
    }
  }
  dynamicLayer.setChildIndex(overlayLayer, 0)
  dynamicLayer.setChildIndex(piecesLayer, 1)
  clearContainer(overlayLayer)
  const board = overlayLayer

  // The orange dotted overlay is UI-only. It helps explain the route shape,
  // but it does not affect movement rules.

  const canRoll =
    options.game.winnerIndex === -1 &&
    options.game.dice === 0 &&
    !options.turn.isTurnTransitioning &&
    options.move.movingPoint === null &&
    (options.turn.isHumanTurn() || !options.autoPlayMode)

  for (const player of options.game.players) {
    const playerBase = new PIXI.Graphics()
    const baseBounds = getPaddedPointBounds(
      baseSlots[player.index],
      basePlaneBoundsPadding,
    )

    const isActivePlayer = options.game.currentPlayerIndex === player.index
    playerBase
      .roundRect(
        baseBounds.x,
        baseBounds.y,
        baseBounds.width,
        baseBounds.height,
        14,
      )
      .fill({ color: player.color, alpha: isActivePlayer ? 0.1 : 0.07 })
      .stroke({
        color: player.color,
        width: isActivePlayer ? 3 : 2,
        alpha: isActivePlayer ? 0.3 : 0.2,
      })
    board.addChild(playerBase)

    if (isActivePlayer && canRoll) {
      playerBase.eventMode = 'static'
      playerBase.cursor = 'pointer'
      playerBase.hitArea = new PIXI.Rectangle(
        baseBounds.x,
        baseBounds.y,
        baseBounds.width,
        baseBounds.height,
      )
      playerBase.on('pointerdown', () => options.onRoll(false))
    }
  }

  const hideHandoffDice =
    (options.turn.diceHandoffHiding || options.turn.isTurnTransitioning) &&
    !options.dice.isRolling &&
    options.game.dice === 0

  if (!hideHandoffDice) {
    const center = new PIXI.Container()
    center.position.set(centerX, centerY)
    center.eventMode = 'passive'
    center.cursor = 'default'
    board.addChild(center)

    const diceSize = safeBoardSize * 0.18
    const currentPlayer = options.game.players[options.game.currentPlayerIndex]
    const currentPlayerColor = hexToNumber(currentPlayer.color)
    const diceValue = options.dice.getDiceDisplayValue()
    const isIdleDiceState =
      !options.dice.isRolling && options.game.dice === 0

    const diceGroup = new PIXI.Container()
    diceGroup.eventMode = canRoll ? 'static' : 'passive'
    diceGroup.cursor = canRoll ? 'pointer' : 'default'
    diceGroup.hitArea = new PIXI.Rectangle(
      -diceSize * 0.95,
      -diceSize * 0.95,
      diceSize * 1.9,
      diceSize * 1.9,
    )
    if (canRoll) {
      diceGroup.on('pointerdown', () => options.onRoll(false))
    }

    center.addChild(diceGroup)

    const faceSize = diceSize * 0.72
    const fittedHeight = diceSize * 0.98
    const fittedWidth = diceSize * 0.92
    const diceShadow = new PIXI.Graphics()
      .ellipse(
        0,
        fittedHeight * (0.36 + options.dice.diceLandingSquash * 0.08),
        fittedWidth * 0.24 * (1 + options.dice.diceLandingSquash * 0.45 + (options.dice.isRolling ? 0.06 : 0)),
        fittedHeight * 0.08 * (1 + options.dice.diceLandingSquash * 0.35),
      )
      .fill({
        color: 0x020617,
        alpha:
          0.16 +
          (options.dice.isRolling ? 0.08 : 0.02) +
          options.dice.diceLandingSquash * 0.14,
      })
    diceGroup.addChild(diceShadow)

    const diceFace = buildDiceFaceGraphic({
      size: diceSize,
      color: currentPlayerColor,
      value: Math.min(6, Math.max(1, diceValue || 1)),
      isIdle: isIdleDiceState,
      idlePulse: options.dice.diceIdlePulse,
      isRolling: options.dice.isRolling,
      diceLandingSquash: options.dice.diceLandingSquash,
    })
    diceGroup.addChild(diceFace)

    if (!options.dice.isRolling && isIdleDiceState) {
      const promptGlow = new PIXI.Graphics()
        .roundRect(
          -faceSize * 0.18,
          faceSize * 0.09,
          faceSize * 0.36,
          faceSize * 0.2,
          faceSize * 0.08,
        )
        .fill({
          color: 0xffffff,
          alpha: 0.14 + options.dice.diceIdlePulse * 0.08,
        })
      diceGroup.addChild(promptGlow)
    }

    const settleFlashAlpha =
      !options.dice.isRolling && !isIdleDiceState
        ? Math.max(
            0,
            Math.min(
              0.18,
              options.dice.diceLandingSquash * 0.32 +
                options.dice.diceLandingLift * 0.004,
            ),
          )
        : 0
    if (settleFlashAlpha > 0.001) {
      const settleFlash = new PIXI.Graphics()
        .roundRect(
          -fittedWidth * 0.33,
          -fittedHeight * 0.33,
          fittedWidth * 0.66,
          fittedHeight * 0.24,
          fittedWidth * 0.08,
        )
        .fill({ color: 0xffffff, alpha: settleFlashAlpha })
      diceGroup.addChild(settleFlash)
    }

    const diceScaleBoost =
      1 +
      options.dice.diceIdlePulse * 0.05 +
      (options.dice.isRolling ? 0.05 : 0)
    const shakeX =
      options.dice.diceIdleShake * (options.dice.isRolling ? 4.5 : 3)
    const shakeY =
      Math.sin(options.dice.diceIdleShake * Math.PI * 0.5) * 2.2
    const landingScaleX =
      1 +
      options.dice.diceLandingSquash * 0.34 +
      options.dice.diceResultPop * 0.08
    const landingScaleY =
      1 -
      options.dice.diceLandingSquash * 0.24 +
      options.dice.diceResultPop * 0.04
    const landingSettleNudge =
      !options.dice.isRolling && !isIdleDiceState
        ? Math.max(0, options.dice.diceLandingSquash * 0.1)
        : 0
    const spinScaleX =
      options.dice.diceSpinScale *
      diceScaleBoost *
      (options.dice.isRolling ? options.dice.diceSpinFlip : 1) *
      landingScaleX
    const spinScaleY =
      options.dice.diceSpinScale *
      diceScaleBoost *
      (options.dice.isRolling
        ? 1 + (1 - options.dice.diceSpinFlip) * 0.22
        : 1) *
      landingScaleY
    diceGroup.position.set(
      shakeX,
      shakeY -
        options.dice.diceIdleLift -
        options.dice.diceLandingLift +
        landingSettleNudge * fittedHeight * 0.08,
    )
    diceGroup.rotation = options.dice.diceSpinRotation
    diceGroup.scale.set(spinScaleX, spinScaleY)
  }

  if (options.winner) {
    const banner = new PIXI.Graphics()
      .roundRect(
        originX + safeBoardSize * 0.18,
        originY + safeBoardSize * 0.36,
        safeBoardSize * 0.64,
        safeBoardSize * 0.16,
        24,
      )
      .fill({ color: 0x020617, alpha: 0.9 })
      .stroke({ color: options.winner.color, width: 3, alpha: 0.9 })
    board.addChild(banner)
  }

  if (options.move.landingPoint) {
    const pulse = new PIXI.Graphics()
      .circle(
        options.move.landingPoint.x,
        options.move.landingPoint.y,
        pieceRadius * 1.25,
      )
      .stroke({
        color: hexToNumber(options.move.landingPoint.color),
        width: 3,
        alpha: 0.35,
      })
    board.addChild(pulse)
  }

  if (options.move.replayingPieceId && options.move.movePath.length > 0) {
    const player = getPlayerByPieceId(
      options.game,
      options.move.replayingPieceId,
    )
    const piece = player?.pieces.find(
      (item) => item.id === options.move.replayingPieceId,
    )
    if (player && piece) {
      const startP =
        options.move.replayingStartProgress !== -1
          ? options.move.replayingStartProgress
          : piece.progress
      const pathPoints = [
        resolvePiecePoint(layout, options.boardPreset, player, {
          progress: startP,
        }),
        ...options.move.movePath.map((progress) =>
          resolvePiecePoint(layout, options.boardPreset, player, { progress }),
        ),
      ]

      const trail = new PIXI.Graphics()
      trail.moveTo(pathPoints[0].x, pathPoints[0].y)
      for (const point of pathPoints.slice(1)) {
        trail.lineTo(point.x, point.y)
      }
      trail.stroke({ color: player.color, width: 5, alpha: 0.45 })
      board.addChild(trail)

      const arcLift = Math.max(4, pieceRadius * 0.75)
      for (let index = 1; index < pathPoints.length; index += 1) {
        const point = pathPoints[index]
        const prev = pathPoints[index - 1]
        const midX = (prev.x + point.x) / 2
        const midY = (prev.y + point.y) / 2 - arcLift
        const arcTrail = new PIXI.Graphics()
        arcTrail.moveTo(prev.x, prev.y)
        arcTrail.quadraticCurveTo(midX, midY, point.x, point.y)
        arcTrail.stroke({ color: player.color, width: 4, alpha: 0.28 })
        board.addChild(arcTrail)

        const marker = new PIXI.Graphics()
          .circle(point.x, point.y, 8)
          .fill({ color: 0xffffff, alpha: 0.14 })
          .stroke({ color: player.color, width: 2, alpha: 0.6 })
        board.addChild(marker)
      }
    }
  }

  const pieces: PieceRenderInfo[] = options.game.players.flatMap((player) =>
    player.pieces.map((piece, pieceIndex) => {
      const location = getPieceLocation(player, piece)
      let x = originX + safeBoardSize / 2
      let y = originY + safeBoardSize / 2

      if (location === 'base') {
        const slot =
          baseSlots[player.index][pieceIndex] ?? baseSlots[player.index][0]
        x = slot.x
        y = slot.y
      } else if (location === 'track') {
        const trackIndex = getTrackCellIndex(player, piece)
        if (trackIndex !== -1) {
          const point = trackPoints[trackIndex]
          x = point.x
          y = point.y
        }
      } else {
        const slot =
          finishSlots[player.index][pieceIndex] ?? finishSlots[player.index][0]
        x = slot.x
        y = slot.y
      }

      if (
        options.move.landingPoint &&
        options.move.landingPoint.color === player.color &&
        piece.progress >= 0
      ) {
        const dx = x - options.move.landingPoint.x
        const dy = y - options.move.landingPoint.y
        if (Math.hypot(dx, dy) < pieceRadius * 4) {
          x += dx * 0.08
          y += dy * 0.08
        }
      }

      return { player, piece, pieceIndex, x, y, location }
    }),
  )

  const stackStep = Math.max(2, Math.round(pieceRadius * 0.2))
  const stackGroups = new Map<string, number[]>()
  const getStackKey = (pieceInfo: (typeof pieces)[number]) =>
    [
      pieceInfo.location,
      pieceInfo.x.toFixed(2),
      pieceInfo.y.toFixed(2),
    ].join('|')

  pieces.forEach((pieceInfo, index) => {
    const key = getStackKey(pieceInfo)
    const bucket = stackGroups.get(key)
    if (bucket) {
      bucket.push(index)
    } else {
      stackGroups.set(key, [index])
    }
  })

  const stackIndexByPiece = new Map<number, number>()
  const stackSizeByPiece = new Map<number, number>()
  for (const indices of stackGroups.values()) {
    indices.forEach((pieceIndex, stackIndex) => {
      stackIndexByPiece.set(pieceIndex, stackIndex)
      stackSizeByPiece.set(pieceIndex, indices.length)
    })
  }

  const activePieceIds = new Set<string>()

  for (const [index, pieceInfo] of pieces.entries()) {
    activePieceIds.add(pieceInfo.piece.id)
    const isLegal =
      options.game.winnerIndex === -1 &&
      options.legalPieces.includes(pieceInfo.piece.id)
    const isMoving =
      options.move.replayingPieceId === pieceInfo.piece.id &&
      options.move.movingPoint !== null
    const movingPosition = options.move.movingPoint
    const stackIndex = stackIndexByPiece.get(index) ?? 0
    const stackSize = stackSizeByPiece.get(index) ?? 1
    const stackOffsets =
      stackSize > 1 ? getStackOffsets(stackSize, stackStep) : [{ x: 0, y: 0 }]
    const stackOffset = stackOffsets[stackIndex] ?? { x: 0, y: 0 }
    let pieceGroup = sceneState.pieceGroups.get(pieceInfo.piece.id)
    if (!pieceGroup) {
      pieceGroup = new PIXI.Container()
      pieceGroup.label = `flight-ludo-piece-${pieceInfo.piece.id}`
      sceneState.pieceGroups.set(pieceInfo.piece.id, pieceGroup)
      piecesLayer.addChild(pieceGroup)
    } else if (pieceGroup.parent !== piecesLayer) {
      piecesLayer.addChild(pieceGroup)
    }

    pieceGroup.position.set(
      (isMoving && movingPosition ? movingPosition.x : pieceInfo.x) + stackOffset.x,
      (isMoving && movingPosition ? movingPosition.y : pieceInfo.y) + stackOffset.y,
    )
    pieceGroup.eventMode = isLegal && !isMoving ? 'static' : 'passive'
    pieceGroup.cursor = isLegal && !isMoving ? 'pointer' : 'default'
    pieceGroup.removeAllListeners()

    if (isLegal && !isMoving) {
      pieceGroup.on('pointerdown', () => options.onMove(pieceInfo.piece.id))
    }

    syncPieceGlow({
      pieceGroup,
      isVisible: isLegal && !isMoving,
      pieceRadius,
      color: pieceInfo.player.color,
      legalPulse: options.turn.legalPulse,
    })

    const tint = hexToNumber(pieceInfo.player.color)
    const texture = options.getPlayerPieceTexture(pieceInfo.player.index)
    const pieceBodyScale =
      pieceInfo.location === 'base'
        ? basePieceBodyScale
        : trackPieceBodyScale
    syncPieceBody({
      pieceGroup,
      texture,
      tint,
      pieceRadius,
      pieceBodyScale,
      isBasePiece: pieceInfo.location === 'base',
    })

    if (piecesLayer.getChildIndex(pieceGroup) !== index) {
      piecesLayer.setChildIndex(pieceGroup, index)
    }
  }

  removeStalePieceGroups(piecesLayer, sceneState, activePieceIds)

  return layout
}
