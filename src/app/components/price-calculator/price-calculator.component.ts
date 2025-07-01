import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

import {
  PricingService,
  ProductFamily,
  Plan,
  RampPricing,
  BillingTerm,
  PricingApiResponse
} from '../../services/pricing.service';
import { LocalizationService } from '../../services/localization.service';
import { SalesContactModalComponent } from '../sales-contact-modal/sales-contact-modal.component';

interface PriceBreakdown {
  readonly basePrice: number;
  readonly seatPrice: number;
  readonly seatQuantity: number;
  readonly packagePrice?: number;
  readonly packageQuantity?: number;
  readonly freePackages?: number;
  readonly apiPrice?: number;
  readonly apiCalls?: number;
  readonly total: number;
}

interface ProductSelection {
  selectedPlan: string | null;
  seats: number;
  packages: number;
  apiCalls: number;
  pricing: PriceBreakdown;
}

interface QueryParams {
  readonly mode?: string;
  readonly product?: string;
  readonly plan?: string;
  readonly term?: string;
}

@Component({
  selector: 'app-price-calculator',
  templateUrl: './price-calculator.component.html',
  styleUrls: ['./price-calculator.component.scss']
})
export class PriceCalculatorComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  productFamilies: ProductFamily[] = [];
  selectedTerm: BillingTerm = '1year';
  selections: Record<string, ProductSelection> = {};
  totalPrice = 0;
  isConfigureMode = false;
  sourceProduct = '';
  sourcePlan = '';

  constructor(
    private readonly pricingService: PricingService,
    private readonly localizationService: LocalizationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.initializeFromQueryParams();
    this.loadPricingData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeFromQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.parseConfigurationParams(params);
      });
  }

  private parseConfigurationParams(params: QueryParams): void {
    if (params.mode === 'configure') {
      this.isConfigureMode = true;
      this.sourceProduct = params.product || '';
      this.sourcePlan = params.plan || '';
      
      if (params.term && this.isValidBillingTerm(params.term)) {
        this.selectedTerm = params.term;
      }
    }
  }

  private isValidBillingTerm(term: string): term is BillingTerm {
    return term === '1year' || term === '3year';
  }

  private loadPricingData(): void {
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
          this.productFamilies = response.productFamilies;
          this.initializeSelections();
          this.handleConfigureMode();
        },
        error: (error) => {
          console.error('Error loading pricing data:', error);
          this.productFamilies = [];
        }
      });
  }

  private initializeSelections(): void {
    this.productFamilies.forEach(family => {
      this.selections[family.name] = this.createInitialSelection();
    });
  }

  private createInitialSelection(): ProductSelection {
    return {
      selectedPlan: null,
      seats: 1,
      packages: 0,
      apiCalls: 0,
      pricing: {
        basePrice: 0,
        seatPrice: 0,
        seatQuantity: 1,
        total: 0
      }
    };
  }

  private handleConfigureMode(): void {
    if (this.isConfigureMode && this.sourceProduct && this.sourcePlan) {
      const family = this.productFamilies.find(f => f.name === this.sourceProduct);
      if (family && this.selections[this.sourceProduct]) {
        this.selections[this.sourceProduct].selectedPlan = this.sourcePlan;
        this.calculatePricing(this.sourceProduct);
      }
    }
  }

  getPlanPrice(family: ProductFamily, planName: string, seats: number): number {
    const plan = family.plans.find((p: Plan) => p.name === planName);
    if (!plan) return 0;

    const pricing = this.selectedTerm === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    const tier = pricing
      .slice()
      .reverse()
      .find((t: RampPricing) => seats >= t.minSeats);
    
    return tier?.price || 0;
  }

  getMaxSeats(familyName: string): number {
    const family = this.productFamilies.find(f => f.name === familyName);
    if (!family || !family.plans.length) return 10000;
    
    // Get the max seat tier from the pricing data
    const maxSeats = family.plans.reduce((max: number, plan: Plan) => {
      const oneYearMax = Math.max(...plan.oneYearPricing.map((tier: RampPricing) => tier.minSeats));
      const threeYearMax = Math.max(...plan.threeYearPricing.map((tier: RampPricing) => tier.minSeats));
      return Math.max(max, oneYearMax, threeYearMax);
    }, 0);
    
    return maxSeats || 10000; // Fallback to 10000 if no tiers found
  }

  calculatePricing(familyName: string): void {
    const family = this.productFamilies.find(f => f.name === familyName);
    const selection = this.selections[familyName];
    if (!family || !selection.selectedPlan) return;

    const plan = family.plans.find((p: Plan) => p.name === selection.selectedPlan);
    if (!plan) return;

    const pricingBreakdown = this.calculatePricingBreakdown(plan, selection);
    selection.pricing = pricingBreakdown;
    this.updateTotal();
  }

  private calculatePricingBreakdown(plan: Plan, selection: ProductSelection): PriceBreakdown {
    const family = this.productFamilies.find(f => f.plans.includes(plan));
    if (!family) {
      throw new Error('Plan not found in any product family');
    }

    const seatPrice = this.pricingService.calculatePrice(
      family,
      plan.name,
      selection.seats,
      selection.packages,
      selection.apiCalls,
      this.selectedTerm
    );
    const freePackages = (plan.freePackagesPerSeat || 0) * selection.seats;
    const extraPackages = Math.max(0, selection.packages - freePackages);
    const apiCallCost = plan.apiPrice ? selection.apiCalls * plan.apiPrice : 0;

    return {
      basePrice: 0, // Base price is included in seat price
      seatPrice: seatPrice / selection.seats, // Get per-seat price
      seatQuantity: selection.seats,
      packagePrice: plan.packagePrice || 0,
      packageQuantity: extraPackages,
      freePackages,
      apiPrice: plan.apiPrice || 0,
      apiCalls: selection.apiCalls,
      total: seatPrice + (extraPackages * (plan.packagePrice || 0)) + apiCallCost
    };
  }

  updateTotal(): void {
    this.totalPrice = Object.values(this.selections)
      .reduce((sum, selection) => sum + selection.pricing.total, 0);
  }

  onPlanChange(familyName: string): void {
    if (this.selections[familyName].selectedPlan) {
      this.calculatePricing(familyName);
    }
  }

  onQuantityChange(familyName: string): void {
    this.calculatePricing(familyName);
  }

  onTermChange(): void {
    // Recalculate pricing for all product families when term changes
    this.productFamilies.forEach(family => {
      if (this.selections[family.name].selectedPlan) {
        this.calculatePricing(family.name);
      }
    });
    this.updateTotal();
  }

  formatNumber(value: number): string {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  }

  formatPrice(price: number): string {
    return this.localizationService.formatCurrency(price);
  }

  getCurrentCurrency(): string {
    return this.localizationService.currentCurrency;
  }

  getVolumeTier(familyName: string): number {
    const family = this.productFamilies.find(f => f.name === familyName);
    const selection = this.selections[familyName];
    
    if (!family || !selection.selectedPlan) return 0;
    
    const plan = family.plans.find((p: Plan) => p.name === selection.selectedPlan);
    if (!plan) return 0;
    
    const pricing = this.selectedTerm === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    const currentTier = pricing
      .filter((tier: RampPricing) => selection.seats >= tier.minSeats)
      .sort((a: RampPricing, b: RampPricing) => b.minSeats - a.minSeats)[0];
      
    return currentTier?.minSeats || 0;
  }

  // Add configured plan to cart
  addToCart(familyName: string): void {
    const selection = this.selections[familyName];
    if (!selection.selectedPlan) return;

    const queryParams = this.buildSingleCartQueryParams(familyName, selection);
    this.router.navigate(['/cart'], { queryParams });
  }

  private buildSingleCartQueryParams(familyName: string, selection: ProductSelection): Record<string, string | number> {
    const baseParams: Record<string, string | number> = {
      product: familyName,
      plan: selection.selectedPlan!,
      term: this.selectedTerm,
      seats: selection.seats
    };

    // Add Sign-specific parameters if applicable
    if (familyName === 'Nitro Sign') {
      if (selection.packages > 0) {
        baseParams.packages = selection.packages;
      }
      if (selection.apiCalls > 0) {
        baseParams.apiCalls = selection.apiCalls;
      }
    }

    return baseParams;
  }

  // Return to pricing page
  backToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  // Check if there are valid selections to show action buttons
  hasValidSelections(): boolean {
    return Object.values(this.selections).some(selection => 
      selection.selectedPlan && selection.seats > 0
    );
  }

  // Navigate to cart with all configured selections
  addAllToCart(): void {
    const params = this.buildAllCartQueryParams();
    this.router.navigate(['/cart'], { queryParams: params });
  }

  private buildAllCartQueryParams(): Record<string, string | number> {
    const params: Record<string, string | number> = {
      term: this.selectedTerm,
      fromCalculator: 'true'
    };

    // Add each valid selection to the parameters
    this.productFamilies.forEach(family => {
      const selection = this.selections[family.name];
      if (selection?.selectedPlan) {
        const familyKey = this.getFamilyParamKey(family.name);
        params[`${familyKey}_plan`] = selection.selectedPlan;
        params[`${familyKey}_seats`] = selection.seats;
        
        if (family.name === 'Nitro Sign') {
          if (selection.packages > 0) {
            params[`${familyKey}_packages`] = selection.packages;
          }
          if (selection.apiCalls > 0) {
            params[`${familyKey}_apiCalls`] = selection.apiCalls;
          }
        }
      }
    });

    return params;
  }

  private getFamilyParamKey(familyName: string): string {
    return familyName.toLowerCase().replace(' ', '');
  }

  // Reset calculator to initial state
  resetCalculator(): void {
    this.productFamilies.forEach(family => {
      this.selections[family.name] = this.createInitialSelection();
    });
    
    this.selectedTerm = '1year';
    this.totalPrice = 0;
  }

  /**
   * Open contact sales modal for 3-year terms
   */
  openContactSalesModal(): void {
    // Collect selected products for context
    const selectedProducts = Object.keys(this.selections)
      .filter(familyName => this.selections[familyName].selectedPlan)
      .map(familyName => ({
        family: familyName,
        plan: this.selections[familyName].selectedPlan,
        seats: this.selections[familyName].seats,
        packages: this.selections[familyName].packages || 0,
        apiCalls: this.selections[familyName].apiCalls || 0
      }));

    const dialogRef = this.dialog.open(SalesContactModalComponent, {
      width: '500px',
      data: {
        selectedProducts: selectedProducts,
        term: this.selectedTerm,
        totalPrice: this.totalPrice,
        source: 'calculator'
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
