import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

import {
  PricingService,
  EstimateRequest,
  EstimateItemRequest,
  ProductFamily,
  CartItem,
  Plan,
  BillingTerm,
  PricingApiResponse
} from '../../services/pricing.service';
import { LocalizationService } from '../../services/localization.service';
import { PackageCalculations, DEFAULT_FREE_PACKAGES_PER_SEAT } from '../../utils/package-calculations.util';
import { SalesContactModalComponent } from '../sales-contact-modal/sales-contact-modal.component';

interface CartState {
  readonly selectedPdfPlan: string;
  readonly selectedSignPlan: string;
  readonly pdfSeats: number;
  readonly signSeats: number;
  readonly signPackages: number;
  readonly signApiCalls: number;
  readonly term: BillingTerm;
  readonly isBuyNowMode: boolean;
  readonly isFromCalculator: boolean;
}

@Component({
  selector: 'app-cart-page',
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.scss']
})
export class CartPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  
  // State properties
  selectedPdfPlan: string = '';
  selectedSignPlan: string = '';
  pdfSeats: number = 1;
  signSeats: number = 1;
  signPackages: number = 0;
  signApiCalls: number = 0;
  term: BillingTerm = '1year';
  productFamilies: ProductFamily[] = [];
  cartItems: CartItem[] = [];
  totalPrice: number = 0;
  isBuyNowMode: boolean = false;
  isFromCalculator: boolean = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly pricingService: PricingService,
    private readonly localizationService: LocalizationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPricingDataAndInitializeCart();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPricingDataAndInitializeCart(): void {
    // Listen to currency changes and reload pricing data
    this.localizationService.localization$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(state => {
          console.log('🛒 Currency changed, reloading cart pricing data for:', state.currency.code);
          return this.pricingService.fetchPricingData(state.currency.code);
        })
      )
      .subscribe({
        next: (response: PricingApiResponse) => {
          if (response?.productFamilies && Array.isArray(response.productFamilies)) {
            this.productFamilies = response.productFamilies;
            this.initializeCartFromQueryParams();
          } else {
            this.productFamilies = [];
            console.warn('Invalid pricing data received');
          }
        },
        error: (error) => {
          this.productFamilies = [];
          console.error('Error loading pricing data:', error);
        }
      });
  }

  private initializeCartFromQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.parseQueryParameters(params);
        this.calculateTotal();
      });
  }

  private parseQueryParameters(params: any): void {
    // Handle new parameter structure from calculator
    if (params['nitropdf_plan']) {
      this.selectedPdfPlan = params['nitropdf_plan'];
      this.pdfSeats = this.parseIntegerParam(params['nitropdf_seats'], 1);
    }
    
    if (params['nitrosign_plan']) {
      this.selectedSignPlan = params['nitrosign_plan'];
      this.signSeats = this.parseIntegerParam(params['nitrosign_seats'], 1);
      this.signPackages = this.parseIntegerParam(params['nitrosign_packages'], 0);
      this.signApiCalls = this.parseIntegerParam(params['nitrosign_apiCalls'], 0);
    }
    
    // Handle legacy parameter structure (for backwards compatibility)
    this.parseLegacyParameters(params);
    
    if (params['term']) {
      this.term = this.isValidBillingTerm(params['term']) ? params['term'] : '1year';
    }
    
    this.isFromCalculator = params['fromCalculator'] === 'true';
    this.isBuyNowMode = params['buyNow'] === 'true';
  }

  private parseLegacyParameters(params: any): void {
    if (params['product'] && params['plan']) {
      const family = params['product'];
      const plan = params['plan'];
      
      if (family.includes('PDF')) {
        this.selectedPdfPlan = plan;
        this.pdfSeats = this.parseIntegerParam(params['seats'], 1);
      } else if (family.includes('Sign')) {
        this.selectedSignPlan = plan;
        this.signSeats = this.parseIntegerParam(params['seats'], 1);
        this.signPackages = this.parseIntegerParam(params['packages'], 0);
        this.signApiCalls = this.parseIntegerParam(params['apiCalls'], 0);
      }
    }
  }

  private parseIntegerParam(value: string, defaultValue: number): number {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
  }

  private isValidBillingTerm(term: string): term is BillingTerm {
    return term === '1year' || term === '3year';
  }

  calculateTotal(): void {
    this.cartItems = [];
    this.totalPrice = 0;

    if (!this.productFamilies || this.productFamilies.length === 0) {
      return;
    }

    // Calculate PDF plan price if selected
    if (this.selectedPdfPlan) {
      const pdfCartItem = this.createPdfCartItem();
      if (pdfCartItem) {
        this.cartItems = [...this.cartItems, pdfCartItem];
        this.totalPrice += pdfCartItem.price;
      }
    }

    // Calculate Sign plan price if selected
    if (this.selectedSignPlan) {
      const signCartItem = this.createSignCartItem();
      if (signCartItem) {
        this.cartItems = [...this.cartItems, signCartItem];
        this.totalPrice += signCartItem.price;
      }
    }
  }

  private createPdfCartItem(): CartItem | null {
    const pdfFamily = this.productFamilies.find(f => f.name === 'Nitro PDF');
    if (!pdfFamily) {
      return null;
    }

    const price = this.pricingService.calculatePrice(
      pdfFamily,
      this.selectedPdfPlan,
      this.pdfSeats,
      0,
      0,
      this.term
    );

    return {
      productFamily: 'Nitro PDF',
      planName: this.selectedPdfPlan,
      seats: this.pdfSeats,
      term: this.term,
      price: price
    };
  }

  private createSignCartItem(): CartItem | null {
    const signFamily = this.productFamilies.find(f => f.name === 'Nitro Sign');
    if (!signFamily) {
      return null;
    }

    const price = this.pricingService.calculatePrice(
      signFamily,
      this.selectedSignPlan,
      this.signSeats,
      this.signPackages,
      this.signApiCalls,
      this.term
    );

    return {
      productFamily: 'Nitro Sign',
      planName: this.selectedSignPlan,
      seats: this.signSeats,
      packages: this.signPackages,
      apiCalls: this.signApiCalls,
      term: this.term,
      price: price
    };
  }

  getFreePackages(): number {
    return PackageCalculations.calculateFreePackages(this.signSeats);
  }

  getFreePackagesPerSeat(): number {
    return DEFAULT_FREE_PACKAGES_PER_SEAT;
  }

  getPdfPlans(): readonly Plan[] {
    const pdfFamily = this.productFamilies?.find(f => f.name === 'Nitro PDF');
    return pdfFamily?.plans || [];
  }

  getSignPlans(): readonly Plan[] {
    const signFamily = this.productFamilies?.find(f => f.name === 'Nitro Sign');
    return signFamily?.plans || [];
  }

  checkout(): void {
    // For 3-year terms, open contact sales modal instead of proceeding to checkout
    if (this.term === '3year') {
      this.openContactSalesModal();
      return;
    }
    
    // For 1-year terms, proceed to normal checkout
    const queryParams = this.buildCheckoutQueryParams();
    this.router.navigate(['/checkout'], { queryParams });
  }

  /**
   * Open contact sales modal for 3-year terms in cart
   */
  private openContactSalesModal(): void {
    // Build product information from cart
    const selectedProducts: Array<{
      family: string;
      plan: string;
      seats: number;
      packages?: number;
      apiCalls?: number;
    }> = [];

    if (this.selectedPdfPlan) {
      selectedProducts.push({
        family: 'Nitro PDF',
        plan: this.selectedPdfPlan,
        seats: this.pdfSeats
      });
    }

    if (this.selectedSignPlan) {
      selectedProducts.push({
        family: 'Nitro Sign',
        plan: this.selectedSignPlan,
        seats: this.signSeats,
        packages: this.signPackages || 0,
        apiCalls: this.signApiCalls || 0
      });
    }

    const dialogRef = this.dialog.open(SalesContactModalComponent, {
      width: '500px',
      data: {
        selectedProducts: selectedProducts,
        term: this.term,
        totalPrice: this.totalPrice,
        source: 'cart'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.submitted) {
        // Handle successful form submission if needed
        console.log('Sales contact form submitted from cart:', result);
      }
    });
  }

  private buildCheckoutQueryParams(): Record<string, string | number> {
    return {
      nitropdf_plan: this.selectedPdfPlan || '',
      nitropdf_seats: this.selectedPdfPlan ? this.pdfSeats : 0,
      nitrosign_plan: this.selectedSignPlan || '',
      nitrosign_seats: this.selectedSignPlan ? this.signSeats : 0,
      nitrosign_packages: this.signPackages || 0,
      nitrosign_apiCalls: this.signApiCalls || 0,
      term: this.term
    };
  }

  getExtraPackages(): number {
    return PackageCalculations.calculateExtraPackages(this.signSeats, this.signPackages);
  }

  formatPrice(price: number): string {
    return this.localizationService.formatCurrency(price);
  }

  getCurrentCurrency(): string {
    return this.localizationService.currentCurrency;
  }
}