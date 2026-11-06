import type * as THREE from 'three'

/** A shader's uniform by name, which must exist. */
export function uniform(uniforms: Record<string, THREE.IUniform>, name: string): THREE.IUniform {
  const entry = uniforms[name]
  if (!entry) throw new Error(`The shader has no uniform ${name}`)
  return entry
}
