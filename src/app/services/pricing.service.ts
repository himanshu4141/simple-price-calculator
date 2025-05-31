import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { ProductFamily } from '../models/pricing.model';
import { catchError } from 'rxjs/operators';

export interface PlanPricing {
  basePrice: number;
  seatPrice?: number;
  packagePrice?: number;
  apiCallPrice?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  private pricingDataUrl = 'assets/pricing-data.json';
  private pricingData: { [key: string]: { [key: string]: PlanPricing } } = {};

  constructor(private http: HttpClient) {
    this.loadPricingData();
  }

  private loadPricingData() {
    this.http.get<any>('assets/pricing-data.json').subscribe(data => {
      this.pricingData = data;
    });
  }

  fetchPricingData(): Observable<{ productFamilies: ProductFamily[] }> {
    return this.http.get<{ productFamilies: ProductFamily[] }>(this.pricingDataUrl).pipe(
      catchError(() => of({ productFamilies: [] }))
    );
  }

  getPricingForPlan(familyName: string, planName: string): PlanPricing {
    return this.pricingData[familyName]?.[planName] || {
      basePrice: 0,
      seatPrice: 0,
      packagePrice: 0,
      apiCallPrice: 0
    };
  }

  calculatePrice(productFamily: ProductFamily, planName: string, seats: number, packages: number = 0, apiCalls: number = 0, term: '1year' | '3year'): number {
    const plan = productFamily.plans.find(p => p.name === planName);
    if (!plan) return 0;

    const pricing = term === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    const applicableTier = [...pricing]
      .sort((a, b) => b.minSeats - a.minSeats)
      .find(tier => seats >= tier.minSeats);

    if (!applicableTier) return 0;

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

  // Helper to get ramp price per seat for a plan
  getRampPrice(plan: any, seats: number, term: '1year' | '3year'): number {
    const pricing = term === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    const applicableTier = [...pricing]
      .sort((a, b) => b.minSeats - a.minSeats)
      .find(tier => seats >= tier.minSeats);
    return applicableTier ? applicableTier.price : 0;
  }
}