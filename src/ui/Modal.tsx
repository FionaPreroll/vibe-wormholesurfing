import type { ComponentChildren } from 'preact'
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks'
import { t } from '../i18n'
import { useBackdropDismiss } from './backdrop'

interface Props {
  readonly id: string
  readonly title: string
  readonly onClose: () => void
  readonly children: ComponentChildren
  /** Room for a table, as the keys and buttons have. */
  readonly wide?: boolean
}

/**
 * A dialog over the current screen, such as help or the settings; Escape or a click on the dim
 * backdrop around it closes it. The focus moves into it when it opens and returns to where it was
 * when it closes.
 */
export function Modal({ id, title, onClose, children, wide = false }: Props) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const opener = document.activeElement
    close.current?.focus()
    return () => {
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])
  // Listening starts before the first paint, so an Escape right after opening closes it.
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const backdrop = useBackdropDismiss(onClose)

  return (
    <div class="modal-backdrop" {...backdrop}>
      <div
        class={wide ? 'modal wide' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <header class="modal-header">
          <h2 id={`${id}-title`}>{title}</h2>
          <button type="button" ref={close} onClick={onClose}>
            {t('close')}
          </button>
        </header>
        <div class="modal-body">{children}</div>
      </div>
    </div>
  )
}
