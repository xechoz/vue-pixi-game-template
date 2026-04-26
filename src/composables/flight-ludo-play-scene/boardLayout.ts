import type { BoardRenderLayout } from '../../game'
import type { BoardLayout } from './types'

type BoardPresetLayoutInput = {
  trackLength: number
  stepsPerSide: number
  homeSteps: number
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t
}

export function buildBoardLayout(
  originX: number,
  originY: number,
  size: number,
  boardPreset: BoardPresetLayoutInput,
  boardRenderLayout: BoardRenderLayout,
): BoardLayout {
  const buildTrackPoints = (originXValue: number, originYValue: number) => {
    const left = originXValue + size * boardRenderLayout.trackInsetRatio
    const right = originXValue + size * (1 - boardRenderLayout.trackInsetRatio)
    const top = originYValue + size * boardRenderLayout.trackInsetRatio
    const bottom = originYValue + size * (1 - boardRenderLayout.trackInsetRatio)

    return Array.from({ length: boardPreset.trackLength }, (_, index) => {
      const side = Math.floor(index / boardPreset.stepsPerSide)
      const localIndex = index % boardPreset.stepsPerSide
      const local =
        boardPreset.stepsPerSide <= 1
          ? 0
          : localIndex / (boardPreset.stepsPerSide - 1)

      if (side === 0) return { x: lerp(left, right, local), y: top }
      if (side === 1) return { x: right, y: lerp(top, bottom, local) }
      if (side === 2) return { x: lerp(right, left, local), y: bottom }
      return { x: left, y: lerp(bottom, top, local) }
    })
  }

  const buildBaseSlots = (originXValue: number, originYValue: number) => {
    const zoneSize = size * boardRenderLayout.baseZoneSizeRatio
    const zonePadding = size * boardRenderLayout.baseZonePaddingRatio
    const spread = zoneSize * boardRenderLayout.baseSlotSpreadRatio

    const zones = [
      { x: originXValue + zonePadding, y: originYValue + zonePadding },
      {
        x: originXValue + size - zonePadding - zoneSize,
        y: originYValue + zonePadding,
      },
      {
        x: originXValue + size - zonePadding - zoneSize,
        y: originYValue + size - zonePadding - zoneSize,
      },
      {
        x: originXValue + zonePadding,
        y: originYValue + size - zonePadding - zoneSize,
      },
    ]

    return zones.map((zone) => {
      const centerX = zone.x + zoneSize / 2
      const centerY = zone.y + zoneSize / 2
      return [
        { x: centerX - spread, y: centerY - spread },
        { x: centerX + spread, y: centerY - spread },
        { x: centerX - spread, y: centerY + spread },
        { x: centerX + spread, y: centerY + spread },
      ]
    })
  }

  const buildFinishSlots = (originXValue: number, originYValue: number) => {
    const centerXValue = originXValue + size / 2
    const centerYValue = originYValue + size / 2
    const offset = size * boardRenderLayout.finishOffsetRatio
    const gap = size * boardRenderLayout.finishGapRatio

    const corners = [
      { x: centerXValue - offset, y: centerYValue - offset },
      { x: centerXValue + offset, y: centerYValue - offset },
      { x: centerXValue + offset, y: centerYValue + offset },
      { x: centerXValue - offset, y: centerYValue + offset },
    ]

    return corners.map((corner, index) => {
      const xDir = index === 0 || index === 3 ? -1 : 1
      const yDir = index === 0 || index === 1 ? -1 : 1
      return Array.from({ length: boardPreset.homeSteps }, (_, laneIndex) => ({
        x: corner.x + xDir * gap * laneIndex,
        y: corner.y + yDir * gap * laneIndex,
      }))
    })
  }

  return {
    trackPoints: buildTrackPoints(originX, originY),
    baseSlots: buildBaseSlots(originX, originY),
    finishSlots: buildFinishSlots(originX, originY),
  }
}
