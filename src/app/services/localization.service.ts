import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LocationService } from './location.service';
import { take } from 'rxjs/operators';

export interface CurrencyInfo {
  readonly code: string;
  readonly symbol: string;
  readonly name: string;
  readonly flag: string;
}

export interface LocalizationState {
  readonly currency: CurrencyInfo;
  readonly locale: string;
}

export const SUPPORTED_CURRENCIES: readonly CurrencyInfo[] = [
  {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    flag: '🇺🇸'
  },
  {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    flag: '🇪🇺'
  },
  {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    flag: '🇬🇧'
  },
  {
    code: 'CAD',
    symbol: 'C$',
    name: 'Canadian Dollar',
    flag: '🇨🇦'
  },
  {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    flag: '🇦🇺'
  }
] as const;

const DEFAULT_CURRENCY = SUPPORTED_CURRENCIES[0]; // USD
const DEFAULT_LOCALE = 'en-US';
const STORAGE_KEY = 'nitro-localization';
const AUTO_DETECT_KEY = 'nitro-auto-detect-complete';

@Injectable({
  providedIn: 'root'
})
export class LocalizationService {
  private readonly localizationSubject = new BehaviorSubject<LocalizationState>(this.loadSavedState());
  private autoDetectCompleted = false;

  constructor(private readonly locationService: LocationService) {
    // Initialize with saved state or defaults
    const initialState = this.loadSavedState();
    this.localizationSubject.next(initialState);
    
    // Check if auto-detection should run
    this.checkAndRunAutoDetection();
  }

  /**
   * Get current localization state as observable
   */
  get localization$(): Observable<LocalizationState> {
    return this.localizationSubject.asObservable();
  }

  /**
   * Get current localization state (synchronous)
   */
  get currentLocalization(): LocalizationState {
    return this.localizationSubject.value;
  }

  /**
   * Get current currency code
   */
  get currentCurrency(): string {
    return this.currentLocalization.currency.code;
  }

  /**
   * Get current currency info
   */
  get currentCurrencyInfo(): CurrencyInfo {
    return this.currentLocalization.currency;
  }

  /**
   * Set currency by code
   */
  setCurrency(currencyCode: string): void {
    const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
    if (!currency) {
      console.warn(`Unsupported currency code: ${currencyCode}`);
      return;
    }

    const newState: LocalizationState = {
      ...this.currentLocalization,
      currency,
      locale: this.getLocaleForCurrency(currencyCode)
    };

    this.updateState(newState);
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): readonly CurrencyInfo[] {
    return SUPPORTED_CURRENCIES;
  }

  /**
   * Format currency amount for current locale
   */
  formatCurrency(amount: number, currencyCode?: string): string {
    const currency = currencyCode 
      ? SUPPORTED_CURRENCIES.find(c => c.code === currencyCode) 
      : this.currentCurrencyInfo;
    
    if (!currency) {
      return `${amount}`;
    }

    // Use Intl.NumberFormat for proper currency formatting
    try {
      return new Intl.NumberFormat(this.currentLocalization.locale, {
        style: 'currency',
        currency: currency.code,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      // Fallback to manual formatting if Intl fails
      return `${currency.symbol}${amount.toFixed(2)}`;
    }
  }

  /**
   * Format currency amount with custom symbol placement
   */
  formatCurrencyWithSymbol(amount: number, showSymbol: boolean = true): string {
    const currency = this.currentCurrencyInfo;
    
    if (!showSymbol) {
      return amount.toFixed(2);
    }

    return `${currency.symbol}${amount.toFixed(2)}`;
  }

  /**
   * Reset to default localization
   */
  reset(): void {
    const defaultState: LocalizationState = {
      currency: DEFAULT_CURRENCY,
      locale: DEFAULT_LOCALE
    };

    this.updateState(defaultState);
  }

  /**
   * Update localization state and persist to storage
   */
  private updateState(newState: LocalizationState): void {
    this.localizationSubject.next(newState);
    this.saveState(newState);
    
    console.log('🌍 Localization updated:', {
      currency: newState.currency.code,
      locale: newState.locale
    });
  }

  /**
   * Load saved state from localStorage or return defaults
   */
  private loadSavedState(): LocalizationState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Validate saved currency still exists in supported list
        const currency = SUPPORTED_CURRENCIES.find(c => c.code === parsed.currency?.code);
        if (currency) {
          return {
            currency,
            locale: parsed.locale || this.getLocaleForCurrency(currency.code)
          };
        }
      }
    } catch (error) {
      console.warn('Failed to load saved localization state:', error);
    }

    // Return defaults if no valid saved state
    return {
      currency: DEFAULT_CURRENCY,
      locale: DEFAULT_LOCALE
    };
  }

  /**
   * Save current state to localStorage
   */
  private saveState(state: LocalizationState): void {
    try {
      const toSave = {
        currency: state.currency,
        locale: state.locale
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.warn('Failed to save localization state:', error);
    }
  }

  /**
   * Get appropriate locale for currency
   */
  private getLocaleForCurrency(currencyCode: string): string {
    const localeMap: Record<string, string> = {
      'USD': 'en-US',
      'EUR': 'en-GB', // Using en-GB for EUR as it's commonly used in Europe
      'GBP': 'en-GB',
      'CAD': 'en-CA',
      'AUD': 'en-AU'
    };

    return localeMap[currencyCode] || DEFAULT_LOCALE;
  }

  /**
   * Check if auto-detection should run and execute it
   */
  private checkAndRunAutoDetection(): void {
    try {
      // Check if auto-detection has already been completed
      const autoDetectComplete = localStorage.getItem(AUTO_DETECT_KEY);
      if (autoDetectComplete) {
        this.autoDetectCompleted = true;
        return;
      }

      // Check if user has manually set a currency
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        // User has made a manual selection, don't override
        this.autoDetectCompleted = true;
        localStorage.setItem(AUTO_DETECT_KEY, 'true');
        return;
      }

      // Run auto-detection
      this.runLocationBasedAutoDetection();
    } catch (error) {
      console.warn('Failed to check auto-detection state:', error);
      this.autoDetectCompleted = true;
    }
  }

  /**
   * Run location-based currency auto-detection
   */
  private runLocationBasedAutoDetection(): void {
    console.log('🌍 Running location-based currency auto-detection...');
    
    this.locationService.detectUserLocation()
      .pipe(take(1))
      .subscribe({
        next: (locationInfo) => {
          console.log('📍 Location detected:', locationInfo);
          
          if (locationInfo.currency && locationInfo.currency !== this.currentCurrency) {
            console.log(`💱 Auto-setting currency from ${this.currentCurrency} to ${locationInfo.currency} based on location: ${locationInfo.country}`);
            this.setCurrency(locationInfo.currency);
          }
          
          // Mark auto-detection as complete
          this.autoDetectCompleted = true;
          localStorage.setItem(AUTO_DETECT_KEY, 'true');
        },
        error: (error) => {
          console.warn('❌ Location-based auto-detection failed:', error);
          // Mark as complete even on failure to avoid retries
          this.autoDetectCompleted = true;
          localStorage.setItem(AUTO_DETECT_KEY, 'true');
        }
      });
  }

  /**
   * Reset auto-detection (for testing purposes)
   */
  resetAutoDetection(): void {
    localStorage.removeItem(AUTO_DETECT_KEY);
    this.autoDetectCompleted = false;
  }
}
