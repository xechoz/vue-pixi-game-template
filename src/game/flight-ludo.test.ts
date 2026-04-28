import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FLIGHT_JUMPS,
  HOME_STEPS,
  PLAYER_DEFS,
  SAFE_CELLS,
  TRACK_LENGTH,
  createGame,
  getPieceLabel,
  getTrackCellIndex,
} from './flight-ludo.ts'

test('tiny-3 board preset uses a 12-cell track with 2 home steps and no flight jumps', () => {
  assert.equal(TRACK_LENGTH, 12)
  assert.equal(HOME_STEPS, 2)
  assert.deepEqual(
    PLAYER_DEFS.map((player) => player.startIndex),
    [0, 3, 6, 9],
  )
  assert.deepEqual([...SAFE_CELLS], [0, 3, 6, 9])
  assert.equal(FLIGHT_JUMPS.size, 0)
})

test('createGame still marks the first n seats as human-controlled in tiny-3 mode', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2 })
  assert.deepEqual(
    game.players.map((player) => player.humanControlled),
    [true, true, false, false],
  )
})

test('createGame accepts a non-default board preset id and stores it in the game state', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2, boardPresetId: 'normal-5' })

  assert.equal(game.boardPresetId, 'normal-5')
})

test('normal-5 game logic uses the selected difficulty mode instead of tiny-3 defaults', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2, boardPresetId: 'normal-5' })
  const player = game.players[0]!
  const piece = player.pieces[0]!

  piece.progress = 16
  assert.equal(getTrackCellIndex(player, piece), 16)

  piece.progress = 17
  assert.equal(getPieceLabel(piece, game.boardPresetId), '内圈 1/4')
})

test('red route enters the home lane before the final outer-side midpoint and centers its finish lane', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2, boardPresetId: 'normal-5' })
  const player = game.players[0]!
  const boardPresetId = game.boardPresetId
  const piece = player.pieces[0]!

  piece.progress = 16
  assert.equal(getTrackCellIndex(player, piece), 16)
  assert.equal(getPieceLabel(piece, boardPresetId), '赛道 16/16')

  piece.progress = 17
  assert.equal(getTrackCellIndex(player, piece), -1)
  assert.equal(getPieceLabel(piece, boardPresetId), '内圈 1/4')
})

test('hell-7 game logic uses the selected third difficulty mode at runtime', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2, boardPresetId: 'hell-7' })
  const player = game.players[0]!
  const piece = player.pieces[0]!

  piece.progress = 22
  assert.equal(getTrackCellIndex(player, piece), 21)

  piece.progress = 24
  assert.equal(getPieceLabel(piece, game.boardPresetId), '内圈 1/5')
})
