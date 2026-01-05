/**
 * Internationalization (i18n) Service for MasterSVG
 *
 * Provides translation support for multiple languages:
 * - English (en)
 * - Spanish (es)
 * - Chinese (zh)
 * - Russian (ru)
 *
 * Automatically detects system language or uses configured preference.
 */

import * as vscode from 'vscode';

// Import locale files from l10n directory
import en from '../../l10n/en.json';
import es from '../../l10n/es.json';
import zh from '../../l10n/zh.json';
import ru from '../../l10n/ru.json';

export type SupportedLocale = 'en' | 'es' | 'zh' | 'ru' | 'auto';

export interface LocaleInfo {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'auto', name: 'Auto (System)', nativeName: 'Auto', flag: '🌐' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
];

type TranslationData = typeof en;
type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}.${NestedKeyOf<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

export type TranslationKey = NestedKeyOf<TranslationData>;

const locales: Record<string, TranslationData> = {
  en,
  es,
  zh,
  ru,
};

class I18nService {
  private static instance: I18nService;
  private currentLocale: string = 'en';
  private translations: TranslationData = en;
  private _onDidChangeLocale = new vscode.EventEmitter<string>();
  private _configListener: vscode.Disposable | undefined;

  /**
   * Event that fires when the locale changes
   */
  public readonly onDidChangeLocale = this._onDidChangeLocale.event;

  private constructor() {
    this.initializeLocale();
    // Listen for external configuration changes to update locale dynamically
    // Only register the configuration change listener if the API is available
    if (typeof vscode.workspace.onDidChangeConfiguration === 'function') {
      this._configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('masterSVG.language')) {
          const prev = this.currentLocale;
          this.initializeLocale();
          if (this.currentLocale !== prev) {
            this._onDidChangeLocale.fire(this.currentLocale);
          }
        }
      });
    } else {
      this._configListener = undefined;
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  /**
   * Initialize locale from configuration or system
   */
  private initializeLocale(): void {
    const config = vscode.workspace.getConfiguration('masterSVG');
    const configuredLocale = config.get<string>('language', 'auto');

    if (configuredLocale === 'auto') {
      this.currentLocale = this.detectSystemLocale();
    } else {
      this.currentLocale = configuredLocale;
    }

    this.loadTranslations();
  }

  /**
   * Detect system locale from VS Code environment
   */
  private detectSystemLocale(): string {
    // VS Code exposes the display language
    const vscodeLang = vscode.env.language;

    // Map VS Code language codes to our supported locales
    if (vscodeLang.startsWith('es')) return 'es';
    if (vscodeLang.startsWith('zh')) return 'zh';
    if (vscodeLang.startsWith('ru')) return 'ru';

    // Default to English
    return 'en';
  }

  /**
   * Load translations for current locale
   */
  private loadTranslations(): void {
    this.translations = locales[this.currentLocale] || locales.en;
  }

  /**
   * Get current locale code
   */
  public getLocale(): string {
    return this.currentLocale;
  }

  /**
   * Get configured locale (may be 'auto')
   */
  public getConfiguredLocale(): SupportedLocale {
    const config = vscode.workspace.getConfiguration('masterSVG');
    return config.get<SupportedLocale>('language', 'auto');
  }

  /**
   * Set locale and reload translations
   */
  public async setLocale(locale: SupportedLocale): Promise<void> {
    const config = vscode.workspace.getConfiguration('masterSVG');
    await config.update('language', locale, vscode.ConfigurationTarget.Global);

    if (locale === 'auto') {
      this.currentLocale = this.detectSystemLocale();
    } else {
      this.currentLocale = locale;
    }

    this.loadTranslations();
    this._onDidChangeLocale.fire(this.currentLocale);
  }

  /**
   * Get a translation by key path (e.g., 'welcome.title')
   * Supports interpolation with {placeholder} syntax
   */
  public t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = this.translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = this.getEnglishFallback(key);
        break;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Handle interpolation
    if (params) {
      return this.interpolate(value, params);
    }

    return value;
  }

  /**
   * Get English fallback for missing translations
   */
  private getEnglishFallback(key: string): string {
    const keys = key.split('.');
    let value: any = locales.en;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }

    return typeof value === 'string' ? value : key;
  }

  /**
   * Interpolate parameters into translation string
   */
  private interpolate(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  /**
   * Get all translations for current locale (useful for webviews)
   */
  public getAllTranslations(): TranslationData {
    return this.translations;
  }

  /**
   * Get translations for a specific section
   */
  public getSection<K extends keyof TranslationData>(section: K): TranslationData[K] {
    return this.translations[section];
  }

  /**
   * Get supported locales list
   */
  public getSupportedLocales(): LocaleInfo[] {
    return SUPPORTED_LOCALES;
  }

  /**
   * Get current locale info
   */
  public getCurrentLocaleInfo(): LocaleInfo {
    return SUPPORTED_LOCALES.find(l => l.code === this.currentLocale) || SUPPORTED_LOCALES[1]; // Default to English
  }

  /**
   * Check if a locale is supported
   */
  public isSupported(locale: string): boolean {
    return locale in locales;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._onDidChangeLocale.dispose();
    if (this._configListener) {
      this._configListener.dispose();
      this._configListener = undefined;
    }
  }
}

// Export singleton instance
export const i18n = I18nService.getInstance();

// Export convenience function
export function t(key: string, params?: Record<string, string | number>): string {
  return i18n.t(key, params);
}

// Export type for translations
export type { TranslationData };
