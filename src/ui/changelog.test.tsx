// @vitest-environment happy-dom
import { render } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { renderChangelog } from './changelog'

describe('renderChangelog', () => {
  it('shows versions, sections and entries, and leaves out empty versions and links', () => {
    const markdown = [
      '# Changelog',
      '',
      'Intro with a [link](https://example.com).',
      '',
      '## [Unreleased]',
      '',
      '## [1.0.0] - 2026-11-06',
      '',
      '### Added',
      '',
      '- A `ride` through the wormhole.',
      '- Eight worlds.',
      '',
      '[1.0.0]: https://example.com/1.0.0',
    ].join('\n')
    const { container } = render(<div>{renderChangelog(markdown)}</div>)
    expect(container.querySelector('p')?.textContent).toBe('Intro with a link.')
    expect([...container.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      '1.0.0 - 2026-11-06',
    ])
    expect(container.querySelector('h4')?.textContent).toBe('Added')
    expect([...container.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'A ride through the wormhole.',
      'Eight worlds.',
    ])
  })
})
