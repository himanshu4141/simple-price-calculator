// Angular core and common modules
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// RxJS modules
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// Environment-specific imports
import { environment } from '../../environments/environment';

// Core interfaces for better type safety
export interface RampPricing {
  readonly minSeats: number;
  readonly price: number;
}

export interface Plan {
  readonly name: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly oneYearPricing: readonly RampPricing[];
  readonly threeYearPricing: readonly RampPricing[];
  readonly packagePrice?: number;
  readonly apiPrice?: number;
  readonly freePackagesPerSeat?: number;
}

export interface ProductFamily {
  readonly name: string;
  readonly description: string;
  readonly plans: readonly Plan[];
}

export interface CartItem {
  readonly productFamily: string;
  readonly planName: string;
  readonly seats: number;
  readonly packages?: number;
  readonly apiCalls?: number;
  readonly term: BillingTerm;
  readonly price: number;
}

export interface PlanPricing {
  readonly basePrice: number;
  readonly seatPrice?: number;
  readonly packagePrice?: number;
  readonly apiCallPrice?: number;
}

// Backend API Response Interfaces
export interface PricingApiResponse {
  readonly productFamilies: ProductFamily[];
  readonly supportedCurrencies: readonly string[];
  readonly lastUpdated: string;
}

export interface EstimateItemRequest {
  readonly productFamily: string;
  readonly planName: string;
  readonly seats: number;
  readonly packages?: number;
  readonly apiCalls?: number;
}

export interface EstimateRequest {
  items: EstimateItemRequest[];
  currency: string;
  billingTerm: string;
}

export interface EstimateItemResponse {
  productFamily: string;
  planName: string;
  seats: number;
  basePrice: number;
  packagesPrice: number;
  apiCallsPrice: number;
  totalPrice: number;
  appliedTier: string;
  includedPackages?: number;
  extraPackages?: number;
}

export interface EstimateResponse {
  items: EstimateItemResponse[];
  subtotal: number;
  total: number;
  currency: string;
  billingTerm: string;
}

// Type unions for better type safety
export type BillingTerm = '1year' | '3year';
export type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

// Constants for better maintainability
export const BILLING_TERMS = {
  ONE_YEAR: '1year',
  THREE_YEAR: '3year'
} as const;

export const DEFAULT_FREE_PACKAGES_PER_SEAT = 200;

