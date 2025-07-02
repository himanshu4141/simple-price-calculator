import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

import {
  PricingService,
  EstimateRequest,
  EstimateItemRequest,
  ProductFamily,
  Plan,
  BillingTerm,
  PricingApiResponse
} from '../../services/pricing.service';
import { LocalizationService } from '../../services/localization.service';
import { StripeService } from '../../services/stripe.service';
import { SalesContactModalComponent } from '../sales-contact-modal/sales-contact-modal.component';
import { environment } from '../../../environments/environment';

// Enhanced cart item interface
export interface EnhancedCartItem {
  id: string;
  productFamily: string;
  planName: string;
  seats: number;
  packages?: number;
  apiCalls?: number;
  term: BillingTerm;
  price: number;
  canModifySeats: boolean;
  canModifyPackages: boolean;
  canModifyApiCalls: boolean;
}

// Cross-sell recommendation interface
export interface CrossSellRecommendation {
  productFamily: string;
  planName: string;
  reason: string;
  benefits: string[];
  price: number;
  isRecommended: boolean;
}

// Upsell suggestion interface
export interface UpsellSuggestion {
  currentPlan: string;
  suggestedPlan: string;
  productFamily: string;
  benefits: string[];
  priceIncrease: number;
  savings?: string;
  isRecommended: boolean;
}

// Add-on interface
export interface AddonOption {
  type: 'packages' | 'apiCalls';
  name: string;
  description: string;
  unitPrice: number;
  currentQuantity: number;
  suggestedQuantity: number;
  isAvailable: boolean;
}

