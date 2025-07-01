import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';

export interface LocationInfo {
  country: string;
  countryCode: string;
  currency?: string;
  timezone?: string;
}

export interface IPApiResponse {
  country_name: string;
  country_code: string;
  currency: string;
  timezone: string;
  error?: boolean;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly API_URL = 'https://ipapi.co/json/';
  private readonly TIMEOUT_MS = 5000;
  
  // Mapping of country codes to supported currencies
  private readonly COUNTRY_TO_CURRENCY: Record<string, string> = {
    // United States
    'US': 'USD',
    // Eurozone countries
    'AD': 'EUR', 'AT': 'EUR', 'BE': 'EUR', 'CY': 'EUR', 'DE': 'EUR',
    'EE': 'EUR', 'ES': 'EUR', 'FI': 'EUR', 'FR': 'EUR', 'GR': 'EUR',
    'IE': 'EUR', 'IT': 'EUR', 'LT': 'EUR', 'LU': 'EUR', 'LV': 'EUR',
    'MC': 'EUR', 'MT': 'EUR', 'NL': 'EUR', 'PT': 'EUR', 'SI': 'EUR',
    'SK': 'EUR', 'SM': 'EUR', 'VA': 'EUR',
    // United Kingdom
    'GB': 'GBP',
    // Canada
    'CA': 'CAD',
    // Australia
    'AU': 'AUD'
  };

  constructor(private readonly http: HttpClient) {}

  /**
   * Detect user's location and return appropriate currency
   */
  detectUserLocation(): Observable<LocationInfo> {
    return this.http.get<IPApiResponse>(this.API_URL)
      .pipe(
        timeout(this.TIMEOUT_MS),
        map(response => {
          if (response.error) {
            throw new Error(response.reason || 'Failed to detect location');
          }

          const currency = this.getCurrencyForCountry(response.country_code);
          
          return {
            country: response.country_name,
            countryCode: response.country_code,
            currency,
            timezone: response.timezone
          };
        }),
        catchError(error => {
          console.warn('🌍 Location detection failed:', error);
          // Return default US location if detection fails
          return of({
            country: 'United States',
            countryCode: 'US',
            currency: 'USD',
            timezone: 'America/New_York'
          });
        })
      );
  }

  /**
   * Get supported currency for a country code
   * Returns USD as default for unsupported countries
   */
  getCurrencyForCountry(countryCode: string): string {
    return this.COUNTRY_TO_CURRENCY[countryCode] || 'USD';
  }

  /**
   * Check if a country is supported (has a mapped currency)
   */
  isCountrySupported(countryCode: string): boolean {
    return countryCode in this.COUNTRY_TO_CURRENCY;
  }

  /**
   * Get all supported countries
   */
  getSupportedCountries(): string[] {
    return Object.keys(this.COUNTRY_TO_CURRENCY);
  }

  /**
   * Get country name from timezone (fallback method)
   */
  getCountryFromTimezone(): string {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Simple mapping for common timezones
      if (timezone.includes('America/')) {
        if (timezone.includes('Toronto') || timezone.includes('Montreal')) {
          return 'CA';
        }
        return 'US';
      } else if (timezone.includes('Europe/')) {
        return 'GB'; // Default to UK for Europe
      } else if (timezone.includes('Australia/')) {
        return 'AU';
      }
      
      return 'US'; // Default fallback
    } catch (error) {
      console.warn('Failed to detect timezone:', error);
      return 'US';
    }
  }
}