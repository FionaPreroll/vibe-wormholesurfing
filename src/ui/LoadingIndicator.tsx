import { t } from '../i18n'
import { download, formatBytes, formatSeconds } from './loading'

/** Progress of the 3D view's download: a bar, bytes, speed, time taken and time left. */
export function LoadingIndicator({ inline = false }: { readonly inline?: boolean }) {
  const state = download.value
  const total = state?.total
  const share = state && total ? Math.min(1, state.loaded / total) : undefined
  const left =
    state && total && state.speed > 0 && state.loaded < total
      ? ((total - state.loaded) / state.speed) * 1000
      : undefined
  return (
    <div class={inline ? 'loader inline' : 'loader'} role="status" aria-live="polite">
      <p class="loader-title">{t('loadingEngine')}</p>
      <div
        class={`loader-bar${share === undefined ? ' unknown' : ''}`}
        role="progressbar"
        aria-label={t('loadingEngine')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share === undefined ? undefined : Math.round(share * 100)}
      >
        <div
          class="loader-fill"
          style={{ width: share === undefined ? '35%' : `${share * 100}%` }}
        />
      </div>
      {state && (
        <p class="loader-stats">
          {total !== undefined && (
            <span>
              {t('loadingBytes', { loaded: formatBytes(state.loaded), total: formatBytes(total) })}
            </span>
          )}
          {state.loaded > 0 && (
            <span>{t('loadingSpeed', { speed: formatBytes(state.speed) })}</span>
          )}
          <span>
            {left !== undefined
              ? t('loadingTime', {
                  elapsed: formatSeconds(state.elapsed),
                  left: formatSeconds(left),
                })
              : t('loadingElapsed', { elapsed: formatSeconds(state.elapsed) })}
          </span>
        </p>
      )}
    </div>
  )
}
