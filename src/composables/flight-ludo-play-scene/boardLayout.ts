import type { BoardRenderLayout } from '../../game'
import type { BoardLayout } from './types'

type BoardPresetLayoutInput = {
  trackLength: number
  stepsPerEdge: number
  homeSteps: number
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t
}

function buildLinePoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  count: number,
) {
  if (count <= 1) return [{ x: start.x, y: start.y }]

  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1)
    return {
      x: lerp(start.x, end.x, t),
      y: lerp(start.y, end.y, t),
    }
  })
}

function buildPerimeterPoints(
  left: number,
  right: number,
  top: number,
  bottom: number,
  stepsPerEdge: number,
) {
  const topSide = buildLinePoints({ x: left, y: top }, { x: right, y: top }, stepsPerEdge)
  const rightSide = buildLinePoints({ x: right, y: top }, { x: right, y: bottom }, stepsPerEdge)
  const bottomSide = buildLinePoints({ x: right, y: bottom }, { x: left, y: bottom }, stepsPerEdge)
  const leftSide = buildLinePoints({ x: left, y: bottom }, { x: left, y: top }, stepsPerEdge)

  return {
    topSide,
    rightSide,
    bottomSide,
    leftSide,
    perimeterPoints: [
      ...topSide,
      ...rightSide.slice(1),
      ...bottomSide.slice(1),
      ...leftSide.slice(1),
    ],
  }
}

function getEntrySideCount(trackLength: number, stepsPerEdge: number) {
  void trackLength
  // The last side is intentionally shorter so the visible outer loop can still
  // close cleanly while leaving room for the home lane entry on the left edge.
  // This count is chosen so the derived raw track length still matches the preset.
  return Math.ceil((stepsPerEdge + 3) / 2)
}

export function buildBoardLayout(
  originX: number,
  originY: number,
  size: number,
  boardPreset: BoardPresetLayoutInput,
  boardRenderLayout: BoardRenderLayout,
): BoardLayout {
  const trackInset = Math.max(10, size * boardRenderLayout.trackInsetRatio)
  const left = originX + trackInset
  const right = originX + size - trackInset
  const top = originY + trackInset
  const bottom = originY + size - trackInset
  const centerX = originX + size / 2
  const centerY = originY + size / 2

  const { topSide, rightSide, bottomSide, leftSide, perimeterPoints } = buildPerimeterPoints(
    left,
    right,
    top,
    bottom,
    boardPreset.stepsPerEdge,
  )

  // 外圈路径：保持闭合矩形外环，左侧只比其它三边少一个点，用来匹配当前 trackLength。
  const leftRouteSide = buildLinePoints(
    { x: left, y: bottom },
    { x: left, y: top },
    getEntrySideCount(boardPreset.trackLength, boardPreset.stepsPerEdge),
  )

  const trackPoints = [
    ...topSide,
    ...rightSide.slice(1),
    ...bottomSide.slice(1),
    ...leftRouteSide.slice(1),
  ]

  const outerBorderPoints = perimeterPoints

  const buildBaseSlots = (originXValue: number, originYValue: number) => {
    const zoneSize = Math.max(64, size * boardRenderLayout.baseZoneSizeRatio)
    const zonePadding = Math.max(8, size * boardRenderLayout.baseZonePaddingRatio)
    const spread = Math.max(12, zoneSize * boardRenderLayout.baseSlotSpreadRatio)
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
      const slotCenterX = zone.x + zoneSize / 2
      const slotCenterY = zone.y + zoneSize / 2
      return [
        { x: slotCenterX - spread, y: slotCenterY - spread },
        { x: slotCenterX + spread, y: slotCenterY - spread },
        { x: slotCenterX - spread, y: slotCenterY + spread },
        { x: slotCenterX + spread, y: slotCenterY + spread },
      ]
    })
  }

  const buildFinishSlots = (originXValue: number, originYValue: number) => {
    const slotCenterX = originXValue + size / 2
    const slotCenterY = originYValue + size / 2

    const laneAnchors = [
      leftSide[Math.floor((leftSide.length - 1) / 2)] ?? leftSide[0] ?? { x: left, y: centerY },
      topSide[Math.floor((topSide.length - 1) / 2)] ?? topSide[0] ?? { x: centerX, y: top },
      rightSide[Math.floor((rightSide.length - 1) / 2)] ?? rightSide[0] ?? { x: right, y: centerY },
      bottomSide[Math.floor((bottomSide.length - 1) / 2)] ?? bottomSide[0] ?? { x: centerX, y: bottom },
    ]

    return laneAnchors.map((anchor) =>
      Array.from({ length: boardPreset.homeSteps }, (_, laneIndex) => {
        const t = (laneIndex + 1) / boardPreset.homeSteps
        return {
          x: lerp(anchor.x, slotCenterX, t),
          y: lerp(anchor.y, slotCenterY, t),
        }
      }),
    )
  }

  const homeEntryPoints = [
    leftSide[Math.floor((leftSide.length - 1) / 2)] ?? leftSide[0] ?? { x: left, y: centerY },
    topSide[Math.floor((topSide.length - 1) / 2)] ?? topSide[0] ?? { x: centerX, y: top },
    rightSide[Math.floor((rightSide.length - 1) / 2)] ?? rightSide[0] ?? { x: right, y: centerY },
    bottomSide[Math.floor((bottomSide.length - 1) / 2)] ?? bottomSide[0] ?? { x: centerX, y: bottom },
  ]

  return {
    trackPoints,
    outerBorderPoints,
    homeEntryPoints,
    baseSlots: buildBaseSlots(originX, originY),
    finishSlots: buildFinishSlots(originX, originY),
  }
}
