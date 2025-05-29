import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { ProductFamily } from '../models/pricing.model';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  private pricingDataUrl = 'assets/pricing-data.json';

  constructor(private http: HttpClient) {}

  fetchPricingData(): Observable<{ productFamilies: ProductFamily[] }> {
    return this.http.get<{ productFamilies: ProductFamily[] }>(this.pricingDataUrl).pipe(
      catchError(() => of({ productFamilies: [] }))
    );
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