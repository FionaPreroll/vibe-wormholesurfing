interface ImportMetaEnv {
  /** CI's run number for the builds CI makes (vite.config.ts); empty for builds made by hand. */
  readonly BUILD_NUMBER: string
}
