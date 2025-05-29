import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PricingService } from '../../services/pricing.service';
import { ProductFamily, CartItem, Plan } from '../../models/pricing.model';

@Component({
  selector: 'app-cart-page',
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.scss']
})
export class CartPageComponent implements OnInit {
  selectedPdfPlan: string = '';
  selectedSignPlan: string = '';
  // Separate state for each product family
  pdfSeats: number = 1;
  signSeats: number = 1;
  signPackages: number = 0;
  signApiCalls: number = 0;
  term: '1year' | '3year' = '1year';
  productFamilies: ProductFamily[] = [];
  cartItems: CartItem[] = [];
  totalPrice: number = 0;

  constructor(
    private route: ActivatedRoute,
    private pricingService: PricingService
  ) {}

  ngOnInit(): void {
    this.pricingService.fetchPricingData().subscribe(data => {
      if (data && Array.isArray(data.productFamilies)) {
        this.productFamilies = data.productFamilies;
        // Get selected plan from URL params if available
        this.route.queryParams.subscribe(params => {
          if (params['product'] && params['plan']) {
            const family = params['product'];
            const plan = params['plan'];
            if (family.includes('PDF')) {
              this.selectedPdfPlan = plan;
            } else if (family.includes('Sign')) {
              this.selectedSignPlan = plan;
            }
            if (params['term']) {
              this.term = params['term'] as '1year' | '3year';
            }
          }
          this.calculateTotal();
        });
      } else {
        this.productFamilies = [];
      }
    }, err => {
      this.productFamilies = [];
    });
  }

  calculateTotal(): void {
    this.cartItems = [];
    this.totalPrice = 0;

    if (!this.productFamilies || this.productFamilies.length === 0) {
      return;
    }

    // Calculate PDF plan price if selected
    if (this.selectedPdfPlan) {
      const pdfFamily = this.productFamilies.find(f => f.name === 'Nitro PDF');
      if (pdfFamily) {
        const price = this.pricingService.calculatePrice(
          pdfFamily,
          this.selectedPdfPlan,
          this.pdfSeats,
          0,
          0,
          this.term
        );
        this.cartItems.push({
          productFamily: 'Nitro PDF',
          planName: this.selectedPdfPlan,
          seats: this.pdfSeats,
          term: this.term,
          price: price
        });
        this.totalPrice += price;
      }
    }

    // Calculate Sign plan price if selected
    if (this.selectedSignPlan) {
      const signFamily = this.productFamilies.find(f => f.name === 'Nitro Sign');
      if (signFamily) {
        const price = this.pricingService.calculatePrice(
          signFamily,
          this.selectedSignPlan,
          this.signSeats,
          this.signPackages,
          this.signApiCalls,
          this.term
        );
        this.cartItems.push({
          productFamily: 'Nitro Sign',
          planName: this.selectedSignPlan,
          seats: this.signSeats,
          packages: this.signPackages,
          apiCalls: this.signApiCalls,
          term: this.term,
          price: price
        });
        this.totalPrice += price;
      }
    }
  }

  getFreePackages(): number {
    if (!this.productFamilies || this.productFamilies.length === 0) {
      return 0;
    }
    const signFamily = this.productFamilies.find(f => f.name === 'Nitro Sign');
    if (signFamily && this.selectedSignPlan) {
      const plan = signFamily.plans.find(p => p.name === this.selectedSignPlan);
      if (plan?.freePackagesPerSeat) {
        return this.signSeats * plan.freePackagesPerSeat;
      }
    }
    return 0;
  }

  getPdfPlans(): Plan[] {
    const pdfFamily = this.productFamilies?.find(f => f.name === 'Nitro PDF');
    return pdfFamily?.plans || [];
  }

  getSignPlans(): Plan[] {
    const signFamily = this.productFamilies?.find(f => f.name === 'Nitro Sign');
    return signFamily?.plans || [];
  }

  checkout(): void {
    // Dummy checkout handler
    alert('Checkout not implemented.');
  }
}