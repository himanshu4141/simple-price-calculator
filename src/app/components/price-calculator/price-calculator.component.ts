import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PricingService } from '../../services/pricing.service';
import { ProductFamily, Plan } from '../../models/pricing.model';

interface PriceBreakdown {
  basePrice: number;
  seatPrice: number;
  seatQuantity: number;
  packagePrice?: number;
  packageQuantity?: number;
  freePackages?: number;
  apiPrice?: number;
  apiCalls?: number;
  total: number;
}

interface Selection {
  selectedPlan: string | null;
  seats: number;
  packages: number;
  apiCalls: number;
  pricing: PriceBreakdown;
}

@Component({
  selector: 'app-price-calculator',
  templateUrl: './price-calculator.component.html',
  styleUrls: ['./price-calculator.component.scss']
})
export class PriceCalculatorComponent implements OnInit {
  productFamilies: ProductFamily[] = [];
  selectedTerm: '1year' | '3year' = '1year';
  selections: { [key: string]: Selection } = {};
  totalPrice = 0;
  isConfigureMode = false;
  sourceProduct = '';
  sourcePlan = '';

  constructor(
    private pricingService: PricingService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Handle URL parameters for configure mode
    this.route.queryParams.subscribe(params => {
      if (params['mode'] === 'configure') {
        this.isConfigureMode = true;
        this.sourceProduct = params['product'] || '';
        this.sourcePlan = params['plan'] || '';
        if (params['term']) {
          this.selectedTerm = params['term'] as '1year' | '3year';
        }
      }
    });

    // Load pricing data
    this.pricingService.fetchPricingData().subscribe(data => {
      this.productFamilies = data.productFamilies;
      // Initialize selections for each product family
      this.productFamilies.forEach(family => {
        this.selections[family.name] = {
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
      });
      
      // Pre-configure if coming from pricing page
      if (this.isConfigureMode && this.sourceProduct && this.sourcePlan) {
        const family = this.productFamilies.find(f => f.name === this.sourceProduct);
        if (family && this.selections[this.sourceProduct]) {
          this.selections[this.sourceProduct].selectedPlan = this.sourcePlan;
          this.calculatePricing(this.sourceProduct);
        }
      }
    });
  }

  getPlanPrice(family: ProductFamily, planName: string, seats: number): number {
    const plan = family.plans.find(p => p.name === planName);
    if (!plan) return 0;

    const pricing = this.selectedTerm === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    const tier = pricing
      .slice()
      .reverse()
      .find(t => seats >= t.minSeats);
    
    return tier?.price || 0;
  }

  getMaxSeats(familyName: string): number {
    const family = this.productFamilies.find(f => f.name === familyName);
    if (!family || !family.plans.length) return 10000;
    
    // Get the max seat tier from the pricing data
    const maxSeats = family.plans.reduce((max, plan) => {
      const oneYearMax = Math.max(...plan.oneYearPricing.map(tier => tier.minSeats));
      const threeYearMax = Math.max(...plan.threeYearPricing.map(tier => tier.minSeats));
      return Math.max(max, oneYearMax, threeYearMax);
    }, 0);
    
    return maxSeats || 10000; // Fallback to 10000 if no tiers found
  }

  calculatePricing(familyName: string): void {
    const family = this.productFamilies.find(f => f.name === familyName);
    const selection = this.selections[familyName];
    if (!family || !selection.selectedPlan) return;

    const plan = family.plans.find(p => p.name === selection.selectedPlan);
    if (!plan) return;

    const seatPrice = this.getPlanPrice(family, selection.selectedPlan, selection.seats);
    const freePackages = (plan.freePackagesPerSeat || 0) * selection.seats;
    const extraPackages = Math.max(0, selection.packages - freePackages);
    const apiCallCost = plan.apiPrice ? selection.apiCalls * plan.apiPrice : 0;

    selection.pricing = {
      basePrice: 0, // Base price is included in seat price
      seatPrice,
      seatQuantity: selection.seats,
      packagePrice: plan.packagePrice || 0,
      packageQuantity: extraPackages,
      freePackages,
      apiPrice: plan.apiPrice || 0,
      apiCalls: selection.apiCalls,
      total: (seatPrice * selection.seats) + (extraPackages * (plan.packagePrice || 0)) + apiCallCost
    };

    this.updateTotal();
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

  getVolumeTier(familyName: string): number {
    const family = this.productFamilies.find(f => f.name === familyName);
    const selection = this.selections[familyName];
    
    if (!family || !selection.selectedPlan) return 0;
    
    const plan = family.plans.find(p => p.name === selection.selectedPlan);
    if (!plan) return 0;
    
    const pricing = this.selectedTerm === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    const currentTier = pricing
      .filter(tier => selection.seats >= tier.minSeats)
      .sort((a, b) => b.minSeats - a.minSeats)[0];
      
    return currentTier?.minSeats || 0;
  }

  // Add configured plan to cart
  addToCart(familyName: string): void {
    const selection = this.selections[familyName];
    if (!selection.selectedPlan) return;

    const queryParams: any = {
      product: familyName,
      plan: selection.selectedPlan,
      term: this.selectedTerm,
      seats: selection.seats
    };

    // Add Sign-specific parameters if applicable
    if (familyName === 'Nitro Sign') {
      if (selection.packages > 0) {
        queryParams.packages = selection.packages;
      }
      if (selection.apiCalls > 0) {
        queryParams.apiCalls = selection.apiCalls;
      }
    }

    this.router.navigate(['/cart'], { queryParams });
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
    // Add all valid selections to cart and navigate
  addAllToCart(): void {
    const params: any = {
      term: this.selectedTerm,
      fromCalculator: 'true'
    };

    // Add each valid selection to the parameters
    this.productFamilies.forEach(family => {
      const selection = this.selections[family.name];
      if (selection?.selectedPlan) {
        const familyKey = family.name.toLowerCase().replace(' ', '');
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

    // Navigate to cart with all selections
    this.router.navigate(['/cart'], { queryParams: params });
  }

  // Reset calculator to initial state
  resetCalculator(): void {
    // Reset all selections
    this.productFamilies.forEach(family => {
      this.selections[family.name] = {
        selectedPlan: null,
        seats: 1,
        packages: 0,
        apiCalls: 0,
        pricing: {
          basePrice: 0,
          seatPrice: 0,
          seatQuantity: 0,
          packagePrice: 0,
          packageQuantity: 0,
          freePackages: 0,
          apiPrice: 0,
          apiCalls: 0,
          total: 0
        }
      };
    });
    
    // Reset term and totals
    this.selectedTerm = '1year';
    this.totalPrice = 0;
  }
}
