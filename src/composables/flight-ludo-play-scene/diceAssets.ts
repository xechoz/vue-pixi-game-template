import * as PIXI from 'pixi.js'

type AssetUrlResolver = (name: string) => string

export async function loadFirstAvailableTexture(paths: string[]) {
  for (const path of paths) {
    try {
      const loaded = await PIXI.Assets.load(path)
      if (loaded instanceof PIXI.Texture) return loaded
      return PIXI.Texture.from(path)
    } catch {
      // Try next candidate path.
    }
  }
  return null
}

export async function loadDiceIdleAsset(assetUrl: AssetUrlResolver) {
  return loadFirstAvailableTexture([
    assetUrl('dice/idle-question.png')
  ])
}

export async function loadDiceFaceAssets(assetUrl: AssetUrlResolver) {
  const textures: Partial<Record<number, PIXI.Texture>> = {}
  const extensions = ['webp', 'png', 'jpg', 'jpeg', 'svg']

  for (let value = 1; value <= 6; value += 1) {
    const texture = await loadFirstAvailableTexture([
      ...extensions.map((extension) =>
        assetUrl(`dice/faces/${value}.${extension}`),
      ),
      assetUrl(`dice-${value}.svg`),
    ])
    if (texture) {
      textures[value] = texture
    }
  }

  return textures
}

async function loadDiceRollManifestFrames(assetUrl: AssetUrlResolver) {
  try {
    const response = await fetch(assetUrl('dice/roll/manifest.json'))
    if (!response.ok) return []
    const manifest = await response.json()
    const frames = Array.isArray(manifest)
      ? manifest
      : Array.isArray(manifest?.frames)
        ? manifest.frames
        : []
    return frames.filter(
      (frame: unknown): frame is string =>
        typeof frame === 'string' && frame.length > 0,
    )
  } catch {
    return []
  }
}

export async function loadDiceRollAssets(assetUrl: AssetUrlResolver) {
  const manifestFrames = await loadDiceRollManifestFrames(assetUrl)
  if (manifestFrames.length > 0) {
    const textures = await Promise.all(
      manifestFrames.map(async (frame: string) =>
        loadFirstAvailableTexture([assetUrl(`dice/roll/${frame}`)]),
      ),
    )
    return textures.filter(
      (texture): texture is PIXI.Texture => texture instanceof PIXI.Texture,
    )
  }

  for (const extension of ['webp', 'png', 'jpg', 'jpeg']) {
    const firstFrame = await loadFirstAvailableTexture([
      assetUrl(`dice/roll/frame-001.${extension}`),
    ])
    if (!firstFrame) continue

    const textures: PIXI.Texture[] = [firstFrame]
    for (let index = 2; index <= 48; index += 1) {
      const frameName = `frame-${String(index).padStart(3, '0')}.${extension}`
      const texture = await loadFirstAvailableTexture([
        assetUrl(`dice/roll/${frameName}`),
      ])
      if (!texture) break
      textures.push(texture)
    }
    return textures
  }

  return []
}
