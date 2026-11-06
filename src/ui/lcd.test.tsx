// @vitest-environment happy-dom
import { render } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { Lcd } from './lcd'

describe('Lcd', () => {
  it('lights the segments of each digit and pads with unlit cells', () => {
    const { container } = render(<Lcd value="17" digits={4} label="Orbs" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-label')).toBe('Orbs: 17')
    // Four cells of seven segments: "1" lights two, "7" three, the padding none.
    expect(container.querySelectorAll('polygon')).toHaveLength(28)
    expect(container.querySelectorAll('.lcd-on')).toHaveLength(5)
  })

  it('draws a colon between minutes and seconds', () => {
    const { container } = render(<Lcd value="1:05" />)
    expect(container.querySelectorAll('rect')).toHaveLength(2)
    expect(container.querySelectorAll('.lcd-on')).toHaveLength(2 + 6 + 5)
  })
})
