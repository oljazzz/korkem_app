import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import kk from './kk.json'

// The app is Kazakh-only for now; texts live in kk.json. Another language would add its own file here.
void i18n.use(initReactI18next).init({
  resources: { kk: { translation: kk } },
  lng: 'kk',
  fallbackLng: 'kk',
  interpolation: { escapeValue: false }, // React escapes already
  returnNull: false,
  initAsync: false,
})

/** For code outside React components (formatters, API errors); components use useTranslation(). */
export const t = i18n.t.bind(i18n)

export default i18n
