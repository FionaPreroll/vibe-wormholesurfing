import * as THREE from 'three'

export const SKIN = '#ffe6da'

/**
 * The girl's face, painted on the head's texture: big shining eyes, rosy cheeks and a small smile.
 * The head sphere's front lies at a quarter of the texture's width, its equator at half height.
 */
export function paintFace(closed: boolean, happy = false): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const g = canvas.getContext('2d')
  if (!g) return canvas
  g.fillStyle = SKIN
  g.fillRect(0, 0, canvas.width, canvas.height)
  const cx = 256
  const eyeY = 268

  // Cheeks.
  for (const side of [-1, 1]) {
    const x = cx + side * 96
    const blush = g.createRadialGradient(x, 318, 2, x, 318, 34)
    blush.addColorStop(0, 'rgba(255, 120, 150, 0.55)')
    blush.addColorStop(1, 'rgba(255, 120, 150, 0)')
    g.fillStyle = blush
    g.beginPath()
    g.ellipse(x, 318, 36, 22, 0, 0, Math.PI * 2)
    g.fill()
    // Tiny shine lines on the cheeks.
    g.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    g.lineWidth = 2.5
    for (const offset of [-8, 2, 12]) {
      g.beginPath()
      g.moveTo(x + offset - 3, 310)
      g.lineTo(x + offset + 3, 300)
      g.stroke()
    }
  }

  for (const side of [-1, 1]) {
    const x = cx + side * 60
    if (closed || happy) {
      // Closed or smiling eyes: soft arcs with lashes.
      g.strokeStyle = '#3a2147'
      g.lineWidth = 7
      g.lineCap = 'round'
      g.beginPath()
      if (happy) g.arc(x, eyeY + 14, 26, Math.PI * 1.15, Math.PI * 1.85)
      else g.arc(x, eyeY - 10, 28, Math.PI * 0.2, Math.PI * 0.8)
      g.stroke()
      continue
    }
    // Iris: deep teal at the top to bright aqua at the bottom.
    const iris = g.createLinearGradient(x, eyeY - 40, x, eyeY + 40)
    iris.addColorStop(0, '#1b3f73')
    iris.addColorStop(0.45, '#2b8fd6')
    iris.addColorStop(1, '#7ff3ff')
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.ellipse(x, eyeY + 2, 30, 42, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = iris
    g.beginPath()
    g.ellipse(x, eyeY + 4, 26, 38, 0, 0, Math.PI * 2)
    g.fill()
    // Pupil and a glow ring.
    g.fillStyle = '#10183a'
    g.beginPath()
    g.ellipse(x, eyeY + 2, 12, 19, 0, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(160, 250, 255, 0.6)'
    g.lineWidth = 3
    g.beginPath()
    g.ellipse(x, eyeY + 12, 18, 22, 0, Math.PI * 0.15, Math.PI * 0.85)
    g.stroke()
    // Shines.
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.ellipse(x - side * 9 - 3, eyeY - 14, 10, 13, -0.3, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.ellipse(x + 10, eyeY + 20, 5, 6, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255, 255, 255, 0.85)'
    g.beginPath()
    g.arc(x - 12, eyeY + 18, 2.6, 0, Math.PI * 2)
    g.fill()
    // Upper lashes: a thick arc with a flick at the outer corner.
    g.strokeStyle = '#2a1533'
    g.lineCap = 'round'
    g.lineWidth = 9
    g.beginPath()
    g.ellipse(x, eyeY + 2, 32, 43, 0, Math.PI * 1.08, Math.PI * 1.92)
    g.stroke()
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(x + side * 30, eyeY - 18)
    g.quadraticCurveTo(x + side * 42, eyeY - 26, x + side * 46, eyeY - 34)
    g.stroke()
    g.lineWidth = 3
    g.beginPath()
    g.ellipse(x, eyeY + 4, 28, 40, 0, Math.PI * 0.3, Math.PI * 0.7)
    g.stroke()
    // Brows peek out under the fringe.
    g.lineWidth = 4
    g.beginPath()
    g.arc(x, eyeY - 52, 24, Math.PI * 1.25, Math.PI * 1.75)
    g.stroke()
  }

  // A small happy mouth.
  g.strokeStyle = '#8a3a52'
  g.lineWidth = 5
  g.lineCap = 'round'
  if (happy) {
    g.fillStyle = '#c4475f'
    g.beginPath()
    g.moveTo(cx - 16, 322)
    g.quadraticCurveTo(cx, 348, cx + 16, 322)
    g.closePath()
    g.fill()
    g.fillStyle = '#ff9db0'
    g.beginPath()
    g.ellipse(cx, 334, 7, 4, 0, 0, Math.PI * 2)
    g.fill()
  } else {
    g.beginPath()
    g.moveTo(cx - 12, 322)
    g.quadraticCurveTo(cx - 6, 330, cx, 324)
    g.quadraticCurveTo(cx + 6, 330, cx + 12, 322)
    g.stroke()
  }
  return canvas
}

export function faceTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
