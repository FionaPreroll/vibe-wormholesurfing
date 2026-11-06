import type { Plugin, Rolldown } from 'vite'

type OutputChunk = Rolldown.OutputChunk

/** The placeholder in the source that the build replaces with the list of files. */
export const PLACEHOLDER = '__LAZY_VIEW_FILES__'

/** A file that loads on demand, with its size in bytes as served unpacked. */
export interface LazyFile {
  readonly file: string
  readonly bytes: number
}

/**
 * Tells the game which files its 3D view is made of, and how big they are, so the loading screen
 * can show progress in bytes. The build writes the list into the entry chunk in place of
 * `PLACEHOLDER`; the dev server leaves the placeholder, and the game then shows time only.
 */
export function lazyFiles(module = 'src/view/director.ts'): Plugin {
  return {
    name: 'vibe-wormholesurfing-lazy-files',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (item): item is OutputChunk => item.type === 'chunk',
      )
      const lazy = chunks.find((chunk) => chunk.facadeModuleId?.endsWith(module))
      if (!lazy) return
      const entryFiles = new Set(
        chunks
          .filter((chunk) => chunk.isEntry)
          .flatMap((chunk) => [chunk.fileName, ...chunk.imports]),
      )
      // The lazy chunk and whatever it imports that the entry has not loaded already.
      const files: LazyFile[] = []
      const visit = (fileName: string) => {
        if (entryFiles.has(fileName) || files.some((file) => file.file === fileName)) return
        const chunk = bundle[fileName]
        if (chunk?.type !== 'chunk') return
        files.push({ file: fileName, bytes: Buffer.byteLength(chunk.code) })
        for (const imported of chunk.imports) visit(imported)
      }
      visit(lazy.fileName)
      const literal = new RegExp(`(["'\`])${PLACEHOLDER}\\1`, 'g')
      for (const chunk of chunks) {
        if (chunk.code.includes(PLACEHOLDER))
          chunk.code = chunk.code.replace(literal, JSON.stringify(JSON.stringify(files)))
      }
    },
  }
}
