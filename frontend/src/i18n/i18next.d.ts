import 'i18next'
import type kk from './kk.json'

// Type-checks every t('…') key against kk.json: a missing or misspelt key fails the build
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof kk }
  }
}
