import { BROKEN_GLSL } from '../../src/view/glsl'
import { expect, test } from './coverage'

test('the broken-pixel test finds NaN and infinity, and only them', async ({ page }) => {
  await page.goto('about:blank')
  const found = await page.evaluate((glsl) => {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 1
    const gl = canvas.getContext('webgl2')
    if (!gl) throw new Error('no WebGL2')
    gl.getExtension('EXT_color_buffer_float')
    // One texel per value: NaN, +∞, −∞, then ordinary colors, large ones too.
    const values = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      0,
      1,
      31,
      65504,
      -2,
    ]
    const data = new Float32Array(values.flatMap((value) => [1, value, 0.5, 1]))
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 8, 1, 0, gl.RGBA, gl.FLOAT, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type) as WebGLShader
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) ?? 'compile failed')
      return shader
    }
    const program = gl.createProgram() as WebGLProgram
    gl.attachShader(
      program,
      compile(
        gl.VERTEX_SHADER,
        `#version 300 es
        void main() {
          vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
          gl_Position = vec4(corner * 4.0 - 1.0, 0.0, 1.0);
        }`,
      ),
    )
    gl.attachShader(
      program,
      compile(
        gl.FRAGMENT_SHADER,
        `#version 300 es
        precision highp float;
        uniform highp sampler2D tValues;
        out vec4 color;
        ${glsl}
        void main() {
          vec3 value = texelFetch(tValues, ivec2(gl_FragCoord.xy), 0).rgb;
          color = vec4(broken(value) ? 1.0 : 0.0, 0.0, 0.0, 1.0);
        }`,
      ),
    )
    gl.linkProgram(program)
    gl.useProgram(program)
    gl.viewport(0, 0, 8, 1)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    const pixels = new Uint8Array(8 * 4)
    gl.readPixels(0, 0, 8, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    return Array.from({ length: 8 }, (_, index) => pixels[index * 4] === 255)
  }, BROKEN_GLSL)
  expect(found).toEqual([true, true, true, false, false, false, false, false])
})
