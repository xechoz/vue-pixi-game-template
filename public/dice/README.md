# Dice asset convention

This directory enables the resource-driven dice renderer in the flight-ludo play scene.

## Result faces
Put 6 settled-face images in:

- `public/dice/faces/1.webp`
- `public/dice/faces/2.webp`
- `public/dice/faces/3.webp`
- `public/dice/faces/4.webp`
- `public/dice/faces/5.webp`
- `public/dice/faces/6.webp`

Accepted extensions for each face: `webp`, `png`, `jpg`, `jpeg`, `svg`.

The renderer checks `public/dice/faces/` only. If these files are missing, the game keeps using the existing Pixi-drawn 3D dice.

## Roll animation frames
Recommended: transparent frame sequence in:

- `public/dice/roll/frame-001.webp`
- `public/dice/roll/frame-002.webp`
- ...

Accepted frame extensions for automatic scanning: `webp`, `png`, `jpg`, `jpeg`.

Automatic scan currently looks for `frame-001` and then continues upward until a frame is missing, up to 48 frames.

## Optional manifest
If your frame file names are custom, add:

- `public/dice/roll/manifest.json`

Example:

```json
{
  "frames": [
    "dice-roll-01.webp",
    "dice-roll-02.webp",
    "dice-roll-03.webp"
  ]
}
```

Each listed file path is resolved relative to `public/dice/roll/`.

## Behavior
- If roll frames exist, rolling uses the frame sequence.
- If settled face images exist, final results use the face images.
- If neither exists, rendering falls back to the current Pixi procedural dice.
