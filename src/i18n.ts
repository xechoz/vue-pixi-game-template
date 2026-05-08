import { computed, reactive, type ComputedRef } from 'vue'

import enMessages from './locales/en.json'
import zhMessages from './locales/zh.json'

type Locale = 'en' | 'zh'

type MessageParams = Record<string, string | number | boolean>

type MessageCatalog = Record<string, string>

const supportedLocales = ['en', 'zh'] as const

type SupportedLocale = (typeof supportedLocales)[number]

const messages: Record<SupportedLocale, MessageCatalog> = {
  en: enMessages,
  zh: zhMessages,
}

function getBrowserLocale(): SupportedLocale {
  if (typeof navigator === 'object' && navigator) {
    const languages = Array.isArray(navigator.languages)
      ? navigator.languages
      : [navigator.language]

    for (const raw of languages) {
      const normalized = String(raw).trim().toLowerCase()
      if (normalized.startsWith('zh')) return 'zh'
      if (normalized.startsWith('en')) return 'en'
    }
  }
  return 'en'
}

const state = reactive({ locale: getBrowserLocale() as SupportedLocale })

function replaceParams(message: string, params?: MessageParams): string {
  if (!params) return message

  return Object.entries(params).reduce((current, [key, value]) => {
    return current.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }, message)
}

export function t(key: string, params?: MessageParams): string {
  const localeMessages = messages[state.locale] ?? messages.en
  const template = localeMessages[key] ?? messages.en[key] ?? key
  return replaceParams(template, params)
}

export function setLocale(localeValue: Locale): void {
  if (supportedLocales.includes(localeValue)) {
    state.locale = localeValue
  }
}

export function useI18n(): {
  locale: ComputedRef<Locale>
  setLocale: (localeValue: Locale) => void
  t: (key: string, params?: MessageParams) => string
} {
  return {
    locale: computed(() => state.locale),
    setLocale,
    t,
  }
}
