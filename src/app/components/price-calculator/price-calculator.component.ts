import { Component, OnInit } from '@angular/core';
import { PricingService } from '../../services/pricing.service';
import { ProductFamily, Plan } from '../../models/pricing.model';

@Component({
  selector: 'app-price-calculator',
  templateUrl: './price-calculator.component.html',
  styleUrls: ['./price-calculator.component.scss']
})
export class PriceCalculatorComponent implements OnInit {
  productFamilies: ProductFamily[] = [];
  selectedTerm: '1year' | '3year' = '1year';

  // State for each product family
  selections: {
    [family: string]: {
      selectedPlan: string;
      seats: number;
      packages: number;
      apiCalls: number;
      totalPrice: number | null;
      breakdown?: {
        seatCost?: number;
        packageCost?: number;
        apiCost?: number;
        freePackages?: number;
        extraPackages?: number;
        seatUnitPrice?: number;
      };
    }
  } = {};

  combinedTotal: number | null = null;

  constructor(private pricingService: PricingService) {}

  ngOnInit(): void {
    this.pricingService.fetchPricingData().subscribe(data => {
      if (data && Array.isArray(data.productFamilies)) {
        this.productFamilies = data.productFamilies;
        // Initialize state for each family
        for (const family of this.productFamilies) {
          this.selections[family.name] = {
            selectedPlan: '',
            seats: 1,
            packages: 0,
            apiCalls: 0,
            totalPrice: null
          };
        }
      }
    });
  }

  getPlans(familyName: string): Plan[] {
    const family = this.productFamilies.find(f => f.name === familyName);
    return family ? family.plans : [];
  }

  showSignOptions(familyName: string): boolean {
    return familyName === 'Nitro Sign' && !!this.selections[familyName]?.selectedPlan;
  }

  calculateTotal(): void {
    let total = 0;
    for (const family of this.productFamilies) {
      const sel = this.selections[family.name];
      if (!sel.selectedPlan) {
        sel.totalPrice = null;
        continue;
      }
      // Calculate price breakdown for Nitro Sign (with free packages)
      let price = this.pricingService.calculatePrice(
        family,
        sel.selectedPlan,
        sel.seats,
        sel.packages,
        sel.apiCalls,
        this.selectedTerm
      );
      // For Nitro Sign, show breakdown
      if (family.name === 'Nitro Sign') {
        const plan = family.plans.find(p => p.name === sel.selectedPlan);
        if (plan) {
          const freePackages = (plan.freePackagesPerSeat || 0) * sel.seats;
          const extraPackages = Math.max(0, sel.packages - freePackages);
          const packageCost = extraPackages * (plan.packagePrice || 0);
          const apiCost = sel.apiCalls * (plan.apiPrice || 0);
          const seatUnitPrice = this.pricingService.getRampPrice(plan, sel.seats, this.selectedTerm);
          const seatCost = seatUnitPrice * sel.seats;
          sel.breakdown = {
            seatCost,
            packageCost,
            apiCost,
            freePackages,
            extraPackages
          };
          price = seatCost + packageCost + apiCost;
        }
      } else {
        // For PDF, just show seat cost
        const plan = family.plans.find(p => p.name === sel.selectedPlan);
        if (plan) {
          const seatUnitPrice = this.pricingService.getRampPrice(plan, sel.seats, this.selectedTerm);
          const seatCost = seatUnitPrice * sel.seats;
          sel.breakdown = {
            seatCost,
            seatUnitPrice
          };
        }
      }
      sel.totalPrice = price;
      total += sel.totalPrice || 0;
    }
    this.combinedTotal = total > 0 ? total : null;
  }

  getSelectedPlanPrice(familyName: string, priceType: 'packagePrice' | 'apiPrice'): number {
    const plan = this.getPlans(familyName).find(
      p => p.name === this.selections[familyName].selectedPlan
    );
    const value = plan && typeof plan[priceType] === 'number' ? plan[priceType] : 0;
    return value as number;
  }
}