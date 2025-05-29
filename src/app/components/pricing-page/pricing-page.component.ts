import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PricingService } from '../../services/pricing.service';
import { ProductFamily } from '../../models/pricing.model';

@Component({
  selector: 'app-pricing-page',
  templateUrl: './pricing-page.component.html',
  styleUrls: ['./pricing-page.component.scss']
})
export class PricingPageComponent implements OnInit {
  productFamilies: ProductFamily[] = [];
  selectedTerm: '1year' | '3year' = '1year';

  constructor(
    private pricingService: PricingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchPricingData();
  }

  fetchPricingData(): void {
    this.pricingService.fetchPricingData().subscribe(data => {
      if (data && Array.isArray(data.productFamilies)) {
        this.productFamilies = data.productFamilies;
      } else {
        this.productFamilies = [];
      }
    }, err => {
      this.productFamilies = [];
    });
  }

  selectPlan(productFamily: ProductFamily, planName: string): void {
    this.router.navigate(['/cart'], {
      queryParams: {
        product: productFamily.name,
        plan: planName,
        term: this.selectedTerm
      }
    });
  }

  toggleTerm(): void {
    this.selectedTerm = this.selectedTerm === '1year' ? '3year' : '1year';
  }

  getPlanPrice(plan: any, seats: number = 1): number {
    const pricing = this.selectedTerm === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    const applicableTier = [...pricing]
      .sort((a, b) => b.minSeats - a.minSeats)
      .find(tier => seats >= tier.minSeats);
    return applicableTier ? applicableTier.price : 0;
  }
}