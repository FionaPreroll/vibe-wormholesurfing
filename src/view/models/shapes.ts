import * as THREE from 'three'

/**
 * A tube along points that thins and thickens as `radii` say, closed at both ends: hair strands,
 * tails, stems and feathers' quills.
 */
export function taperTube(
  points: readonly THREE.Vector3[],
  radii: readonly number[],
  tubular = 28,
  radial = 12,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([...points], false, 'centripetal')
  const frames = curve.computeFrenetFrames(tubular, false)
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const radiusAt = (t: number) => {
    const scaled = t * (radii.length - 1)
    const index = Math.min(radii.length - 2, Math.floor(scaled))
    const local = scaled - index
    const a = radii[index] ?? 0
    const b = radii[index + 1] ?? a
    const smooth = local * local * (3 - 2 * local)
    return a + (b - a) * smooth
  }
  const point = new THREE.Vector3()
  const normal = new THREE.Vector3()
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular
    curve.getPointAt(t, point)
    const n = frames.normals[i] as THREE.Vector3
    const b = frames.binormals[i] as THREE.Vector3
    const radius = radiusAt(t)
    for (let j = 0; j <= radial; j++) {
      const angle = (j / radial) * Math.PI * 2
      const sin = Math.sin(angle)
      const cos = -Math.cos(angle)
      normal.set(cos * n.x + sin * b.x, cos * n.y + sin * b.y, cos * n.z + sin * b.z).normalize()
      positions.push(
        point.x + radius * normal.x,
        point.y + radius * normal.y,
        point.z + radius * normal.z,
      )
      normals.push(normal.x, normal.y, normal.z)
      uvs.push(j / radial, t)
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j
      const b = (i + 1) * (radial + 1) + j
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  // Caps: a fan at each end.
  const addCap = (ring: number, t: number, flip: boolean) => {
    curve.getPointAt(t, point)
    const tangent = curve.getTangentAt(t).multiplyScalar(flip ? -1 : 1)
    const center = positions.length / 3
    positions.push(point.x, point.y, point.z)
    normals.push(tangent.x, tangent.y, tangent.z)
    uvs.push(0.5, t)
    for (let j = 0; j < radial; j++) {
      const a = ring * (radial + 1) + j
      if (flip) indices.push(center, a, a + 1)
      else indices.push(center, a + 1, a)
    }
  }
  addCap(0, 0, true)
  addCap(tubular, 1, false)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

/** A flat shape with round corners through the given points, as for wings and fins. */
export function roundedShape(points: readonly [number, number][], round: number): THREE.Shape {
  const shape = new THREE.Shape()
  const count = points.length
  for (let index = 0; index < count; index++) {
    const [px, py] = points[(index - 1 + count) % count] as [number, number]
    const [cx, cy] = points[index] as [number, number]
    const [nx, ny] = points[(index + 1) % count] as [number, number]
    const inLength = Math.hypot(cx - px, cy - py)
    const outLength = Math.hypot(nx - cx, ny - cy)
    const r = Math.min(round, inLength / 2, outLength / 2)
    const ax = cx + ((px - cx) / inLength) * r
    const ay = cy + ((py - cy) / inLength) * r
    const bx = cx + ((nx - cx) / outLength) * r
    const by = cy + ((ny - cy) / outLength) * r
    if (index === 0) shape.moveTo(ax, ay)
    else shape.lineTo(ax, ay)
    shape.quadraticCurveTo(cx, cy, bx, by)
  }
  shape.closePath()
  return shape
}

/** A star with `points` tips, as a flat shape. */
export function starShape(outer: number, inner: number, points = 5): THREE.Shape {
  const shape = new THREE.Shape()
  for (let index = 0; index <= points * 2; index++) {
    const radius = index % 2 === 0 ? outer : inner
    const angle = (index / (points * 2)) * Math.PI * 2 + Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  return shape
}

/** A star with soft, beveled edges, standing in the xy plane. */
export function starGeometry(outer: number, inner: number, depth: number): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(starShape(outer, inner), {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.6,
    bevelSize: outer * 0.12,
    bevelSegments: 3,
  })
  geometry.center()
  geometry.computeVertexNormals()
  return geometry
}

/** A smooth lathe from (radius, height) points, refined by a spline for soft curves. */
export function smoothLathe(
  profile: readonly [number, number][],
  segments = 40,
  steps = 48,
): THREE.LatheGeometry {
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)))
  const points = curve.getPoints(steps).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y))
  return new THREE.LatheGeometry(points, segments)
}
