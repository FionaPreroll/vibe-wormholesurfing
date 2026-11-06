import type { ComponentChildren } from 'preact'

/** A slider with its label above it. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onInput,
  onRelease = false,
}: {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly onInput: (value: number) => void
  /** Takes the value only once the slider is let go, as for what resizes the slider itself. */
  readonly onRelease?: boolean
}) {
  return (
    <label class="field">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(event) => {
          if (!onRelease) onInput(Number(event.currentTarget.value))
        }}
        onChange={(event) => {
          if (onRelease) onInput(Number(event.currentTarget.value))
        }}
      />
    </label>
  )
}

/** A tick box with its label beside it. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  readonly label: string
  readonly checked: boolean
  readonly onChange: (on: boolean) => void
}) {
  return (
    <label class="field toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

/** A list to choose from, with its label above it. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly onChange: (value: T) => void
}) {
  return (
    <label class="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** A heading for a group of fields. */
export function Group({
  title,
  children,
}: {
  readonly title: string
  readonly children: ComponentChildren
}) {
  return (
    <section class="field-group">
      <h4>{title}</h4>
      {children}
    </section>
  )
}
