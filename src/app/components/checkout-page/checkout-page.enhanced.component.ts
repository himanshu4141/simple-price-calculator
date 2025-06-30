import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  PricingService,
  EstimateRequest,
  EstimateItemRequest,
  BillingTerm
} from '../../services/pricing.service';
import { LocalizationService } from '../../services/localization.service';
import { StripeService } from '../../services/stripe.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-checkout-page-enhanced',
  templateUrl: './checkout-page.enhanced.component.html',
  styleUrls: ['./checkout-page.enhanced.component.scss']
})
export class CheckoutPageEnhancedComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Loading states
  isInitialLoading = true;
  isProcessingPayment = false;
  checkoutComplete = false;
  showSalesModal = false;
  
  // Stripe Elements ready states
  isPaymentElementReady = false;
  isAddressElementReady = false;
  
  // Order data
  cartItems: any[] = [];
  subtotal: number = 0;
  tax: number = 0;
  total: number = 0;
  
  // Cart properties
  selectedPdfPlan = '';
  selectedSignPlan = '';
  pdfSeats = 0;
  signSeats = 0;
  signPackages = 0;
  signApiCalls = 0;
  term: BillingTerm = '1year';
  
  // Form fields
  customerEmail = '';
  
  // Pricing
  estimateTotal = 0;
  taxAmount = 0;
  finalTotal = 0;
  
  // Errors
  errorMessage = '';
  paymentElementError = '';
  elementErrors = {
    address: '',
    payment: ''
  };
  
  // Stripe Elements
  elementsReady = false;
  isProcessing = false;
  successMessage = '';
  
  // Computed properties
  get formattedTotal(): string {
    return this.formatPrice(this.finalTotal || this.total);
  }
  
  get allElementsReady(): boolean {
    return this.isPaymentElementReady && this.isAddressElementReady;
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly pricingService: PricingService,
    private readonly localizationService: LocalizationService,
    private readonly stripeService: StripeService,
    private readonly httpClient: HttpClient,
    private readonly ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.initializeCartFromQueryParams();
    this.initializeCheckout();
    this.subscribeToLocalizationChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stripeService.destroyElements();
  }

  // Utility methods
  formatPrice(amount: number): string {
    return this.localizationService.formatCurrency(amount || 0);
  }
  
  formatCurrency(amount: number): string {
    return this.localizationService.formatCurrency(amount || 0);
  }

  getCurrentCurrency(): string {
    return this.localizationService.currentCurrency;
  }

  // Template methods
  startNewOrder(): void {
    this.router.navigate(['/']);
  }

  returnToCart(): void {
    this.router.navigate(['/cart']);
  }

  contactSales(): void {
    this.showSalesModal = true;
  }

  closeSalesModal(): void {
    this.showSalesModal = false;
  }

  handleSubmit(): void {
    this.processPayment();
  }

  // Initialization
  private initializeCartFromQueryParams(): void {
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      console.log('🛒 Query parameters received:', params);
      
      // Use the correct parameter names that cart page sends
      this.selectedPdfPlan = params['nitropdf_plan'] || '';
      this.selectedSignPlan = params['nitrosign_plan'] || '';
      this.pdfSeats = parseInt(params['nitropdf_seats'] || '0', 10);
      this.signSeats = parseInt(params['nitrosign_seats'] || '0', 10);
      this.signPackages = parseInt(params['nitrosign_packages'] || '0', 10);
      this.signApiCalls = parseInt(params['nitrosign_apiCalls'] || '0', 10);
      this.term = (params['term'] as BillingTerm) || '1year';
      
      console.log('🛒 Cart data loaded:', {
        pdfPlan: this.selectedPdfPlan,
        pdfSeats: this.pdfSeats,
        signPlan: this.selectedSignPlan,
        signSeats: this.signSeats,
        signPackages: this.signPackages,
        signApiCalls: this.signApiCalls,
        term: this.term
      });
    });
  }

  private async initializeCheckout(): Promise<void> {
    try {
      this.isInitialLoading = true;
      await this.calculatePricing();
      
      // Set loading to false first so DOM elements are rendered
      this.isInitialLoading = false;
      
      // Add a delay to ensure DOM elements are fully rendered
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await this.initializeStripeElements();
    } catch (error) {
      console.error('❌ Error initializing checkout:', error);
      this.errorMessage = 'Failed to initialize checkout. Please refresh and try again.';
      this.isInitialLoading = false;
    }
  }

  private async calculatePricing(): Promise<void> {
    try {
      console.log('🔧 Calculating pricing with backend API...');
      
      // Check if we have any items to calculate
      const estimateItems = this.buildEstimateItems();
      if (estimateItems.length === 0) {
        console.warn('⚠️ No items to calculate pricing for');
        this.estimateTotal = 0;
        this.taxAmount = 0;
        this.finalTotal = 0;
        this.total = 0;
        this.subtotal = 0;
        this.cartItems = [];
        return;
      }
      
      // Build estimate request based on query parameters
      const estimateRequest = {
        items: estimateItems,
        currency: this.localizationService.currentCurrency, // Use current currency from localization
        billingTerm: this.term
      };
      
      console.log('📊 Estimate request:', estimateRequest);
      
      // Call backend estimate API
      const response = await this.httpClient.post<any>(`${environment.apiUrl}/estimate`, estimateRequest).toPromise();
      
      console.log('✅ Estimate response:', response);
      
      // Update pricing from backend response
      this.estimateTotal = response.subtotal || 0;
      this.subtotal = response.subtotal || 0;
      
      // Calculate taxes if we have address data (for now use default)
      await this.calculateTaxes();
      
      this.finalTotal = this.estimateTotal + this.taxAmount;
      this.total = this.finalTotal;
      
      // Build cart items from response for display
      this.cartItems = this.buildDisplayCartItems(response.items || []);
      
    } catch (error) {
      console.error('❌ Error calculating pricing:', error);
      this.errorMessage = 'Failed to calculate pricing. Please try again.';
      
      // Fallback to mock data but no fake tax
      this.estimateTotal = 100;
      this.taxAmount = 0;  // No fake tax
      this.finalTotal = 100;
      this.total = this.finalTotal;
      this.subtotal = this.estimateTotal;
      
      // Create fallback cart items from URL parameters
      this.cartItems = this.buildFallbackCartItems();
    }
  }

  private buildEstimateItems(): any[] {
    const items: any[] = [];
    
    // Add PDF product if selected
    if (this.selectedPdfPlan && this.pdfSeats > 0) {
      items.push({
        productFamily: 'Nitro PDF',
        planName: this.selectedPdfPlan,
        seats: this.pdfSeats
      });
    }
    
    // Add Sign product if selected
    if (this.selectedSignPlan && this.signSeats > 0) {
      const signItem: any = {
        productFamily: 'Nitro Sign',
        planName: this.selectedSignPlan,
        seats: this.signSeats
      };
      
      // Add packages if any
      if (this.signPackages > 0) {
        signItem.packages = this.signPackages;
      }
      
      // Add API calls if any (this might need to be a separate item)
      if (this.signApiCalls > 0) {
        signItem.apiCalls = this.signApiCalls;
      }
      
      items.push(signItem);
    }
    
    return items;
  }

  private async calculateTaxes(): Promise<void> {
    // Don't calculate taxes initially - wait for user to enter address
    console.log('💡 Tax calculation skipped - waiting for user address input');
    this.taxAmount = 0;
  }

  private async initializeStripeElements(): Promise<void> {
    try {
      console.log('🔧 Initializing Stripe Elements...');
      
      // Debug: Check if DOM elements exist
      const addressContainer = document.getElementById('address-element');
      const paymentContainer = document.getElementById('payment-element');
      
      console.log('🔍 DOM elements check:', {
        addressContainer: !!addressContainer,
        paymentContainer: !!paymentContainer,
        isInitialLoading: this.isInitialLoading
      });
      
      // Get current localization settings
      const currentLocalization = this.localizationService.currentLocalization;
      const currentCurrency = this.localizationService.currentCurrency;
      
      console.log('🌍 Using localization settings:', {
        currency: currentCurrency,
        locale: currentLocalization.locale
      });
      
      // Initialize Stripe
      await this.stripeService.initializeStripe();
      
      // Create Elements with localization options
      await this.stripeService.createElements(undefined, {
        locale: this.getStripeLocale(currentLocalization.locale),
        currency: currentCurrency.toLowerCase(),
        country: this.getCountryFromCurrency(currentCurrency)
      });
      
      // Add another delay to ensure DOM elements are present
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Initialize Address element with localized defaults
      await this.initializeAddressElement();
      
      // Initialize Payment Element only if we're on 1-year terms
      if (this.term === '1year') {
        await this.initializePaymentElement();
      } else {
        this.isPaymentElementReady = true; // Skip payment element for 3-year terms
      }
      
      this.elementsReady = true;
      console.log('✅ All Stripe Elements initialized with localization');
      
    } catch (error) {
      console.error('❌ Error initializing Stripe elements:', error);
      this.errorMessage = 'Failed to load payment form. Please refresh and try again.';
      
      // Set ready states to true even on error to hide skeleton loaders
      this.isAddressElementReady = true;
      this.isPaymentElementReady = true;
    }
  }

  private async initializeAddressElement(): Promise<void> {
    try {
      console.log('🔧 Creating Address Element...');
      
      // Check if the container exists
      const container = document.getElementById('address-element');
      if (!container) {
        console.error('❌ Address container not found');
        throw new Error('Container not found');
      }
      
      // Get current localization settings
      const currentLocalization = this.localizationService.currentLocalization;
      const currentCurrency = this.localizationService.currentCurrency;
      const defaultCountry = this.getCountryFromCurrency(currentCurrency);
      
      console.log('🌍 Creating Address Element with localization:', {
        currency: currentCurrency,
        locale: currentLocalization.locale,
        defaultCountry
      });
      
      const addressElement = await this.stripeService.createAddressElement(
        'address-element', 
        {
          mode: 'billing',
          defaultValues: {
            name: '',
            address: {
              country: defaultCountry
            }
          }
        },
        {
          country: defaultCountry,
          locale: currentLocalization.locale
        }
      );
      
      if (addressElement) {
        // Set up address change listener for tax calculation
        addressElement.on('change', async (event) => {
          if (event.complete) {
            console.log('🏠 Address changed, recalculating taxes...');
            await this.recalculateTaxOnAddressChange();
          }
        });
        
        this.isAddressElementReady = true;
        console.log('✅ Address Element initialized with localized defaults');
      } else {
        console.warn('⚠️ Address Element returned null');
      }
    } catch (error) {
      console.error('❌ Error initializing Address Element:', error);
      this.elementErrors.address = 'Failed to load address form';
      this.isAddressElementReady = true;
    }
  }

  private async initializePaymentElement(): Promise<void> {
    try {
      console.log('🔧 Creating Payment Element...');
      
      const paymentElement = await this.stripeService.createPaymentElement('payment-element', {
        layout: {
          type: 'accordion',
          defaultCollapsed: false,
          radios: false,
          spacedAccordionItems: true
        }
      });
      
      if (paymentElement) {
        this.isPaymentElementReady = true;
        console.log('✅ Payment Element initialized');
      }
    } catch (error) {
      console.error('❌ Error initializing Payment Element:', error);
      this.elementErrors.payment = 'Failed to load payment form';
      this.isPaymentElementReady = true;
    }
  }

  async recalculateTaxOnAddressChange(): Promise<void> {
    try {
      // Only calculate if Address Element is ready and has data
      if (!this.isAddressElementReady) {
        console.log('🏠 Address Element not ready, skipping tax calculation');
        return;
      }

      const elementData = await this.stripeService.collectElementData();
      if (!elementData.address?.address) {
        console.log('🏠 No address data available, skipping tax calculation');
        this.taxAmount = 0;
        this.finalTotal = this.estimateTotal;
        this.total = this.finalTotal;
        return;
      }

      const customerAddress = {
        line1: elementData.address.address.line1,
        city: elementData.address.address.city,
        state: elementData.address.address.state,
        postalCode: elementData.address.address.postal_code,
        country: elementData.address.address.country
      };

      // Validate that we have the required address fields
      if (!customerAddress.line1 || !customerAddress.city || !customerAddress.postalCode || !customerAddress.country) {
        console.log('🏠 Incomplete address data, skipping tax calculation');
        this.taxAmount = 0;
        this.finalTotal = this.estimateTotal;
        this.total = this.finalTotal;
        return;
      }

      console.log('🏠 Using address from Address Element for tax calculation:', customerAddress);
      
      const taxRequest = {
        customerAddress,
        lineItems: [
          {
            description: 'Nitro Products',
            amount: {
              amount: this.estimateTotal,
              currency: this.localizationService.currentCurrency // Use current currency
            },
            taxable: true
          }
        ],
        currency: this.localizationService.currentCurrency // Use current currency
      };
      
      console.log('📊 Tax request:', taxRequest);
      
      const taxResponse = await this.httpClient.post<any>(`${environment.apiUrl}/taxes`, taxRequest).toPromise();
      
      console.log('📊 Tax response:', taxResponse);
      
      this.taxAmount = taxResponse.totalTax?.amount || 0;
      
      // Update final total with tax
      this.finalTotal = this.estimateTotal + this.taxAmount;
      this.total = this.finalTotal;
      
      console.log('✅ Tax calculation result:', { 
        estimateTotal: this.estimateTotal,
        taxAmount: this.taxAmount,
        finalTotal: this.finalTotal
      });
      
    } catch (error) {
      console.warn('⚠️ Tax calculation failed:', error);
      // On error, don't show tax
      this.taxAmount = 0;
      this.finalTotal = this.estimateTotal;
      this.total = this.finalTotal;
    }
  }

  private buildFallbackCartItems(): any[] {
    const items: any[] = [];
    
    // Add PDF item if selected
    if (this.selectedPdfPlan && this.pdfSeats > 0) {
      items.push({
        productName: `Nitro PDF - ${this.selectedPdfPlan}`,
        userCount: this.pdfSeats,
        basePrice: 50, // fallback price
        total: this.pdfSeats * 50,
        description: `${this.pdfSeats} ${this.pdfSeats === 1 ? 'seat' : 'seats'}`
      });
    }
    
    // Add Sign item if selected
    if (this.selectedSignPlan && this.signSeats > 0) {
      const signTotal = this.signSeats * 30 + (this.signPackages * 5) + (this.signApiCalls * 0.1);
      items.push({
        productName: `Nitro Sign - ${this.selectedSignPlan}`,
        userCount: this.signSeats,
        basePrice: 30, // fallback price
        packagesPrice: this.signPackages * 5,
        apiCallsPrice: this.signApiCalls * 0.1,
        total: signTotal,
        extraPackages: this.signPackages,
        description: this.buildFallbackSignDescription()
      });
    }
    
    return items;
  }

  private buildFallbackSignDescription(): string {
    let description = `${this.signSeats} ${this.signSeats === 1 ? 'seat' : 'seats'}`;
    
    if (this.signPackages > 0) {
      description += `, ${this.signPackages} signature packages`;
    }
    
    if (this.signApiCalls > 0) {
      description += `, ${this.signApiCalls} API calls`;
    }
    
    return description;
  }

  async processPayment(): Promise<void> {
    try {
      this.isProcessingPayment = true;
      this.isProcessing = true;
      this.errorMessage = '';
      
      console.log('🔧 Starting payment process...');
      
      // For 3-year terms, redirect to sales contact
      if (this.term === '3year') {
        this.contactSales();
        return;
      }
      
      // Validate email first
      if (!this.customerEmail || !this.customerEmail.trim()) {
        throw new Error('Email is required. Please enter your email address.');
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.customerEmail.trim())) {
        throw new Error('Please enter a valid email address.');
      }
      
      // Use the new method to submit elements and create payment method
      const paymentData = await this.stripeService.submitAndCreatePaymentMethod(this.customerEmail.trim());
      console.log('📊 Payment data collected:', paymentData);
      
      // Build checkout request for backend
      const checkoutRequest = this.buildCheckoutRequest(paymentData);
      console.log('🚀 Checkout request:', checkoutRequest);
      
      // Call backend checkout API
      const checkoutResponse = await this.httpClient.post<any>(`${environment.apiUrl}/checkout`, checkoutRequest).toPromise();
      
      console.log('✅ Checkout response:', checkoutResponse);
      
      if (checkoutResponse.success) {
        // Success! Show completion
        this.checkoutComplete = true;
        this.successMessage = checkoutResponse.message || 'Order completed successfully!';
      } else if (checkoutResponse.salesContactRequired) {
        // 3-year terms require sales contact
        this.contactSales();
      } else {
        // Payment method required or other error
        this.errorMessage = checkoutResponse.message || 'Payment processing failed. Please try again.';
      }
      
    } catch (error) {
      console.error('❌ Error processing payment:', error);
      // Show the actual error message to help with debugging
      this.errorMessage = error instanceof Error ? error.message : 'Payment failed. Please check your payment information and try again.';
    } finally {
      this.isProcessingPayment = false;
      this.isProcessing = false;
    }
  }

  private buildCheckoutRequest(paymentData: {paymentMethodId: string, elementData: any}): any {
    const elementData = paymentData.elementData;
    const currentCurrency = this.localizationService.currentCurrency;
    
    // Validate required data - fail fast if missing
    if (!this.customerEmail || !this.customerEmail.trim()) {
      throw new Error('Email is required but was not provided');
    }
    
    if (!elementData.address) {
      throw new Error('Billing address is required but was not provided');
    }
    
    if (!elementData.address.name) {
      throw new Error('Customer name is required but was not provided');
    }
    
    if (!elementData.address.address) {
      throw new Error('Complete address details are required but were not provided');
    }
    
    if (!paymentData.paymentMethodId) {
      throw new Error('Payment method is required but was not provided');
    }
    
    const nameParts = elementData.address.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    
    if (!firstName) {
      throw new Error('First name is required');
    }
    
    const request = {
      customer: {
        firstName: firstName,
        lastName: lastName || firstName, // Use first name if no last name provided
        email: this.customerEmail.trim(),
        company: elementData.address.organization || ''
      },
      billingAddress: {
        firstName: firstName,
        lastName: lastName || firstName,
        line1: elementData.address.address.line1,
        line2: elementData.address.address.line2 || '',
        city: elementData.address.address.city,
        state: elementData.address.address.state,
        postalCode: elementData.address.address.postal_code,
        country: elementData.address.address.country,
        company: elementData.address.organization || ''
      },
      items: this.buildChargebeeItems(),
      currency: currentCurrency,
      billingTerm: this.term,
      paymentMethodId: paymentData.paymentMethodId // Include payment method ID
    };
    
    console.log('🚀 Built checkout request with validated data:', request);
    return request;
  }

  private buildDisplayCartItems(backendItems: any[]): any[] {
    return backendItems.map(item => ({
      productName: `${item.productFamily} - ${item.planName}`,
      userCount: item.seats,
      basePrice: item.basePrice,
      packagesPrice: item.packagesPrice || 0,
      apiCallsPrice: item.apiCallsPrice || 0,
      total: item.totalPrice,
      appliedTier: item.appliedTier,
      extraPackages: item.extraPackages,
      description: this.buildItemDescription(item)
    }));
  }

  private buildItemDescription(item: any): string {
    let description = `${item.seats} ${item.seats === 1 ? 'seat' : 'seats'}`;
    
    if (item.extraPackages > 0) {
      description += `, ${item.extraPackages} additional packages`;
    }
    
    if (item.appliedTier) {
      description += ` (${item.appliedTier.price}/seat tier)`;
    }
    
    return description;
  }

  private buildChargebeeItems(): any[] {
    const items: any[] = [];
    const currentCurrency = this.localizationService.currentCurrency;
    
    // Add PDF product if selected
    if (this.selectedPdfPlan && this.pdfSeats > 0) {
      const itemPriceId = this.findItemPriceId('PDF', this.selectedPdfPlan, currentCurrency, this.term);
      
      if (itemPriceId) {
        items.push({
          itemPriceId: itemPriceId,
          quantity: this.pdfSeats
        });
        console.log('✅ Added PDF item:', { itemPriceId, quantity: this.pdfSeats });
      } else {
        console.warn('⚠️ Could not find item price ID for PDF plan:', this.selectedPdfPlan);
      }
    }
    
    // Add Sign product if selected
    if (this.selectedSignPlan && this.signSeats > 0) {
      const itemPriceId = this.findItemPriceId('Sign', this.selectedSignPlan, currentCurrency, this.term);
      
      if (itemPriceId) {
        items.push({
          itemPriceId: itemPriceId,
          quantity: this.signSeats
        });
        console.log('✅ Added Sign item:', { itemPriceId, quantity: this.signSeats });
      } else {
        console.warn('⚠️ Could not find item price ID for Sign plan:', this.selectedSignPlan);
      }
    }
    
    console.log('🚀 Final Chargebee items:', items);
    return items;
  }

  private findItemPriceId(productType: string, planName: string, currency: string, term: BillingTerm): string | null {
    // Fallback to hardcoded mapping
    return this.getFallbackItemPriceId(productType, planName, currency, term);
  }

  private getFallbackItemPriceId(productType: string, planName: string, currency: string, term: BillingTerm): string | null {
    // Map term to the actual format used in Chargebee
    const yearSuffix = term === '1year' ? '1_YEAR' : '3_YEAR';
    
    // Handle PDF products - only Standard and Plus exist
    if (productType === 'PDF') {
      if (planName.toLowerCase().includes('standard')) {
        return `Nitro_PDF_STD-${currency}-${yearSuffix}`;
      } else if (planName.toLowerCase().includes('plus')) {
        return `Nitro_PDF_PLUS-${currency}-${yearSuffix}`;
      } else {
        // Default to Standard for any unknown plan names
        console.warn('⚠️ Unknown PDF plan name:', planName, '- defaulting to Standard');
        return `Nitro_PDF_STD-${currency}-${yearSuffix}`;
      }
    }
    
    // Handle Sign products - Standard, Plus, Enterprise exist
    if (productType === 'Sign') {
      if (planName.toLowerCase().includes('standard')) {
        return `Nitro_SIGN_STD-${currency}-${yearSuffix}`;
      } else if (planName.toLowerCase().includes('plus')) {
        return `Nitro_SIGN_PLUS-${currency}-${yearSuffix}`;
      } else if (planName.toLowerCase().includes('enterprise')) {
        return `Nitro_SIGN_ENT-${currency}-${yearSuffix}`;
      } else {
        // Default to Standard for any unknown plan names (like "Business")
        console.warn('⚠️ Unknown Sign plan name:', planName, '- defaulting to Standard');
        return `Nitro_SIGN_STD-${currency}-${yearSuffix}`;
      }
    }
    
    return null;
  }

  // Helper methods for localization
  private getStripeLocale(locale: string): string {
    // Map our locale to Stripe supported locales
    // Stripe supports: en, de, es, fr, it, ja, nl, pl, pt, sv, etc.
    const localeMap: Record<string, string> = {
      'en-US': 'en',
      'en-CA': 'en', 
      'en-GB': 'en',
      'en-AU': 'en',
      'de-DE': 'de',
      'fr-FR': 'fr',
      'es-ES': 'es',
      'it-IT': 'it',
      'nl-NL': 'nl',
      'sv-SE': 'sv',
      'pt-PT': 'pt',
      'pl-PL': 'pl'
    };
    
    return localeMap[locale] || 'en'; // Default to English
  }

  private getCountryFromCurrency(currency: string): string {
    // Map currency to most likely country for address defaults
    const currencyToCountryMap: Record<string, string> = {
      'USD': 'US',
      'CAD': 'CA',
      'GBP': 'GB', 
      'AUD': 'AU',
      'EUR': 'DE' // Default to Germany for EUR, but users can change
    };
    
    return currencyToCountryMap[currency] || 'US';
  }

  private subscribeToLocalizationChanges(): void {
    this.localizationService.localization$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (localizationState) => {
        console.log('🌍 Localization changed on checkout page:', localizationState);
        
        // If Elements are already initialized, reinitialize them with new settings
        if (this.elementsReady && !this.isInitialLoading) {
          console.log('🔄 Reinitializing Stripe Elements due to localization change...');
          await this.reinitializeStripeElements();
        }
        
        // Recalculate pricing with new currency
        await this.calculatePricing();
      });
  }

  private async reinitializeStripeElements(): Promise<void> {
    try {
      console.log('🔄 Reinitializing Stripe Elements with new localization...');
      
      // Destroy existing elements
      this.stripeService.destroyElements();
      
      // Reset ready states
      this.isAddressElementReady = false;
      this.isPaymentElementReady = false;
      this.elementsReady = false;
      
      // Wait a moment for DOM cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reinitialize with new localization settings
      await this.initializeStripeElements();
      
      console.log('✅ Stripe Elements reinitialized successfully');
    } catch (error) {
      console.error('❌ Error reinitializing Stripe elements:', error);
      this.errorMessage = 'Failed to update payment form. Please refresh the page.';
    }
  }
}