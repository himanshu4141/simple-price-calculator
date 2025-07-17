import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

import {
  PricingService,
  ProductFamily,
  Plan,
  BillingTerm,
  PricingApiResponse
} from '../../services/pricing.service';
import { LocalizationService } from '../../services/localization.service';
import { SalesContactModalComponent } from '../sales-contact-modal/sales-contact-modal.component';

@Component({
  selector: 'app-pricing-page',
  templateUrl: './pricing-page.component.html',
  styleUrls: ['./pricing-page.component.scss']
})
export class PricingPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  
  productFamilies: ProductFamily[] = [];
  selectedTerm: BillingTerm = '1year';
  isLoading = true;
  loadingError: string | null = null;

  constructor(
    private readonly pricingService: PricingService,
    private readonly localizationService: LocalizationService,
    private readonly router: Router,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPricingData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPricingData(): void {
    this.isLoading = true;
    this.loadingError = null;

    // Listen to currency changes and reload pricing data
    this.localizationService.localization$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(state => {
          console.log('💰 Currency changed, reloading pricing data for:', state.currency.code);
          return this.pricingService.fetchPricingData(state.currency.code);
        })
      )
      .subscribe({
        next: (response: PricingApiResponse) => {
          this.productFamilies = response.productFamilies || [];
          this.isLoading = false;
          console.log('✅ Pricing data loaded:', {
            families: this.productFamilies.length,
            currency: this.getCurrentCurrency()
          });
        },
        error: (error) => {
          console.error('❌ Error loading pricing data:', error);
          this.loadingError = 'Failed to load pricing data. Please try again.';
          this.isLoading = false;
          this.productFamilies = [];
        }
      });
  }

  /**
   * Calculate the best tier price for a given seat count
   */
  getTierPrice(plan: Plan, seats: number): number {
    const pricing = this.selectedTerm === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    
    // Find the applicable tier (highest minSeats that doesn't exceed seat count)
    const applicableTier = pricing
      .slice()
      .reverse()
      .find(tier => seats >= tier.minSeats);
    
    return applicableTier?.price || 0;
  }

  /**
   * Get the starting price for a plan (usually for 1 seat)
   */
  getStartingPrice(plan: Plan): number {
    return this.getTierPrice(plan, 1);
  }

  /**
   * Get the price at a specific tier (commonly used for 10 or 50 seats)
   */
  getPriceAtTier(plan: Plan, seats: number): number {
    return this.getTierPrice(plan, seats);
  }

  /**
   * Check if a plan has volume discounts
   */
  hasVolumeDiscount(plan: Plan): boolean {
    const pricing = this.selectedTerm === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    return pricing.length > 1;
  }

  /**
   * Get the maximum tier seats for display
   */
  getMaxTierSeats(plan: Plan): number {
    const pricing = this.selectedTerm === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    return Math.max(...pricing.map(tier => tier.minSeats));
  }

  /**
   * Buy Now - direct to enhanced cart for 1-year terms
   */
  buyNow(family: ProductFamily, planName: string): void {
    this.router.navigate(['/enhanced-cart'], {
      queryParams: {
        product: family.name,
        plan: planName,
        term: this.selectedTerm,
        seats: 1,
        buyNow: 'true'
      }
    });
  }

  /**
   * Navigate to full calculator
   */
  openCalculator(): void {
    this.router.navigate(['/calculator']);
  }

  /**
   * Navigate to calculator (alias for compatibility)
   */
  goToCalculator(): void {
    this.openCalculator();
  }

  /**
   * Change billing term and recalculate
   */
  onTermChange(term: BillingTerm): void {
    this.selectedTerm = term;
    console.log('📅 Term changed to:', term);
  }

  /**
   * Format price using localization service
   */
  formatPrice(price: number): string {
    return this.localizationService.formatCurrency(price);
  }

  /**
   * Get current currency code
   */
  getCurrentCurrency(): string {
    return this.localizationService.currentCurrency;
  }

  /**
   * Get current currency info for display
   */
  getCurrentCurrencyInfo() {
    return this.localizationService.currentCurrencyInfo;
  }

  /**
   * Calculate savings between terms
   */
  calculateSavings(plan: Plan, seats: number = 1): number {
    if (plan.oneYearPricing.length === 0 || plan.threeYearPricing.length === 0) {
      return 0;
    }

    const oneYearPrice = this.getTierPrice(plan, seats) * 3; // 3 years at 1-year pricing
    const threeYearPrice = this.getTierPrice({...plan, oneYearPricing: plan.threeYearPricing, threeYearPricing: plan.oneYearPricing}, seats) * 3;
    
    return Math.max(0, oneYearPrice - threeYearPrice);
  }

  /**
   * Calculate savings percentage
   */
  calculateSavingsPercentage(plan: Plan, seats: number = 1): number {
    const savings = this.calculateSavings(plan, seats);
    const oneYearTotal = this.getTierPrice(plan, seats) * 3;
    
    if (oneYearTotal === 0) return 0;
    return Math.round((savings / oneYearTotal) * 100);
  }

  /**
   * Retry loading pricing data
   */
  retryLoading(): void {
    this.loadPricingData();
  }

  /**
   * Get display text for features
   */
  getFeatureDisplayText(feature: string): string {
    return feature;
  }

  /**
   * Get tooltip for features
   */
  getFeatureTooltip(feature: string): string {
    // Add feature-specific tooltips as needed
    const tooltips: Record<string, string> = {
      'OCR technology': 'Optical Character Recognition - convert scanned documents to editable text',
      'API integrations': 'Connect Nitro Sign with your existing business applications',
      'Advanced workflows': 'Create complex signing processes with multiple signers and approval steps'
    };
    return tooltips[feature] || feature;
  }

  /**
   * Check if feature is technical and needs tooltip
   */
  isFeatureTechnical(feature: string): boolean {
    const technicalFeatures = ['OCR technology', 'API integrations', 'Advanced workflows'];
    return technicalFeatures.includes(feature);
  }

  /**
   * Get team suggestion text for a plan
   */
  getTeamSuggestion(planName: string): string | null {
    const suggestions: Record<string, string> = {
      'Nitro PDF Standard': 'Perfect for small teams',
      'Nitro PDF Plus': 'Ideal for growing businesses',
      'Nitro Sign Standard': 'Great for small teams',
      'Nitro Sign Plus': 'Perfect for medium teams',
      'Nitro Sign Enterprise': 'Built for large organizations'
    };
    return suggestions[planName] || null;
  }

  /**
   * Open contact sales modal for 3-year terms
   */
  openContactSalesModal(family: ProductFamily, planName: string): void {
    const dialogRef = this.dialog.open(SalesContactModalComponent, {
      width: '500px',
      data: {
        productFamily: family.name,
        planName: planName,
        term: this.selectedTerm,
        source: 'pricing-page'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.submitted) {
        // Handle successful form submission if needed
        console.log('Sales contact form submitted:', result);
      }
    });
  }
}
