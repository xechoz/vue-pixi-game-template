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
import { buildBoardLayout } from './boardLayout'
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
  diceIdleTexture: PIXI.Texture | null
  getDiceDisplayValue: () => number
  getDiceFaceAssetTexture: (value: number) => PIXI.Texture | null
  getRollingDiceAssetTexture: () => PIXI.Texture | null
  getIdleDiceAssetTexture: () => PIXI.Texture | null
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

export function hexToNumber(color: string) {
  return Number.parseInt(color.replace('#', ''), 16)
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

export function renderPlayScene(options: RenderPlaySceneOptions) {
  const removable = options.scene.removeChildren()
  for (const child of removable) {
    child.destroy({ children: true })
  }

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

  const board = new PIXI.Container()
  options.scene.addChild(board)

  const centerX = originX + safeBoardSize / 2
  const centerY = originY + safeBoardSize / 2

  const layout = buildBoardLayout(
    originX,
    originY,
    safeBoardSize,
    options.boardPreset,
    options.boardRenderLayout,
  )
  const { trackPoints, baseSlots, finishSlots, outerBorderPoints, homeEntryPoints } = layout
  const outerAnchorPoints = deriveOuterAnchorPoints(trackPoints)
  const homeEntryStep =
    options.boardPreset.trackLength - Math.ceil(options.boardPreset.stepsPerEdge / 2)

  let activeDiceAnchor = { x: centerX, y: centerY }

  // Draw the raw track cells first. These cells are the actual movement path.
  for (let index = 0; index < trackPoints.length; index += 1) {
    const point = trackPoints[index]
    const cell = new PIXI.Graphics()
    const playerIndex =
      Math.floor(index / options.boardPreset.stepsPerEdge) %
      options.game.players.length
    const activeColor = options.game.players[playerIndex].color
    const isStartCell = index % options.boardPreset.stepsPerEdge === 0
    const isSafeTrackCell = isSafeCell(index, options.game.boardPresetId)
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
    board.addChild(cell)
  }

  const outerBorderGuide = new PIXI.Graphics()
  drawDottedPolyline(outerBorderGuide, outerBorderPoints, {
    color: 0xf59e0b,
    alpha: 0.48,
    dotRadius: Math.max(2.2, trackSize * 0.08),
    dotSpacing: trackSize * 0.72,
    closed: true,
  })
  board.addChild(outerBorderGuide)

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

    if (isActivePlayer) {
      const diceHalf = safeBoardSize * 0.09
      const diceGap = safeBoardSize * 0.012
      const diceYOffset = baseBounds.height / 2
      activeDiceAnchor = {
        x:
          player.index === 0 || player.index === 3
            ? baseBounds.x + baseBounds.width + diceHalf + diceGap
            : baseBounds.x - diceHalf - diceGap,
        y: baseBounds.y + diceYOffset,
      }
    }

    const finish = finishSlots[player.index]
    const finishGuide = new PIXI.Graphics()
    drawDottedPolyline(finishGuide, finish, {
      color: hexToNumber(player.color),
      alpha: 0.35,
      dotRadius: Math.max(2, trackSize * 0.09),
      dotSpacing: trackSize * 0.65,
    })
    board.addChild(finishGuide)

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
      board.addChild(laneCell)
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
      board.addChild(homeConnector)
    }

    if (player.index === 0) {
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
      board.addChild(redRoute)

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
        board.addChild(label)
      })
    }
  }

  const hideHandoffDice =
    (options.turn.diceHandoffHiding || options.turn.isTurnTransitioning) &&
    !options.dice.isRolling &&
    options.game.dice === 0

  if (!hideHandoffDice) {
    const center = new PIXI.Container()
    center.position.set(activeDiceAnchor.x, activeDiceAnchor.y)
    center.eventMode = 'passive'
    center.cursor = 'default'
    board.addChild(center)

    const diceSize = safeBoardSize * 0.18
    const diceValue = options.dice.getDiceDisplayValue()
    const isIdleDiceState =
      !options.dice.isRolling && options.game.dice === 0
    const rollingDiceAssetTexture = options.dice.getRollingDiceAssetTexture()
    const settledDiceAssetTexture =
      options.dice.getDiceFaceAssetTexture(diceValue)
    const idleDiceAssetTexture = options.dice.getIdleDiceAssetTexture()
    const useDiceAssetRender =
      rollingDiceAssetTexture !== null ||
      settledDiceAssetTexture !== null ||
      idleDiceAssetTexture !== null

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

    if (useDiceAssetRender) {
      const assetTexture =
        rollingDiceAssetTexture ??
        settledDiceAssetTexture ??
        idleDiceAssetTexture
      if (assetTexture) {
        const textureWidth = assetTexture.width || 1
        const textureHeight = assetTexture.height || 1
        const fittedHeight = diceSize * 0.98
        const fittedWidth = Math.max(
          diceSize * 0.8,
          (fittedHeight * textureWidth) / textureHeight,
        )

        const diceSprite = new PIXI.Sprite(assetTexture)
        diceSprite.anchor.set(0.5)
        diceSprite.width = fittedWidth
        diceSprite.height = fittedHeight
        diceGroup.addChild(diceSprite)

        if (
          !options.dice.isRolling &&
          isIdleDiceState &&
          options.dice.diceIdleTexture
        ) {
          const idleFaceBlur = new PIXI.Graphics()
            .roundRect(
              -fittedWidth * 0.36,
              -fittedHeight * 0.36,
              fittedWidth * 0.72,
              fittedHeight * 0.72,
              fittedWidth * 0.12,
            )
            .fill({ color: 0xffffff, alpha: 0.3 })
          diceGroup.addChild(idleFaceBlur)

          const overlayWidth = fittedWidth * 0.8
          const overlayHeight = fittedHeight * 0.8
          const overlayCenterY = -overlayHeight * 0.02

          const idleOverlaySprite = new PIXI.Sprite(
            options.dice.diceIdleTexture,
          )
          idleOverlaySprite.anchor.set(0.5)
          idleOverlaySprite.position.set(0, overlayCenterY)
          idleOverlaySprite.width = overlayWidth
          idleOverlaySprite.height = overlayHeight
          idleOverlaySprite.alpha = 1
          diceGroup.addChild(idleOverlaySprite)
        }

        const landingShadowScale =
          1 +
          options.dice.diceLandingSquash * 0.45 +
          (options.dice.isRolling ? 0.06 : 0)
        const landingShadowOffset =
          fittedHeight * (0.36 + options.dice.diceLandingSquash * 0.08)
        const shadowAlpha =
          0.16 +
          (options.dice.isRolling ? 0.08 : 0.02) +
          options.dice.diceLandingSquash * 0.14
        const diceShadow = new PIXI.Graphics()
          .ellipse(
            0,
            landingShadowOffset,
            fittedWidth * 0.24 * landingShadowScale,
            fittedHeight * 0.08 * (1 + options.dice.diceLandingSquash * 0.35),
          )
          .fill({ color: 0x020617, alpha: shadowAlpha })
        diceGroup.addChildAt(diceShadow, 0)

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
    }
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

  const pieces = options.game.players.flatMap((player) =>
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

  for (const pieceInfo of pieces) {
    const isLegal =
      options.game.winnerIndex === -1 &&
      options.legalPieces.includes(pieceInfo.piece.id)
    const isMoving =
      options.move.replayingPieceId === pieceInfo.piece.id &&
      options.move.movingPoint !== null
    const movingPosition = options.move.movingPoint
    const pieceGroup = new PIXI.Container()
    pieceGroup.position.set(
      isMoving && movingPosition ? movingPosition.x : pieceInfo.x,
      isMoving && movingPosition ? movingPosition.y : pieceInfo.y,
    )
    pieceGroup.eventMode = isLegal && !isMoving ? 'static' : 'passive'
    pieceGroup.cursor = isLegal && !isMoving ? 'pointer' : 'default'

    if (isLegal && !isMoving) {
      pieceGroup.on('pointerdown', () => options.onMove(pieceInfo.piece.id))
    }

    if (isLegal && !isMoving) {
      const legalGlow = new PIXI.Graphics()
        .circle(0, 0, pieceRadius + 6)
        .stroke({
          color: hexToNumber(pieceInfo.player.color),
          width: 2,
          alpha: 0.12 + options.turn.legalPulse * 0.16,
        })
      pieceGroup.addChildAt(legalGlow, 0)
    }

    const tint = hexToNumber(pieceInfo.player.color)
    const texture = options.getPlayerPieceTexture(pieceInfo.player.index)
    const pieceBodyScale =
      pieceInfo.location === 'base'
        ? basePieceBodyScale
        : trackPieceBodyScale
    if (texture) {
      const body = new PIXI.Sprite(texture)
      body.anchor.set(0.5)
      body.position.set(0, pieceInfo.location === 'base' ? -3 : -1.5)
      body.width = pieceRadius * pieceBodyScale
      body.height = pieceRadius * pieceBodyScale
      pieceGroup.addChild(body)
    } else {
      const body = new PIXI.Graphics()
        .circle(0, 0, pieceRadius + 5)
        .fill({ color: tint, alpha: 1 })
        .stroke({ color: 0xffffff, width: 2, alpha: 0.88 })
      pieceGroup.addChild(body)
    }

    board.addChild(pieceGroup)
  }

  return layout
}
