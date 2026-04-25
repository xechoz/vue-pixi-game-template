# VS Code Debug Guide

This project already includes a VS Code launch configuration at:

- `.vscode/launch.json`

## Launch configuration

Use this configuration in VS Code:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Vite: Debug in Chrome",
      "type": "pwa-chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}",
      "sourceMaps": true,
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"]
    }
  ]
}
```

## How to use it

1. Open the project in VS Code.
2. Start the Vite dev server:
   ```bash
   npm run dev
   ```
3. Open **Run and Debug** in VS Code.
4. Select **Vite: Debug in Chrome**.
5. Press **F5**.

## Useful breakpoints

### `src/App.vue`
Set breakpoints in:
- `handleRoll()`
- `scheduleTurnAdvance()`
- `playAutoTurn()`
- the `watch(...)` block near the turn logic

Watch these variables while stepping:
- `isTurnTransitioning`
- `isRolling`
- `game.value.dice`
- `game.value.currentPlayerIndex`
- `currentPlayer.value.humanControlled`

### `src/game/flight-ludo.ts`
Set breakpoints in:
- `rollDice()`
- `movePiece()`
- `advanceTurn()`
- `getLegalPieceIds()`

Watch these values:
- `state.dice`
- `state.currentPlayerIndex`
- `state.turnPointer`
- `state.status`
- `getLegalPieceIds(state)`

## What to check first

If the dice cannot be clicked again, check:

1. Whether `handleRoll()` is being entered at all.
2. Whether it returns early because of:
   - `game.value.dice !== null`
   - `isRolling.value`
   - `isTurnTransitioning.value`
3. Whether `rollDice()` clears or preserves `state.dice` as expected.
4. Whether `scheduleTurnAdvance()` or `watch(...)` is leaving the game in a transition state.

## Tip

If VS Code does not attach correctly, verify that the dev server is running on `http://localhost:5173`.
