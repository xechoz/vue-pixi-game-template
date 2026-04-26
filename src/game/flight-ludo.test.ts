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

test('tiny-4 board preset uses a 16-cell track with 2 home steps and no flight jumps', () => {
  assert.equal(TRACK_LENGTH, 16)
  assert.equal(HOME_STEPS, 2)
  assert.deepEqual(
    PLAYER_DEFS.map((player) => player.startIndex),
    [0, 4, 8, 12],
  )
  assert.deepEqual([...SAFE_CELLS], [0, 4, 8, 12])
  assert.equal(FLIGHT_JUMPS.size, 0)
})

test('createGame still marks the first n seats as human-controlled in tiny-4 mode', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2 })
  assert.deepEqual(
    game.players.map((player) => player.humanControlled),
    [true, true, false, false],
  )
})

test('createGame accepts a non-default board preset id and stores it in the game state', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2, boardPresetId: 'normal-6' })

  assert.equal(game.boardPresetId, 'normal-6')
})

test('normal-6 game logic uses the selected difficulty mode instead of tiny-4 defaults', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2, boardPresetId: 'normal-6' })
  const player = game.players[0]!
  const piece = player.pieces[0]!

  piece.progress = 17
  assert.equal(getTrackCellIndex(player, piece), 17)

  piece.progress = 23
  assert.equal(getTrackCellIndex(player, piece), 23)

  piece.progress = 24
  assert.equal(getPieceLabel(piece, game.boardPresetId), '内圈 1/4')
})

test('hell-8 game logic uses the selected third difficulty mode at runtime', () => {
  const game = createGame({ mode: 2, piecesPerPlayer: 2, boardPresetId: 'hell-8' })
  const player = game.players[0]!
  const piece = player.pieces[0]!

  piece.progress = 31
  assert.equal(getTrackCellIndex(player, piece), 31)

  piece.progress = 32
  assert.equal(getPieceLabel(piece, game.boardPresetId), '内圈 1/5')
})
