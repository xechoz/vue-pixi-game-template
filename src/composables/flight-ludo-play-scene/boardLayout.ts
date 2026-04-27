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
    const trackInset = 10
    const left = originXValue + trackInset
    const right = originXValue + size - trackInset
    const top = originYValue + trackInset
    const bottom = originYValue + size - trackInset

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
    const zoneSize = Math.max(64, size * 0.1)
    const zonePadding = 8
    const spread = zoneSize * 0.22
    const trackInset = 10
    const baseOutsideGap = Math.max(14, size * 0.035)

    const zones = [
      {
        x: originXValue + trackInset,
        y: originYValue - zonePadding - zoneSize - baseOutsideGap,
      },
      {
        x: originXValue + size - trackInset - zoneSize,
        y: originYValue - zonePadding - zoneSize - baseOutsideGap,
      },
      {
        x: originXValue + size - trackInset - zoneSize,
        y: originYValue + size + zonePadding + baseOutsideGap,
      },
      {
        x: originXValue + trackInset,
        y: originYValue + size + zonePadding + baseOutsideGap,
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
    const trackInset = 10
    const gap = size * boardRenderLayout.finishGapRatio
    const laneStartOffset = Math.max(trackInset + gap, size * boardRenderLayout.finishOffsetRatio)

    const lanes = [
      {
        // 红方：从左边往棋盘中心走
        x: originXValue + laneStartOffset,
        y: centerYValue,
      },
      {
        // 黄方：从上边往棋盘中心走
        x: centerXValue,
        y: originYValue + laneStartOffset,
      },
      {
        // 蓝方：从右边往棋盘中心走
        x: originXValue + size - laneStartOffset,
        y: centerYValue,
      },
      {
        // 绿方：从下边往棋盘中心走
        x: centerXValue,
        y: originYValue + size - laneStartOffset,
      },
    ]

    return lanes.map((lane) =>
      Array.from({ length: boardPreset.homeSteps }, (_, laneIndex) => {
        const t =
          boardPreset.homeSteps <= 1 ? 1 : laneIndex / (boardPreset.homeSteps - 1)
        return {
          x: lerp(lane.x, centerXValue, t),
          y: lerp(lane.y, centerYValue, t),
        }
      }),
    )
  }

  return {
    trackPoints: buildTrackPoints(originX, originY),
    baseSlots: buildBaseSlots(originX, originY),
    finishSlots: buildFinishSlots(originX, originY),
  }
}
