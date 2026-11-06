import * as THREE from 'three'

let glow: THREE.CanvasTexture | undefined

/** A soft round glow, for halos, lights and flashes. */
export function glowTexture(): THREE.CanvasTexture {
  if (glow) return glow
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const g = canvas.getContext('2d')
  if (g) {
    const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.18, 'rgba(255,255,255,0.65)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.18)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gradient
    g.fillRect(0, 0, 128, 128)
  }
  glow = new THREE.CanvasTexture(canvas)
  glow.colorSpace = THREE.SRGBColorSpace
  return glow
}

/** A sprite that glows in a color, added on top of what is behind it. */
export function glowSprite(
  color: THREE.ColorRepresentation,
  size: number,
  opacity = 1,
): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  sprite.scale.setScalar(size)
  return sprite
}