export const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = [
  'USD',
  'EUR', 
  'GBP',
  'CAD',
  'AUD'
] as const;

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  private readonly fallbackPricingDataUrl = environment.pricingDataUrl;
  private readonly apiUrl = environment.apiUrl;
  private cachedPricingData: PricingApiResponse | null = null;

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Fetch pricing data from backend API with fallback to static data
   */
  fetchPricingData(currency: string = 'USD'): Observable<PricingApiResponse> {
    console.log(`🔄 Fetching pricing data from backend API for currency: ${currency}`);
    
    return this.httpClient.get<PricingApiResponse>(`${this.apiUrl}/pricing?currency=${currency}`).pipe(
      map(response => {
        console.log('✅ Successfully fetched pricing data from backend API:', {
          productFamilies: response.productFamilies?.length || 0,
          supportedCurrencies: response.supportedCurrencies?.length || 0,
          lastUpdated: response.lastUpdated
        });
        this.cachedPricingData = response;
        return response;
      }),
      catchError(error => {
        console.warn('⚠️ Failed to fetch pricing from backend API, falling back to static data:', error);
        return this.fetchFallbackPricingData();
      })
    );
  }

  /**
   * Fallback to static pricing data when backend is unavailable
   */
  private fetchFallbackPricingData(): Observable<PricingApiResponse> {
    console.log('📁 Falling back to static pricing data from:', this.fallbackPricingDataUrl);
    
    return this.httpClient.get<{ productFamilies: ProductFamily[] }>(this.fallbackPricingDataUrl).pipe(
      map(staticData => {
        console.log('✅ Successfully loaded fallback static data:', {
          productFamilies: staticData.productFamilies?.length || 0
        });
        return {
          productFamilies: staticData.productFamilies || [],
          supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
          lastUpdated: new Date().toISOString()
        };
      }),
      catchError(error => {
        console.error('❌ Failed to load fallback static data:', error);
        return of({
          productFamilies: [],
          supportedCurrencies: ['USD'],
          lastUpdated: new Date().toISOString()
        });
      })
    );
  }

  /**
   * Get pricing estimate from backend API with fallback to local calculation
   */
  getEstimate(request: EstimateRequest): Observable<EstimateResponse> {
    console.log('🧮 Requesting estimate from backend API:', {
      items: request.items.length,
      currency: request.currency,
      billingTerm: request.billingTerm
    });
    
    return this.httpClient.post<EstimateResponse>(`${this.apiUrl}/estimate`, request).pipe(
      map(response => {
        console.log('✅ Successfully received estimate from backend API:', {
          subtotal: response.subtotal,
          total: response.total,
          itemsCount: response.items.length
        });
        return response;
      }),
      catchError(error => {
        console.warn('⚠️ Failed to get estimate from backend API, falling back to local calculation:', error);
        return this.calculateLocalEstimate(request);
      })
    );
  }

  /**
   * Fallback estimate calculation using cached pricing data
   */
  private calculateLocalEstimate(request: EstimateRequest): Observable<EstimateResponse> {
    if (!this.cachedPricingData) {
      return of({
        items: [],
        subtotal: 0,
        total: 0,
        currency: request.currency,
        billingTerm: request.billingTerm
      });
    }

    const items = request.items.map(item => this.calculateItemEstimate(item, request.billingTerm));
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

    return of({
      items,
      subtotal,
      total: subtotal,
      currency: request.currency,
      billingTerm: request.billingTerm
    });
  }

  /**
   * Calculate estimate for a single item using cached pricing data
   */
  private calculateItemEstimate(item: EstimateItemRequest, billingTerm: string): EstimateItemResponse {
    const family = this.cachedPricingData?.productFamilies.find(f => f.name === item.productFamily);
    const plan = family?.plans.find(p => p.name === item.planName);

    if (!plan) {
      return {
        productFamily: item.productFamily,
        planName: item.planName,
        seats: item.seats,
        basePrice: 0,
        packagesPrice: 0,
        apiCallsPrice: 0,
        totalPrice: 0,
        appliedTier: 'Unknown'
      };
    }

    const pricing = billingTerm.toLowerCase().includes('3') ? plan.threeYearPricing : plan.oneYearPricing;
    const applicableTier = [...pricing]
      .sort((a, b) => b.minSeats - a.minSeats)
      .find(tier => item.seats >= tier.minSeats);

    const basePrice = applicableTier ? item.seats * applicableTier.price : 0;
    const appliedTier = applicableTier ? `$${applicableTier.price}/seat` : 'Unknown';

    // Calculate packages cost
    let packagesPrice = 0;
    let includedPackages: number | undefined;
    let extraPackages: number | undefined;

    if (item.packages && plan.packagePrice) {
      if (plan.freePackagesPerSeat) {
        includedPackages = item.seats * plan.freePackagesPerSeat;
        extraPackages = Math.max(0, item.packages - includedPackages);
        packagesPrice = extraPackages * plan.packagePrice;
      } else {
        packagesPrice = item.packages * plan.packagePrice;
        extraPackages = item.packages;
      }
    }

    // Calculate API calls cost
    const apiCallsPrice = (item.apiCalls || 0) * (plan.apiPrice || 0);

    return {
      productFamily: item.productFamily,
      planName: item.planName,
      seats: item.seats,
      basePrice,
      packagesPrice,
      apiCallsPrice,
      totalPrice: basePrice + packagesPrice + apiCallsPrice,
      appliedTier,
      includedPackages,
      extraPackages
    };
  }

  /**
   * Pure function - calculate price locally (fallback method)
   */
  calculatePrice(
    productFamily: ProductFamily, 
    planName: string, 
    seats: number, 
    packages: number = 0, 
    apiCalls: number = 0, 
    term: BillingTerm
  ): number {
    const plan = this.findPlanByName(productFamily, planName);
    if (!plan) {
      return 0;
    }

    const pricing = term === BILLING_TERMS.ONE_YEAR ? plan.oneYearPricing : plan.threeYearPricing;
    const applicableTier = this.findApplicablePricingTier(pricing, seats);

    if (!applicableTier) {
      return 0;
    }

    let total = seats * applicableTier.price;

    if (plan.freePackagesPerSeat && plan.packagePrice) {
      const freePackages = seats * plan.freePackagesPerSeat;
      const extraPackages = Math.max(0, packages - freePackages);
      total += extraPackages * plan.packagePrice;
    }

    if (plan.apiPrice && apiCalls > 0) {
      total += apiCalls * plan.apiPrice;
    }

    return total;
  }

  /**
   * Pure function - find plan by name
   */
  private findPlanByName(productFamily: ProductFamily, planName: string): Plan | null {
    return productFamily.plans.find(plan => plan.name === planName) ?? null;
  }

  /**
   * Pure function - find applicable pricing tier
   */
  private findApplicablePricingTier(pricing: readonly RampPricing[], seats: number): RampPricing | null {
    return [...pricing]
      .sort((a, b) => b.minSeats - a.minSeats)
      .find(tier => seats >= tier.minSeats) ?? null;
  }

  /**
   * Legacy method for backward compatibility - get ramp price per seat
   */
  getRampPrice(plan: any, seats: number, term: '1year' | '3year'): number {
    const pricing = term === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    const applicableTier = [...pricing]
      .sort((a, b) => b.minSeats - a.minSeats)
      .find(tier => seats >= tier.minSeats);
    return applicableTier ? applicableTier.price : 0;
  }

  /**
   * Get supported currencies from backend or default list
   */
  getSupportedCurrencies(): readonly SupportedCurrency[] {
    return this.cachedPricingData?.supportedCurrencies as readonly SupportedCurrency[] ?? SUPPORTED_CURRENCIES;
  }

  /**
   * Check if backend API is available
   */
  checkApiHealth(): Observable<boolean> {
    return this.httpClient.get(`${this.apiUrl}/health`).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}