@Component({
  selector: 'app-enhanced-cart',
  templateUrl: './enhanced-cart-page.component.html',
  styleUrls: ['./enhanced-cart-page.component.scss']
})
export class EnhancedCartPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // Product families data
  productFamilies: ProductFamily[] = [];
  
  // Cart state
  cartItems: EnhancedCartItem[] = [];
  totalPrice: number = 0;
  subtotal: number = 0;
  taxAmount: number = 0;
  finalTotal: number = 0;
  isLoading = true;
  loadingError: string | null = null;
  
  // Cross-sell and upsell recommendations
  crossSellRecommendations: CrossSellRecommendation[] = [];
  upsellSuggestions: UpsellSuggestion[] = [];
  addonOptions: AddonOption[] = [];
  
  // Customer information form
  customerEmail: string = '';
  isEmailValid: boolean = false;
  
  // Stripe elements state
  isStripeReady: boolean = false;
  isAddressElementReady: boolean = false;
  isPaymentElementReady: boolean = false;
  
  // Coupon state
  couponCode: string = '';
  appliedCoupon: any = null;
  couponError: string | null = null;
  isCouponLoading: boolean = false;
  
  // Form validation
  isFormValid: boolean = false;
  
  // Navigation state
  isBuyNowMode: boolean = false;
  isFromCalculator: boolean = false;

  // Form interaction tracking
  private hasUserInteractedWithAddress = false;
  private addressInteractionTimeout: any;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly pricingService: PricingService,
    private readonly localizationService: LocalizationService,
    private readonly stripeService: StripeService,
    private readonly httpClient: HttpClient,
    private readonly dialog: MatDialog,
    private readonly ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadPricingDataAndInitializeCart();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPricingDataAndInitializeCart(): void {
    this.isLoading = true;
    this.loadingError = null;

    // Listen to currency changes and reload pricing data
    this.localizationService.localization$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(state => {
          // Currency changed, reloading pricing data
          return this.pricingService.fetchPricingData(state.currency.code);
        })
      )
      .subscribe({
        next: (response: PricingApiResponse) => {
          if (response?.productFamilies && Array.isArray(response.productFamilies)) {
            this.productFamilies = response.productFamilies;
            this.patchSignPlansPricing(); // Ensure Sign plans have package pricing
            this.initializeCartFromQueryParams();
          } else {
            this.loadingError = 'Invalid pricing data received';
            this.isLoading = false;
          }
        },
        error: (error) => {
          this.loadingError = 'Error loading pricing data';
          this.isLoading = false;
          console.error('Enhanced Cart: Error loading pricing data:', error);
        }
      });
  }

  private initializeCartFromQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        // Check if returning from confirmation page
        if (params['step'] === 'cart') {
          this.restoreCartStateFromStorage();
        }
        
        // Parsing query parameters
        this.parseQueryParameters(params);
        this.buildCartItems();
        this.generateRecommendations();
        this.initializeStripeElements();
        this.isLoading = false;
      });
  }

  private parseQueryParameters(params: any): void {
    this.isBuyNowMode = params['buyNow'] === 'true';
    this.isFromCalculator = params['fromCalculator'] === 'true';
    
    // Initialize cart items from URL parameters
    this.cartItems = [];
    
    // Handle PDF plan
    if (params['product'] && params['plan'] && params['product'].includes('PDF')) {
      this.addCartItemFromParams('Nitro PDF', params['plan'], params);
    } else if (params['nitropdf_plan']) {
      this.addCartItemFromParams('Nitro PDF', params['nitropdf_plan'], params, 'nitropdf_');
    }
    
    // Handle Sign plan  
    if (params['product'] && params['plan'] && params['product'].includes('Sign')) {
      this.addCartItemFromParams('Nitro Sign', params['plan'], params);
    } else if (params['nitrosign_plan']) {
      this.addCartItemFromParams('Nitro Sign', params['nitrosign_plan'], params, 'nitrosign_');
    }
  }

  private addCartItemFromParams(productFamily: string, planName: string, params: any, prefix: string = ''): void {
    const seats = this.parseIntegerParam(params[`${prefix}seats`] || params['seats'], 1);
    const packages = this.parseIntegerParam(params[`${prefix}packages`] || params['packages'], 0);
    const apiCalls = this.parseIntegerParam(params[`${prefix}apiCalls`] || params['apiCalls'], 0);
    const term = this.isValidBillingTerm(params['term']) ? params['term'] : '1year';

    if (term === '3year') {
      // For 3-year terms, redirect to contact sales modal
      this.openContactSalesModal(productFamily, planName, term);
      return;
    }

    const family = this.productFamilies.find(f => f.name === productFamily);
    if (!family) return;

    const price = this.pricingService.calculateCartPrice(family, planName, seats, packages, apiCalls, term);
    
    const cartItem: EnhancedCartItem = {
      id: `${productFamily.toLowerCase().replace(' ', '')}_${planName.toLowerCase().replace(' ', '')}`,
      productFamily,
      planName,
      seats,
      packages,
      apiCalls,
      term,
      price,
      canModifySeats: true,
      canModifyPackages: productFamily === 'Nitro Sign',
      canModifyApiCalls: productFamily === 'Nitro Sign' && planName.includes('Enterprise')
    };

    this.cartItems.push(cartItem);
  }

  private parseIntegerParam(value: string, defaultValue: number): number {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
  }

  private isValidBillingTerm(term: string): term is BillingTerm {
    return term === '1year' || term === '3year';
  }

  private buildCartItems(): void {
    this.calculatePricingWithBackend();
  }

  private async calculatePricingWithBackend(): Promise<void> {
    try {
      // Calculating pricing with backend API
      
      // Check if we have any items to calculate
      const estimateItems = this.buildEstimateItems();
      if (estimateItems.length === 0) {
        console.warn('⚠️ No items to calculate pricing for');
        this.subtotal = 0;
        this.taxAmount = 0;
        this.finalTotal = 0;
        this.totalPrice = 0;
        return;
      }
      
      // Build estimate request
      const estimateRequest = {
        items: estimateItems,
        currency: this.localizationService.currentCurrency,
        billingTerm: this.getBillingTermFromItems()
      };
      
      // Building estimate request
      
      // Call backend estimate API
      const response = await this.httpClient.post<any>(`${environment.apiUrl}/estimate`, estimateRequest).toPromise();
      
      // Processing estimate response
      
      // Update pricing from backend response
      this.subtotal = response.subtotal || 0;
      this.totalPrice = this.subtotal;
      
      // Try to calculate taxes immediately if we have address info
      await this.tryInitialTaxCalculation();
      
      // Update cart items with backend pricing
      if (response.items && Array.isArray(response.items)) {
        this.updateCartItemsWithBackendPricing(response.items);
      }
      
    } catch (error) {
      console.error('❌ Error calculating pricing:', error);
      
      // Fallback to local calculation
      this.totalPrice = this.cartItems.reduce((total, item) => total + item.price, 0);
      this.subtotal = this.totalPrice;
      this.taxAmount = 0;
      this.finalTotal = this.subtotal;
    }
  }

  private buildEstimateItems(): any[] {
    const items: any[] = [];
    
    this.cartItems.forEach(item => {
      const estimateItem: any = {
        productFamily: item.productFamily,
        planName: item.planName,
        seats: item.seats
      };
      
      // Add packages if any
      if (item.packages && item.packages > 0) {
        estimateItem.packages = item.packages;
      }
      
      // Add API calls if any
      if (item.apiCalls && item.apiCalls > 0) {
        estimateItem.apiCalls = item.apiCalls;
      }
      
      items.push(estimateItem);
    });
    
    return items;
  }

  private getBillingTermFromItems(): BillingTerm {
    // Get term from first item, they should all be the same
    return this.cartItems.length > 0 ? this.cartItems[0].term : '1year';
  }

  private updateCartItemsWithBackendPricing(backendItems: any[]): void {
    // Update cart items with accurate pricing from backend
    backendItems.forEach((backendItem, index) => {
      if (this.cartItems[index]) {
        this.cartItems[index].price = backendItem.totalPrice || this.cartItems[index].price;
      }
    });
    
    // Recalculate total
    this.totalPrice = this.cartItems.reduce((total, item) => total + item.price, 0);
    this.subtotal = this.totalPrice;
    this.finalTotal = this.subtotal + this.taxAmount;
  }

  private generateRecommendations(): void {
    this.crossSellRecommendations = [];
    this.upsellSuggestions = [];
    this.addonOptions = [];

    // Debug: Show available product families and their plans
    // Debug: Available product families and plans
    /*
    // Debug: Available product families and plans
    // Debug: Available product families and plans (disabled)
    // this.productFamilies.forEach(family => {
    //   console.log(`${family.name}:`, family.plans.map(p => p.name));
    // });
    */

    // Generate cross-sell and upsell recommendations based on cart items
    this.cartItems.forEach(item => {
      this.generateCrossSellRecommendations(item);
      this.generateUpsellSuggestions(item);
      this.generateAddonOptions(item);
    });

    // Generated recommendations for cart
  }

  private generateCrossSellRecommendations(item: EnhancedCartItem): void {
    // Cross-sell logic: If user has PDF plan, recommend Sign plan and vice versa
    let crossSellFamily = '';
    let crossSellPlan = '';
    
    // Generating cross-sell for item
    
    if (item.productFamily === 'Nitro PDF') {
      crossSellFamily = 'Nitro Sign';
      // Match the tier level - use full plan names
      if (item.planName.includes('Standard')) crossSellPlan = 'Nitro Sign Standard';
      else if (item.planName.includes('Plus')) crossSellPlan = 'Nitro Sign Plus';
      else if (item.planName.includes('Enterprise')) crossSellPlan = 'Nitro Sign Enterprise';
    } else if (item.productFamily === 'Nitro Sign') {
      crossSellFamily = 'Nitro PDF';
      // Match the tier level - use full plan names
      if (item.planName.includes('Standard')) crossSellPlan = 'Nitro PDF Standard';
      else if (item.planName.includes('Plus')) crossSellPlan = 'Nitro PDF Plus';
      else if (item.planName.includes('Enterprise')) crossSellPlan = 'Nitro PDF Enterprise';
    }

    // Cross-sell target determined

    // Check if we already have this product family in cart
    const hasThisFamily = this.cartItems.some(cartItem => cartItem.productFamily === crossSellFamily);
    
    if (crossSellFamily && crossSellPlan && !hasThisFamily) {
      const family = this.productFamilies.find(f => f.name === crossSellFamily);
      // Found product family for cross-sell
      
      if (family) {
        const price = this.pricingService.calculateCartPrice(family, crossSellPlan, 1, 0, 0, item.term);
        // Calculated cross-sell price
        
        this.crossSellRecommendations.push({
          productFamily: crossSellFamily,
          planName: crossSellPlan,
          reason: 'Complete your document workflow with both PDF and eSignature capabilities',
          benefits: this.getCrossSellBenefits(crossSellFamily, crossSellPlan),
          price,
          isRecommended: true
        });
      } else {
        console.warn('⚠️ Cross-sell product family not found:', crossSellFamily);
      }
    } else {      // Skipping cross-sell (already in cart or family not found)
    }
  }

  private generateUpsellSuggestions(item: EnhancedCartItem): void {
    // Upsell logic: Suggest higher tier plans
    let upsellPlan = '';
    
    if (item.planName.includes('Standard')) {
      upsellPlan = item.planName.replace('Standard', 'Plus');
    } else if (item.planName.includes('Plus')) {
      upsellPlan = item.planName.replace('Plus', 'Enterprise');
    }

    // Upsell logic processing

    if (upsellPlan) {
      const family = this.productFamilies.find(f => f.name === item.productFamily);
      if (family) {
        const currentPrice = item.price;
        const upsellPrice = this.pricingService.calculateCartPrice(family, upsellPlan, item.seats, item.packages || 0, item.apiCalls || 0, item.term);
        const priceIncrease = upsellPrice - currentPrice;        // Upsell pricing calculated

        if (priceIncrease > 0) {
          this.upsellSuggestions.push({
            currentPlan: item.planName,
            suggestedPlan: upsellPlan,
            productFamily: item.productFamily,
            benefits: this.getUpsellBenefits(item.planName, upsellPlan),
            priceIncrease,
            isRecommended: true
          });
        }
      }
    }
  }

  private generateAddonOptions(item: EnhancedCartItem): void {
    // Add-on logic: Only for Sign plans
    if (item.productFamily === 'Nitro Sign') {
      // Packages add-on (all Sign plans)
      this.addonOptions.push({
        type: 'packages',
        name: 'Additional Document Packages',
        description: 'Extra document processing capacity beyond your plan\'s base allocation',
        unitPrice: this.getPackagePrice(item.planName),
        currentQuantity: item.packages || 0,
        suggestedQuantity: 10, // Suggest 10 more packages
        isAvailable: true
      });

      // API calls add-on (Enterprise only)
      if (item.planName.includes('Enterprise')) {
        this.addonOptions.push({
          type: 'apiCalls',
          name: 'Additional API Calls',
          description: 'Extra API calls for enterprise integrations',
          unitPrice: this.getApiPrice(item.planName),
          currentQuantity: item.apiCalls || 0,
          suggestedQuantity: 1000, // Suggest 1000 more API calls
          isAvailable: true
        });
      }
    }
  }

  private getPackagePrice(planName: string): number {
    // Get package pricing from backend via pricing service
    const productFamily = this.productFamilies.find(pf => pf.name === 'Nitro Sign');
    if (productFamily) {
      const plan = productFamily.plans.find(p => p.name === planName);
      if (plan && plan.packagePrice) {
        return plan.packagePrice;
      }
    }
    
    // Fallback to default pricing if not found in backend data
    const packagePrices: { [key: string]: number } = {
      'Nitro Sign Standard': 5,
      'Nitro Sign Plus': 4,
      'Nitro Sign Enterprise': 3,
      // Also support shorter names for compatibility
      'Sign Standard': 5,
      'Sign Plus': 4,
      'Sign Enterprise': 3
    };
    
    // Try exact match first
    if (packagePrices[planName]) {
      return packagePrices[planName];
    }
    
    // Check for partial matches
    for (const [key, price] of Object.entries(packagePrices)) {
      if (planName.includes(key.replace('Nitro ', ''))) {
        return price;
      }
    }
    
    return 5; // Default fallback
  }

  private getApiPrice(planName: string): number {
    // Get API call pricing from backend via pricing service
    const productFamily = this.productFamilies.find(pf => pf.name === 'Nitro Sign');
    if (productFamily) {
      const plan = productFamily.plans.find(p => p.name === planName);
      if (plan && plan.apiPrice !== undefined) {
        return plan.apiPrice;
      }
    }
    
    // Fallback to default pricing if not found in backend data
    return planName.includes('Enterprise') ? 0.01 : 0;
  }

  private getCrossSellBenefits(crossSellFamily: string, crossSellPlan: string): string[] {
    if (crossSellFamily.includes('PDF')) {
      return [
        'Edit and annotate PDFs',
        'Convert documents to PDF',
        'Merge and split PDFs',
        'Advanced editing tools'
      ];
    } else {
      return [
        'Send documents for signature',
        'Track signature status',
        'Manage signature workflows',
        'Integrate with existing tools'
      ];
    }
  }

  private getUpsellBenefits(currentPlan: string, upsellPlan: string): string[] {
    const benefitMap: Record<string, string[]> = {
      'PDF Standard -> PDF Plus': [
        'Advanced editing features',
        'OCR text recognition', 
        'Enhanced security options',
        'Batch processing tools'
      ],
      'Sign Standard -> Sign Plus': [
        'Advanced workflow automation',
        'Custom branding options',
        'Enhanced reporting',
        'Priority support'
      ],
      'Sign Plus -> Sign Enterprise': [
        'API access for integrations',
        'Advanced analytics',
        'Custom contract terms',
        'Dedicated account manager'
      ]
    };

    return benefitMap[`${currentPlan} -> ${upsellPlan}`] || ['Enhanced features and capabilities'];
  }

  private async initializeStripeElements(): Promise<void> {
    try {
      // Initializing Stripe Elements
      
      // Initialize Stripe first
      await this.stripeService.initializeStripe();
      
      // Create elements instance  
      await this.stripeService.createElements(undefined, {
        currency: this.localizationService.currentCurrency,
        locale: 'en'
      });
      
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const addressContainer = document.getElementById('address-element');
      const paymentContainer = document.getElementById('payment-element');
      
      if (addressContainer && paymentContainer) {
        // Create and mount address element with delayed validation
        await this.stripeService.createAddressElement('address-element', {
          mode: 'billing',
          autocomplete: { mode: 'automatic' },
          allowedCountries: ['US', 'CA', 'GB', 'AU', 'FR', 'DE', 'ES', 'IT'],
          defaultValues: {
            name: '',
            address: {
              line1: '',
              city: '',
              state: '',
              postal_code: '',
              country: 'US' // Default to US
            }
          }
        });
        
        this.isAddressElementReady = true;
        
        // Create and mount payment element
        await this.stripeService.createPaymentElement('payment-element', {
          layout: 'tabs',
          paymentMethodOrder: ['card', 'paypal', 'link']
        });
        
        this.isPaymentElementReady = true;
        this.isStripeReady = true;
        
        // Wait a moment before setting up validation to avoid immediate error display
        setTimeout(() => {
          this.setupFormValidation();
        }, 500);
        
        // Stripe Elements initialized successfully
      } else {
        console.warn('⚠️ Enhanced Cart: Stripe element containers not found');
      }
    } catch (error) {
      console.error('❌ Enhanced Cart: Error initializing Stripe Elements:', error);
    }
  }

  private setupFormValidation(): void {
    // Watch for email changes
    this.validateForm();
    
    // Watch for address changes to calculate taxes
    this.setupAddressChangeListener();
  }

  private setupAddressChangeListener(): void {
    // Set up address element change listener for tax calculation
    if (this.isAddressElementReady) {
      // Use a debounced function to avoid too many tax calculation calls
      let addressChangeTimeout: any;
      
      const handleAddressChange = async () => {
        // Mark that user has interacted with address
        this.hasUserInteractedWithAddress = true;
        
        clearTimeout(addressChangeTimeout);
        addressChangeTimeout = setTimeout(async () => {
          try {
            const addressValue = await this.stripeService.getAddressElementValue();
            if (addressValue?.address?.postal_code && addressValue?.address?.state) {
              await this.calculateTaxes({ address: addressValue.address });
            }
          } catch (error) {
            console.warn('⚠️ Error getting address for tax calculation:', error);
          }
        }, 1000); // Wait 1 second after user stops typing
      };

      // Set up the address element event listeners
      try {
        const addressElement = this.stripeService.getAddressElement();
        if (addressElement) {
          // Track all interaction events
          addressElement.on('change', handleAddressChange);
          addressElement.on('focus', () => {
            if (!this.hasUserInteractedWithAddress) {
              this.hasUserInteractedWithAddress = true;
              // Start autofill detection after first interaction
              setTimeout(() => this.setupAutofillDetection(), 1000);
            }
          });
          addressElement.on('blur', handleAddressChange);
          
          // Remove autofill detection since it triggers validation
          // We'll only check for tax calculation after user interaction
        }
      } catch (error) {
        console.warn('⚠️ Could not set up address change listener:', error);
      }
    }
  }

  private setupAutofillDetection(): void {
    // Only set up autofill detection after user has started interacting
    if (!this.hasUserInteractedWithAddress) {
      return;
    }
    
    // Check for autofilled data every few seconds, but only if user has interacted
    const checkForAutofill = setInterval(async () => {
      try {
        if (!this.hasUserInteractedWithAddress) {
          clearInterval(checkForAutofill);
          return;
        }
        
        const addressValue = await this.stripeService.getAddressElementValue();
        if (addressValue?.address?.postal_code && addressValue?.address?.state && this.taxAmount === 0) {
          await this.calculateTaxes({ address: addressValue.address });
          clearInterval(checkForAutofill); // Stop checking once we have address
        }
      } catch (error) {
        // Ignore errors in autofill detection
      }
    }, 3000); // Check every 3 seconds
    
    // Stop checking after 30 seconds
    setTimeout(() => {
      clearInterval(checkForAutofill);
    }, 30000);
  }

  private validateForm(): void {
    this.isEmailValid = this.isValidEmail(this.customerEmail);
    this.isFormValid = this.isEmailValid && this.isStripeReady && this.cartItems.length > 0;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Public methods for template

  onEmailChange(): void {
    this.validateForm();
  }

  updateCartItemQuantity(itemId: string, field: 'seats' | 'packages' | 'apiCalls', value: number | string): void {
    const item = this.cartItems.find(i => i.id === itemId);
    if (!item) return;

    const family = this.productFamilies.find(f => f.name === item.productFamily);
    if (!family) return;

    // Convert string to number if needed
    const numericValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(numericValue)) return;

    // Update the field with appropriate minimum values
    if (field === 'seats') {
      item[field] = Math.max(1, numericValue); // Seats minimum is 1
    } else if (field === 'packages' || field === 'apiCalls') {
      item[field] = Math.max(0, numericValue); // Packages and API calls minimum is 0
    }
    
    // Recalculate price
    const newPrice = this.pricingService.calculateCartPrice(
      family,
      item.planName,
      item.seats,
      item.packages || 0,
      item.apiCalls || 0,
      item.term
    );
    
    item.price = newPrice;

    // Update total and recalculate tax with current address
    this.buildCartItems();
    this.recalculateTaxIfAddressAvailable();
    
    // Regenerate recommendations based on new quantities
    this.generateRecommendations();
  }

  addCrossSellItem(recommendation: CrossSellRecommendation): void {
    const family = this.productFamilies.find(f => f.name === recommendation.productFamily);
    if (!family) return;

    const newItem: EnhancedCartItem = {
      id: `${recommendation.productFamily.toLowerCase().replace(' ', '')}_${recommendation.planName.toLowerCase().replace(' ', '')}`,
      productFamily: recommendation.productFamily,
      planName: recommendation.planName,
      seats: 1,
      packages: 0,
      apiCalls: 0,
      term: this.cartItems[0]?.term || '1year',
      price: recommendation.price,
      canModifySeats: true,
      canModifyPackages: recommendation.productFamily === 'Nitro Sign',
      canModifyApiCalls: false
    };

    this.cartItems.push(newItem);
    this.buildCartItems();
    this.recalculateTaxIfAddressAvailable();
    this.generateRecommendations();
  }

  upgradeToUpsell(suggestion: UpsellSuggestion): void {
    const item = this.cartItems.find(i => 
      i.productFamily === suggestion.productFamily && 
      i.planName === suggestion.currentPlan
    );
    
    if (!item) return;

    const family = this.productFamilies.find(f => f.name === item.productFamily);
    if (!family) return;

    // Update the plan
    item.planName = suggestion.suggestedPlan;
    
    // Recalculate price
    item.price = this.pricingService.calculateCartPrice(
      family,
      item.planName,
      item.seats,
      item.packages || 0,
      item.apiCalls || 0,
      item.term
    );

    // Update API calls availability for Sign Enterprise
    if (suggestion.suggestedPlan.includes('Enterprise')) {
      item.canModifyApiCalls = true;
    }

    this.buildCartItems();
    this.recalculateTaxIfAddressAvailable();
    this.generateRecommendations();
  }

  addAddon(addon: AddonOption): void {
    const signItem = this.cartItems.find(i => 
      i.productFamily === 'Nitro Sign' && 
      (addon.type === 'apiCalls' ? i.planName.includes('Enterprise') : true)
    );
    
    if (!signItem) return;

    if (addon.type === 'packages') {
      signItem.packages = (signItem.packages || 0) + addon.suggestedQuantity;
    } else if (addon.type === 'apiCalls') {
      signItem.apiCalls = (signItem.apiCalls || 0) + addon.suggestedQuantity;
    }

    this.updateCartItemQuantity(signItem.id, addon.type === 'packages' ? 'packages' : 'apiCalls', 
      addon.type === 'packages' ? (signItem.packages || 0) : (signItem.apiCalls || 0));
  }

  removeCartItem(itemId: string): void {
    this.cartItems = this.cartItems.filter(item => item.id !== itemId);
    
    if (this.cartItems.length === 0) {
      // Redirect back to pricing if cart is empty
      this.router.navigate(['/']);
      return;
    }

    this.buildCartItems();
    this.recalculateTaxIfAddressAvailable();
    this.generateRecommendations();
  }

  async applyCoupon(): Promise<void> {
    if (!this.couponCode.trim()) return;

    this.isCouponLoading = true;
    this.couponError = null;

    try {
      // Call real backend coupon validation API (same as old checkout would use)
      const couponRequest = {
        code: this.couponCode,
        customerEmail: this.customerEmail,
        items: this.buildEstimateItems(),
        currency: this.localizationService.currentCurrency
      };
      
      // Validating coupon with backend
      
      const response = await this.httpClient.post<any>(`${environment.apiUrl}/coupons/validate`, couponRequest).toPromise();
      
      if (response && response.valid) {
        this.appliedCoupon = {
          code: this.couponCode,
          discount: response.discountAmount || 0,
          description: response.description || `${response.discountPercent}% off`
        };
        
        // Coupon applied successfully
        this.couponCode = '';
        this.calculatePricingWithBackend(); // Recalculate with discount
      } else {
        this.couponError = response?.message || 'Invalid coupon code';
      }
      
    } catch (error: any) {
      console.error('❌ Coupon validation error:', error);
      this.couponError = error.error?.message || 'Invalid coupon code';
    } finally {
      this.isCouponLoading = false;
    }
  }

  removeCoupon(): void {
    this.appliedCoupon = null;
    this.buildCartItems(); // Recalculate without discount
  }

  private openContactSalesModal(productFamily: string, planName: string, term: string): void {
    const dialogRef = this.dialog.open(SalesContactModalComponent, {
      width: '500px',
      data: {
        productFamily,
        planName,
        term,
        source: 'enhanced-cart'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.submitted) {
        // Sales contact form submitted from enhanced cart
        // Redirect back to pricing page
        this.router.navigate(['/']);
      }
    });
  }

  async proceedToConfirmation(): Promise<void> {
    if (!this.isFormValid) {
      console.warn('Form is not valid, cannot proceed');
      return;
    }

    try {
      // Get customer info from Stripe Elements
      const addressElementValue = await this.stripeService.getAddressElementValue();
      // Getting raw Address Element value

      const customerInfo = {
        email: this.customerEmail,
        firstName: addressElementValue?.name?.split(' ')[0] || '',
        lastName: addressElementValue?.name?.split(' ').slice(1).join(' ') || '',
        company: '',
        address: {
          line1: addressElementValue?.address?.line1 || '',
          line2: addressElementValue?.address?.line2 || '',
          city: addressElementValue?.address?.city || '',
          state: addressElementValue?.address?.state || '',
          postalCode: addressElementValue?.address?.postal_code || '', // Fix: Use postal_code from Stripe
          country: addressElementValue?.address?.country || 'US'
        }
      };

      // Ensure we have valid address data for Chargebee estimate API
      // Chargebee is very strict about address validation for tax calculation
      if (!customerInfo.address.postalCode || !customerInfo.address.line1 || !customerInfo.address.city || !customerInfo.address.state) {
        console.warn('⚠️ Incomplete address data detected, using test defaults for development');
        customerInfo.address = {
          line1: customerInfo.address.line1 || '1 Main St',
          line2: customerInfo.address.line2 || '',
          city: customerInfo.address.city || 'New York',
          state: customerInfo.address.state || 'NY',
          postalCode: customerInfo.address.postalCode || '10001',
          country: customerInfo.address.country || 'US'
        };
      }

      // Calculate taxes with real address data
      if (customerInfo.address.line1) {
        await this.calculateTaxes({ address: customerInfo.address });
      }

      // Create payment method while Elements are still mounted and accessible
      // Creating payment method before navigation
      let paymentMethodId: string | null = null;
      
      try {
        const paymentResult = await this.stripeService.submitAndCreatePaymentMethod(this.customerEmail);
        paymentMethodId = paymentResult.paymentMethodId;
        // Payment method created successfully
        
        // Store payment method data for confirmation page
        const paymentData = {
          paymentMethodId: paymentMethodId,
          elementData: paymentResult.elementData,
          createdAt: new Date().toISOString()
        };
        sessionStorage.setItem('checkoutPaymentData', JSON.stringify(paymentData));
        // Payment method data stored for confirmation page
        
      } catch (paymentError) {
        console.error('❌ Error creating payment method:', paymentError);
        // Don't block navigation - we'll handle payment method creation on confirmation page as fallback
        console.warn('⚠️ Payment method creation failed, will retry on confirmation page');
      }

      // Calculate final pricing
      const subtotal = this.subtotal;
      const discount = this.appliedCoupon?.discount || 0;
      const discountedSubtotal = subtotal - discount;
      const total = discountedSubtotal + this.taxAmount;

      // Build order data for confirmation
      const orderData = {
        items: this.cartItems.map((item, index) => ({
          id: `item_${index}`,
          productName: `${item.productFamily} - ${item.planName}`,
          planName: item.planName,
          seats: item.seats,
          term: item.term === '1year' ? '1 Year' : '3 Years',
          price: item.price,
          description: this.getItemDescription(item)
        })),
        customerInfo: customerInfo,
        subtotal: subtotal,
        tax: this.taxAmount,
        total: total,
        discountAmount: discount,
        appliedCoupon: this.appliedCoupon ? this.appliedCoupon.code : '',
        // Additional cart state for proper restoration when going back
        cartState: {
          customerEmail: this.customerEmail,
          couponCode: this.couponCode,
          appliedCouponData: this.appliedCoupon,
          originalCartItems: this.cartItems,
          taxCalculated: this.taxAmount > 0,
          addressProvided: !!customerInfo.address.line1
        }
      };

      // Store customer info in localStorage for tax calculation persistence
      try {
        localStorage.setItem('customer_info', JSON.stringify(customerInfo));
      } catch (error) {
        console.warn('⚠️ Could not store customer info in localStorage:', error);
      }

      // Store order data in session storage
      try {
        console.log('💾 Storing order data with tax amount:', {
          tax: this.taxAmount,
          subtotal: subtotal,
          total: total,
          taxCalculated: this.taxAmount > 0
        });
        sessionStorage.setItem('checkoutOrderData', JSON.stringify(orderData));
        console.log('✅ Order data stored successfully for confirmation');
      } catch (error) {
        console.error('❌ Error storing order data:', error);
      }

      // Navigate to confirmation page
      this.router.navigate(['/checkout-confirmation']);
      
    } catch (error) {
      console.error('❌ Error preparing checkout data:', error);
      // Fallback with email only
      const orderData = {
        items: this.cartItems.map((item, index) => ({
          id: `item_${index}`,
          productName: `${item.productFamily} - ${item.planName}`,
          planName: item.planName,
          seats: item.seats,
          term: item.term === '1year' ? '1 Year' : '3 Years',
          price: item.price,
          description: this.getItemDescription(item)
        })),
        customerInfo: {
          email: this.customerEmail,
          firstName: '',
          lastName: '',
          company: '',
          address: {
            line1: '',
            line2: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'US'
          }
        },
        subtotal: this.subtotal,
        tax: this.taxAmount,
        total: this.subtotal + this.taxAmount,
        discountAmount: this.appliedCoupon?.discount || 0,
        appliedCoupon: this.appliedCoupon ? this.appliedCoupon.code : '',
        // Additional cart state for proper restoration when going back
        cartState: {
          customerEmail: this.customerEmail,
          couponCode: this.couponCode,
          appliedCouponData: this.appliedCoupon,
          originalCartItems: this.cartItems,
          taxCalculated: this.taxAmount > 0,
          addressProvided: false
        }
      };

      sessionStorage.setItem('checkoutOrderData', JSON.stringify(orderData));
      this.router.navigate(['/checkout-confirmation']);
    }
  }

  private getItemDescription(item: any): string {
    let description = `${item.seats} ${item.seats === 1 ? 'seat' : 'seats'}`;
    
    if (item.packages && item.packages > 0) {
      description += `, ${item.packages} packages`;
    }
    
    if (item.apiCalls && item.apiCalls > 0) {
      description += `, ${item.apiCalls} API calls`;
    }
    
    return description;
  }

  // Tax Calculation (exactly like old checkout)
  private async calculateTaxes(addressData?: any): Promise<void> {
    try {
      console.log('🧮 calculateTaxes called with addressData:', addressData);
      
      if (!addressData || this.subtotal === 0) {
        console.log('⚠️ Tax calculation skipped - no address or subtotal:', {
          hasAddressData: !!addressData,
          subtotal: this.subtotal
        });
        this.taxAmount = 0;
        this.finalTotal = this.subtotal;
        return;
      }

      // Handle both direct address object and wrapped address object
      const address = addressData.address || addressData;
      
      // Handle both postal_code (Stripe) and postalCode (our internal format)
      const postalCode = address.postal_code || address.postalCode;
      
      if (!address || !postalCode || !address.state) {
        console.log('⚠️ Tax calculation skipped - incomplete address:', {
          hasAddress: !!address,
          hasPostalCode: !!postalCode,
          hasState: !!address?.state,
          postalCodeValue: postalCode,
          stateValue: address?.state,
          addressKeys: address ? Object.keys(address) : []
        });
        this.taxAmount = 0;
        this.finalTotal = this.subtotal;
        return;
      }

      console.log('📍 Address data for tax calculation:', address);

      // Use the exact same tax calculation API as the old checkout
      const taxItems = this.cartItems.map(item => ({
        productFamily: item.productFamily,
        planName: item.planName,
        seats: item.seats,
        packages: item.packages || 0,
        apiCalls: item.apiCalls || 0
      }));

      const taxRequest = {
        items: taxItems,
        customerAddress: {
          line1: address.line1,
          city: address.city,
          state: address.state,
          zip: postalCode, // Use the postal code we found
          country: address.country
        },
        currency: this.localizationService.currentCurrency
      };

      console.log('📋 Tax request payload:', taxRequest);
      console.log('🔍 Checking required fields:', {
        hasZip: !!taxRequest.customerAddress.zip,
        hasState: !!taxRequest.customerAddress.state,
        hasCity: !!taxRequest.customerAddress.city,
        hasLine1: !!taxRequest.customerAddress.line1,
        zipValue: taxRequest.customerAddress.zip,
        stateValue: taxRequest.customerAddress.state
      });

      // Use the same tax endpoint as the old checkout
      const response = await this.httpClient.post<any>(`${environment.apiUrl}/taxes`, taxRequest).toPromise();
      
      if (response && response.totalTax) {
        this.taxAmount = response.totalTax.amount || 0;
        this.finalTotal = this.subtotal + this.taxAmount;
        console.log('✅ Tax calculated successfully:', {
          taxAmount: this.taxAmount,
          finalTotal: this.finalTotal
        });
      } else {
        console.warn('⚠️ No tax data returned, proceeding without tax');
        this.taxAmount = 0;
        this.finalTotal = this.subtotal;
      }
      
    } catch (error) {
      console.warn('⚠️ Tax calculation failed, proceeding without tax:', error);
      this.taxAmount = 0;
      this.finalTotal = this.subtotal;
    }
  }

  // Utility methods
  formatPrice(amount: number): string {
    return this.localizationService.formatCurrency(amount || 0);
  }

  getCurrentCurrency(): string {
    return this.localizationService.currentCurrency;
  }

  returnToPricing(): void {
    this.router.navigate(['/']);
  }

  private patchSignPlansPricing(): void {
    // Ensure Nitro Sign plans have package pricing configured
    const signFamily = this.productFamilies.find(f => f.name === 'Nitro Sign');
    if (signFamily) {
      signFamily.plans.forEach(plan => {
        // Add package pricing if not present
        if (!plan.packagePrice) {
          if (plan.name.includes('Enterprise')) {
            (plan as any).packagePrice = 3;
          } else if (plan.name.includes('Plus')) {
            (plan as any).packagePrice = 4;
          } else if (plan.name.includes('Standard')) {
            (plan as any).packagePrice = 5;
          }
        }
        
        // Add API pricing if not present for Enterprise plans
        if (plan.name.includes('Enterprise') && !plan.apiPrice) {
          (plan as any).apiPrice = 0.01;
        }
      });
    }
  }

  private getSeatPrice(item: EnhancedCartItem): number {
    const family = this.productFamilies.find(f => f.name === item.productFamily);
    if (!family) return 0;

    const plan = family.plans.find(p => p.name === item.planName);
    if (!plan) return 0;

    const pricing = item.term === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    if (!pricing || pricing.length === 0) return 0;

    // Find the applicable tier for current seat count
    const applicableTier = pricing
      .slice()
      .reverse()
      .find(tier => item.seats >= tier.minSeats);

    return applicableTier ? applicableTier.price : 0;
  }

  // Try to calculate taxes immediately if address info is available
  private async tryInitialTaxCalculation(): Promise<void> {
    // Initialize with no tax first
    this.taxAmount = 0;
    this.finalTotal = this.subtotal;
    
    // Only try to calculate tax from stored data, don't access Stripe elements yet
    // to avoid triggering validation errors
    try {
      // Check if there's any stored customer information from previous session
      const storedCustomerInfo = localStorage.getItem('customer_info');
      if (storedCustomerInfo) {
        const customerInfo = JSON.parse(storedCustomerInfo);
        if (customerInfo.address && customerInfo.address.line1) {
          console.log('💰 Found stored address data, calculating initial tax');
          await this.calculateTaxes({ address: customerInfo.address });
          return;
        }
      }
      
      // If no stored data, just proceed without tax until user enters address
      console.log('📍 No stored address data found, tax will be calculated when user enters address');
      this.taxAmount = 0;
      this.finalTotal = this.subtotal;
      
    } catch (error) {
      // If anything fails, just proceed without tax
      console.warn('⚠️ Initial tax calculation failed, will calculate when user enters address:', error);
      this.taxAmount = 0;
      this.finalTotal = this.subtotal;
    }
  }

  private restoreCartStateFromStorage(): void {
    console.log('🔄 Attempting to restore cart state from storage...');
    
    // Try to restore cart state when returning from confirmation
    try {
      const orderData = JSON.parse(sessionStorage.getItem('checkoutOrderData') || '{}');
      console.log('🔍 Found sessionStorage data:', orderData);
      
      if (orderData && orderData.cartState) {
        const cartState = orderData.cartState;
        console.log('🔍 Cart state found:', cartState);
        
        // Restore customer email
        if (cartState.customerEmail) {
          this.customerEmail = cartState.customerEmail;
          this.validateForm();
          console.log('✅ Restored customer email:', this.customerEmail);
        }
        
        // Restore coupon
        if (cartState.appliedCouponData) {
          this.appliedCoupon = cartState.appliedCouponData;
          console.log('✅ Restored coupon:', this.appliedCoupon);
        }
        
        // Restore tax amount if it was calculated and mark interaction as true
        if (cartState.taxCalculated && orderData.tax) {
          this.taxAmount = orderData.tax;
          this.finalTotal = this.subtotal + this.taxAmount;
          // If we had tax calculated before, user must have interacted with address
          this.hasUserInteractedWithAddress = cartState.addressProvided || true;
          console.log('✅ Restored tax amount:', this.taxAmount);
        }
        
        // Restore original cart items to ensure quantities are correct
        if (cartState.originalCartItems && cartState.originalCartItems.length > 0) {
          this.cartItems = cartState.originalCartItems;
          console.log('✅ Restored cart items:', this.cartItems);
          // Recalculate pricing to ensure consistency
          this.buildCartItems();
        }
        
        // Try to restore customer address for tax calculation
        if (orderData.customerInfo && orderData.customerInfo.address) {
          const customerInfo = orderData.customerInfo;
          localStorage.setItem('customer_info', JSON.stringify(customerInfo));
          console.log('✅ Restored customer info to localStorage');
        }
        
        console.log('✅ Cart state restored from confirmation page');
      } else {
        console.log('⚠️ No cart state found in sessionStorage');
      }
    } catch (error) {
      console.warn('⚠️ Could not restore cart state:', error);
    }
  }

  private async recalculateTaxIfAddressAvailable(): Promise<void> {
    // Only recalculate tax if user has actually interacted with the address form
    if (!this.hasUserInteractedWithAddress) {
      console.log('🚫 Skipping tax recalculation - user has not interacted with address form yet');
      return;
    }
    
    // Try to get current address from Stripe elements and recalculate tax
    try {
      if (this.isAddressElementReady) {
        const addressValue = await this.stripeService.getAddressElementValue();
        if (addressValue?.address?.postal_code && addressValue?.address?.state) {
          await this.calculateTaxes({ address: addressValue.address });
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not recalculate tax after cart update:', error);
    }
  }
}
