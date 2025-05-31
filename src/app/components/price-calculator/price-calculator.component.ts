import { Component, OnInit } from '@angular/core';
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

  constructor(private pricingService: PricingService) {}

  ngOnInit(): void {
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
}
