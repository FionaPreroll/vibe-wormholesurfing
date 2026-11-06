interface Props {
  readonly label: string
  readonly onFile: (file: File) => void
  readonly disabled?: boolean
}

/** A button that opens the browser's file dialog for a JSON file, as for imports. */
export function FileButton({ label, onFile, disabled = false }: Props) {
  return (
    <label class={disabled ? 'file-button disabled' : 'file-button'}>
      <input
        type="file"
        class="visually-hidden"
        accept="application/json,.json"
        disabled={disabled}
        onChange={(event) => {
          const input = event.currentTarget
          const file = input.files?.[0]
          // Cleared, so choosing the same file again still counts as a change.
          input.value = ''
          if (file !== undefined) onFile(file)
        }}
      />
      <span>{label}</span>
    </label>
  )
}
