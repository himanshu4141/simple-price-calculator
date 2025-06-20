import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

import {
  PricingService,
  EstimateRequest,
  EstimateItemRequest,
  BillingTerm
} from '../../services/pricing.service';
import { LocalizationService } from '../../services/localization.service';
import { StripeService } from '../../services/stripe.service';
import { PackageCalculations } from '../../utils/package-calculations.util';
import { environment } from '../../../environments/environment';

interface CheckoutItem {
  readonly itemPriceId: string;
  readonly quantity: number;
}

interface BillingAddress {
  readonly firstName: string;
  readonly lastName: string;
  readonly line1: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
}

interface Customer {
  readonly id?: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly company?: string;
}

interface CheckoutRequest {
  readonly customer: Customer;
  readonly billingAddress: BillingAddress;
  readonly items: readonly CheckoutItem[];
  readonly currency: string;
  readonly billingTerm: string;
  readonly paymentMethodId?: string;
  readonly stripeToken?: string;
}

interface CheckoutResponse {
  readonly success: boolean;
  readonly customerId?: string;
  readonly subscriptionId?: string;
  readonly salesContactRequired?: boolean;
  readonly message?: string;
  readonly error?: string;
}

interface TaxRequest {
  readonly items: Array<{
    readonly productFamily: string;
    readonly planName: string;
    readonly seats: number;
    readonly packages?: number;
    readonly apiCalls?: number;
  }>;
  readonly customerAddress: {
    readonly line1: string;
    readonly city: string;
    readonly state: string;
    readonly zip: string;
    readonly country: string;
  };
  readonly currency: string;
}

interface Money {
  readonly amount: number;
  readonly currency: string;
}

interface TaxBreakdownItem {
  readonly name: string;
  readonly rate: number;
  readonly amount: Money;
  readonly description: string;
}

interface TaxLineItemResponse {
  readonly description: string;
  readonly subtotal: Money;
  readonly taxAmount: Money;
  readonly total: Money;
}

interface TaxResponse {
  readonly totalTax: Money;
  readonly taxBreakdown: readonly TaxBreakdownItem[];
  readonly lineItems: readonly TaxLineItemResponse[];
}

interface CheckoutState {
  readonly isProcessingPayment: boolean;
  readonly paymentCompleted: boolean;
  readonly showPaymentError: boolean;
  readonly salesContactRequired: boolean;
  readonly estimateCalculated: boolean;
  readonly taxCalculated: boolean;
}

@Component({
  selector: 'app-checkout-page',
  templateUrl: './checkout-page.component.html',
  styleUrls: ['./checkout-page.component.scss']
})
export class CheckoutPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  @ViewChild('cardElementContainer', { static: false }) cardElementContainer!: ElementRef;
  
  checkoutForm!: FormGroup;
  
  // Cart data from query params
  selectedPdfPlan = '';
  selectedSignPlan = '';
  pdfSeats = 1;
  signSeats = 1;
  signPackages = 0;
  signApiCalls = 0;
  term: BillingTerm = '1year';
  
  // Checkout state
  isLoading = false;
  showSalesModal = false;
  checkoutComplete = false;
  errorMessage = '';
  
  // Stripe state
  stripeReady = false;
  isProcessingPayment = false;
  paymentErrors = '';
  paymentMethodCreated = false;
  
  // Pricing data
  estimateTotal = 0;
  taxAmount = 0;
  finalTotal = 0;
  
  // Country options for dropdown
  readonly countries = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' }
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly formBuilder: FormBuilder,
    private readonly pricingService: PricingService,
    private readonly localizationService: LocalizationService,
    private readonly stripeService: StripeService,
    private readonly httpClient: HttpClient,
    private readonly ngZone: NgZone
  ) {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.checkoutForm = this.formBuilder.group({
      // Customer information
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      company: [''],
      
      // Billing address
      line1: ['', [Validators.required]],
      city: ['', [Validators.required]],
      state: ['', [Validators.required]],
      zip: ['', [Validators.required]],
      country: ['US', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.initializeCartFromQueryParams();
    this.setupFormValidation();
    this.initializeStripe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeCartFromQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.parseCartParameters(params);
        this.calculateEstimate();
      });
  }

  private parseCartParameters(params: any): void {
    this.selectedPdfPlan = params['nitropdf_plan'] || '';
    this.selectedSignPlan = params['nitrosign_plan'] || '';
    this.pdfSeats = this.parseIntegerParam(params['nitropdf_seats'], 1);
    this.signSeats = this.parseIntegerParam(params['nitrosign_seats'], 1);
    this.signPackages = this.parseIntegerParam(params['nitrosign_packages'], 0);
    this.signApiCalls = this.parseIntegerParam(params['nitrosign_apiCalls'], 0);
    this.term = this.isValidBillingTerm(params['term']) ? params['term'] : '1year';
    
    console.log('🛒 Checkout initialized with cart data:', {
      pdfPlan: this.selectedPdfPlan,
      signPlan: this.selectedSignPlan,
      term: this.term
    });
  }

  private parseIntegerParam(value: string, defaultValue: number): number {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
  }

  private isValidBillingTerm(term: string): term is BillingTerm {
    return term === '1year' || term === '3year';
  }

  private setupFormValidation(): void {
    this.checkoutForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.checkoutForm.valid) {
          this.calculateTax();
        }
      });
  }

  ngAfterViewInit(): void {
    // Set up Stripe Card Element after view is initialized
    if (this.term === '1year') {
      // Use setTimeout to ensure DOM is fully ready
      setTimeout(() => {
        this.setupStripeCardElement().catch(error => {
          console.error('❌ Failed to setup card element in ngAfterViewInit:', error);
          this.paymentErrors = 'Payment form setup failed. Please refresh the page.';
        });
      }, 100);
    }
  }

  private async initializeStripe(): Promise<void> {
    try {
      await this.stripeService.initializeStripe();
      this.stripeReady = true;
      console.log('✅ Stripe initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Stripe:', error);
      this.paymentErrors = 'Payment system initialization failed. Please refresh and try again.';
    }
  }

  private async setupStripeCardElement(): Promise<void> {
    console.log('🔧 Setting up Stripe Card Element...', {
      stripeReady: this.stripeReady,
      cardElementContainer: !!this.cardElementContainer,
      term: this.term,
      paymentMethodCreated: this.paymentMethodCreated
    });
    
    // Don't setup if already created
    if (this.paymentMethodCreated) {
      console.log('✅ Card Element already set up, skipping');
      return;
    }
    
    if (!this.stripeReady) {
      console.warn('❌ Stripe not ready yet, retrying...');
      setTimeout(() => this.setupStripeCardElement(), 200);
      return;
    }
    
    if (!this.cardElementContainer) {
      console.warn('❌ Card element container not found, retrying...');
      setTimeout(() => this.setupStripeCardElement(), 200);
      return;
    }

    try {
      // Create elements instance only if not already created
      const existingCardElement = this.stripeService.getCardElement();
      if (!existingCardElement) {
        this.stripeService.createElements();
        await this.stripeService.createCardElement('card-element');
      } else {
        console.log('✅ Card Element already exists, reusing');
      }
      
      this.paymentMethodCreated = true;
      console.log('✅ Stripe Card Element setup completed');
    } catch (error) {
      console.error('❌ Failed to setup Stripe Card Element:', error);
      this.paymentErrors = 'Payment form setup failed. Please refresh and try again.';
    }
  }

  calculateEstimate(): void {
    if (!this.selectedPdfPlan && !this.selectedSignPlan) {
      return;
    }

    const estimateItems: EstimateItemRequest[] = [];

    if (this.selectedPdfPlan) {
      estimateItems.push({
        productFamily: 'Nitro PDF',
        planName: this.selectedPdfPlan,
        seats: this.pdfSeats,
        packages: 0,
        apiCalls: 0
      });
    }

    if (this.selectedSignPlan) {
      estimateItems.push({
        productFamily: 'Nitro Sign',
        planName: this.selectedSignPlan,
        seats: this.signSeats,
        packages: this.signPackages,
        apiCalls: this.signApiCalls
      });
    }

    const estimateRequest: EstimateRequest = {
      items: estimateItems,
      currency: this.localizationService.currentCurrency,
      billingTerm: this.term
    };

    console.log('🧮 Calculating checkout estimate:', estimateRequest);

    this.pricingService.getEstimate(estimateRequest).subscribe(
      response => {
        this.estimateTotal = response.total;
        this.calculateFinalTotal();
        console.log('✅ Checkout estimate calculated:', response.total);
      },
      error => {
        console.error('❌ Failed to calculate estimate:', error);
        this.errorMessage = 'Failed to calculate pricing. Please try again.';
      }
    );
  }

  calculateTax(): void {
    if (!this.checkoutForm.valid || this.estimateTotal === 0) {
      return;
    }

    const formValue = this.checkoutForm.value;
    const taxItems = [];

    if (this.selectedPdfPlan) {
      taxItems.push({
        productFamily: 'Nitro PDF',
        planName: this.selectedPdfPlan,
        seats: this.pdfSeats
      });
    }

    if (this.selectedSignPlan) {
      taxItems.push({
        productFamily: 'Nitro Sign',
        planName: this.selectedSignPlan,
        seats: this.signSeats,
        packages: this.signPackages,
        apiCalls: this.signApiCalls
      });
    }

    const taxRequest: TaxRequest = {
      items: taxItems,
      customerAddress: {
        line1: formValue.line1,
        city: formValue.city,
        state: formValue.state,
        zip: formValue.zip,
        country: formValue.country
      },
      currency: this.localizationService.currentCurrency
    };

    console.log('💰 Calculating tax:', taxRequest);

    this.httpClient.post<TaxResponse>(`${environment.apiUrl}/taxes`, taxRequest).subscribe(
      (response: TaxResponse) => {
        this.taxAmount = response.totalTax.amount; // Extract amount from Money object
        this.calculateFinalTotal();
        console.log('✅ Tax calculated:', { amount: response.totalTax.amount, currency: response.totalTax.currency });
      },
      (error: any) => {
        console.warn('⚠️ Failed to calculate tax, proceeding without tax:', error);
        this.taxAmount = 0;
        this.calculateFinalTotal();
      }
    );
  }

  calculateFinalTotal(): void {
    this.finalTotal = this.estimateTotal + this.taxAmount;
  }

  onSubmit(event?: Event): void {
    // Prevent default form submission behavior if called from form submit
    if (event) {
      event.preventDefault();
    }
    
    if (this.checkoutForm.invalid) {
      this.markFormGroupTouched(this.checkoutForm);
      return;
    }

    // Check for 3-year terms and show sales contact modal
    if (this.term === '3year' || this.term.toLowerCase().includes('3')) {
      this.showSalesModal = true;
      return;
    }

    // Proceed with 1-year checkout
    this.processCheckout();
  }

  private getChargebeeItemPriceId(planName: string, term: string = '1year'): string {
    const currency = 'USD';
    const termSuffix = term === '3year' ? '3_YEAR' : '1_YEAR';
    
    // Map plan names to Chargebee item price IDs
    const planMappings: { [key: string]: string } = {
      'Nitro PDF Standard': `Nitro_PDF_STD-${currency}-${termSuffix}`,
      'Nitro PDF Plus': `Nitro_PDF_PLUS-${currency}-${termSuffix}`,
      'Nitro PDF Enterprise': `Nitro_PDF_ENT-${currency}-${termSuffix}`,
      'Nitro Sign Standard': `Nitro_SIGN_STD-${currency}-${termSuffix}`,
      'Nitro Sign Plus': `Nitro_SIGN_PLUS-${currency}-${termSuffix}`,
      'Nitro Sign Enterprise': `Nitro_SIGN_ENT-${currency}-${termSuffix}`
    };

    const itemPriceId = planMappings[planName];
    if (!itemPriceId) {
      console.error(`No Chargebee item price ID found for plan: ${planName}`);
      return planName.toLowerCase().replace(/ /g, '-'); // fallback
    }
    
    return itemPriceId;
  }

  private getPackageAddonItemPriceId(term: string = '1year'): string {
    const currency = 'USD';
    const termSuffix = term === '3year' ? '3-Year' : 'Yearly';
    return `sign-packages-${currency}-${termSuffix}`;
  }

  private getApiCallAddonItemPriceId(term: string = '1year'): string {
    const currency = 'USD';
    const termSuffix = term === '3year' ? '3-Year' : 'Yearly';
    return `sign-api-${currency}-${termSuffix}`;
  }

  processCheckout(): void {
    if (this.term === '1year') {
      // For 1-year terms, process payment with Stripe
      this.processStripePayment();
    } else {
      // For 3-year terms, create subscription without payment
      this.processCheckoutWithoutPayment();
    }
  }

  private async processStripePayment(): Promise<void> {
    this.isProcessingPayment = true;
    this.errorMessage = '';
    this.paymentErrors = '';

    const formValue = this.checkoutForm.value;

    try {
      // Ensure card element is properly set up before proceeding
      if (!this.isCardElementReady()) {
        console.warn('⚠️ Card element not ready, attempting to set up...');
        await this.setupStripeCardElement();
        
        // Wait a bit more for element to be fully ready
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!this.isCardElementReady()) {
          throw new Error('Payment form not ready. Please refresh the page and try again.');
        }
      }

      // Set loading state AFTER ensuring card element is ready
      // This prevents potential DOM issues from Angular re-rendering
      this.isLoading = true;

      // Create Stripe PaymentMethod (more reliable than tokens)
      console.log('🔐 Creating Stripe PaymentMethod...');
      
      // Run in NgZone to ensure proper change detection
      const paymentMethodResult = await this.ngZone.run(async () => {
        // Extra delay to ensure DOM is stable after setting isLoading
        await new Promise(resolve => setTimeout(resolve, 200));
        
        return await this.stripeService.createPaymentMethod({
          name: `${formValue.firstName} ${formValue.lastName}`,
          email: formValue.email,
          address_line1: formValue.line1,
          address_city: formValue.city,
          address_state: formValue.state,
          address_zip: formValue.zip,
          address_country: formValue.country,
        });
      });

      if (paymentMethodResult.error) {
        console.error('❌ Stripe PaymentMethod creation failed:', paymentMethodResult.error);
        this.paymentErrors = paymentMethodResult.error.message || 'Payment processing failed. Please check your card information.';
        this.isProcessingPayment = false;
        this.isLoading = false;
        return;
      }

      if (!paymentMethodResult.paymentMethod) {
        console.error('❌ No PaymentMethod returned from Stripe');
        this.paymentErrors = 'Payment processing failed. Please try again.';
        this.isProcessingPayment = false;
        this.isLoading = false;
        return;
      }

      console.log('✅ Stripe PaymentMethod created:', paymentMethodResult.paymentMethod.id);

      // Process checkout with PaymentMethod
      await this.processCheckoutWithPaymentMethod(paymentMethodResult.paymentMethod);      } catch (error: any) {
        console.error('❌ Stripe payment processing error:', error);
        this.paymentErrors = error.message || 'Payment processing failed. Please try again.';
        this.isProcessingPayment = false;
        this.isLoading = false;
      }
  }

  private async processCheckoutWithPaymentMethod(paymentMethod: any): Promise<void> {
    const formValue = this.checkoutForm.value;
    
    // Build checkout items
    const checkoutItems: CheckoutItem[] = [];
    
    if (this.selectedPdfPlan) {
      checkoutItems.push({
        itemPriceId: this.getChargebeeItemPriceId(this.selectedPdfPlan, this.term),
        quantity: this.pdfSeats
      });
    }
    
    if (this.selectedSignPlan) {
      checkoutItems.push({
        itemPriceId: this.getChargebeeItemPriceId(this.selectedSignPlan, this.term),
        quantity: this.signSeats
      });
      
      // Add packages as specified by user (cart should have already handled free package deduction)
      if (this.signPackages > 0) {
        checkoutItems.push({
          itemPriceId: this.getPackageAddonItemPriceId(this.term),
          quantity: this.signPackages
        });
      }
      
      // Add API calls if any (only for Enterprise plan)
      if (this.selectedSignPlan === 'Nitro Sign Enterprise' && this.signApiCalls > 0) {
        checkoutItems.push({
          itemPriceId: this.getApiCallAddonItemPriceId(this.term),
          quantity: this.signApiCalls
        });
      }
    }

    const checkoutRequest: CheckoutRequest = {
      customer: {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email,
        company: formValue.company
      },
      billingAddress: {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        line1: formValue.line1,
        city: formValue.city,
        state: formValue.state,
        postalCode: formValue.zip,
        country: formValue.country
      },
      items: checkoutItems,
      currency: this.localizationService.currentCurrency,
      billingTerm: this.term,
      paymentMethodId: paymentMethod.id
    };

    console.log('🔄 Processing checkout with Stripe PaymentMethod:', {
      ...checkoutRequest,
      paymentMethodId: '***' // Don't log the actual PaymentMethod ID
    });

    console.log('🛒 Checkout items being sent:', {
      selectedPdfPlan: this.selectedPdfPlan,
      selectedSignPlan: this.selectedSignPlan,
      pdfSeats: this.pdfSeats,
      signSeats: this.signSeats,
      signPackages: this.signPackages,
      signApiCalls: this.signApiCalls,
      checkoutItems: checkoutItems.map(item => ({
        itemPriceId: item.itemPriceId,
        quantity: item.quantity
      }))
    });

    this.httpClient.post<CheckoutResponse>(`${environment.apiUrl}/checkout`, checkoutRequest).subscribe(
      (response: CheckoutResponse) => {
        this.isLoading = false;
        this.isProcessingPayment = false;
        
        if (response.success) {
          console.log('✅ Checkout successful:', response);
          this.checkoutComplete = true;
        } else if (response.salesContactRequired) {
          console.log('📞 Sales contact required:', response);
          this.showSalesModal = true;
        } else {
          console.error('❌ Checkout failed:', response);
          this.errorMessage = response.message || 'Checkout failed. Please try again.';
        }
      },
      (error: any) => {
        this.isLoading = false;
        this.isProcessingPayment = false;
        console.error('❌ Checkout error:', error);
        
        if (error.error && typeof error.error === 'object' && error.error.message) {
          this.errorMessage = error.error.message || 'Checkout failed. Please try again.';
        } else {
          this.errorMessage = 'An error occurred during checkout. Please try again.';
        }
      }
    );
  }

  private processCheckoutWithoutPayment(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const formValue = this.checkoutForm.value;
    
    // Build checkout items
    const checkoutItems: CheckoutItem[] = [];
    
    if (this.selectedPdfPlan) {
      checkoutItems.push({
        itemPriceId: this.getChargebeeItemPriceId(this.selectedPdfPlan, this.term),
        quantity: this.pdfSeats
      });
    }
    
    if (this.selectedSignPlan) {
      checkoutItems.push({
        itemPriceId: this.getChargebeeItemPriceId(this.selectedSignPlan, this.term),
        quantity: this.signSeats
      });
      
      // Add packages as specified by user (cart should have already handled free package deduction)
      if (this.signPackages > 0) {
        checkoutItems.push({
          itemPriceId: this.getPackageAddonItemPriceId(this.term),
          quantity: this.signPackages
        });
      }
      
      // Add API calls if any (only for Enterprise plan)
      if (this.selectedSignPlan === 'Nitro Sign Enterprise' && this.signApiCalls > 0) {
        checkoutItems.push({
          itemPriceId: this.getApiCallAddonItemPriceId(this.term),
          quantity: this.signApiCalls
        });
      }
    }

    const checkoutRequest: CheckoutRequest = {
      customer: {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email,
        company: formValue.company
      },
      billingAddress: {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        line1: formValue.line1,
        city: formValue.city,
        state: formValue.state,
        postalCode: formValue.zip,
        country: formValue.country
      },
      items: checkoutItems,
      currency: this.localizationService.currentCurrency,
      billingTerm: this.term
    };

    console.log('� Checkout items being sent (no payment):', {
      selectedPdfPlan: this.selectedPdfPlan,
      selectedSignPlan: this.selectedSignPlan,
      pdfSeats: this.pdfSeats,
      signSeats: this.signSeats,
      signPackages: this.signPackages,
      signApiCalls: this.signApiCalls,
      checkoutItems: checkoutItems.map(item => ({
        itemPriceId: item.itemPriceId,
        quantity: item.quantity
      }))
    });

    console.log('�🔄 Processing checkout without payment:', checkoutRequest);

    this.httpClient.post<CheckoutResponse>(`${environment.apiUrl}/checkout`, checkoutRequest).subscribe(
      (response: CheckoutResponse) => {
        this.isLoading = false;
        
        if (response.success) {
          console.log('✅ Checkout successful:', response);
          this.checkoutComplete = true;
        } else if (response.salesContactRequired) {
          console.log('📞 Sales contact required:', response);
          this.showSalesModal = true;
        } else {
          console.error('❌ Checkout failed:', response);
          // Check if this is the expected "no payment method" error
          if (response.message && response.message.includes('no valid card on file')) {
            this.errorMessage = 'Demo Mode: Customer account created successfully! In production, you would be redirected to add payment information.';
            console.log('🏗️ Demo checkout completed - Customer created, payment method needed');
          } else {
            this.errorMessage = response.message || 'Checkout failed. Please try again.';
          }
        }
      },
      (error: any) => {
        this.isLoading = false;
        console.error('❌ Checkout error:', error);
        
        // Parse the error response to check for expected payment method error
        if (error.error && typeof error.error === 'object' && error.error.message) {
          if (error.error.message.includes('no valid card on file')) {
            this.errorMessage = 'Demo Mode: Customer account created successfully! In production, you would be redirected to add payment information.';
            console.log('🏗️ Demo checkout completed - Customer created, payment method needed');
          } else {
            this.errorMessage = error.error.message || 'Checkout failed. Please try again.';
          }
        } else {
          this.errorMessage = 'An error occurred during checkout. Please try again.';
        }
      }
    );
  }

  closeSalesModal(): void {
    this.showSalesModal = false;
  }

  returnToCart(): void {
    this.router.navigate(['/cart'], {
      queryParams: {
        nitropdf_plan: this.selectedPdfPlan,
        nitropdf_seats: this.pdfSeats,
        nitrosign_plan: this.selectedSignPlan,
        nitrosign_seats: this.signSeats,
        nitrosign_packages: this.signPackages,
        nitrosign_apiCalls: this.signApiCalls,
        term: this.term
      }
    });
  }

  startNewOrder(): void {
    this.router.navigate(['/']);
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  // Helper methods for template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.checkoutForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.checkoutForm.get(fieldName);
    if (field && field.invalid && field.touched) {
      if (field.errors?.['required']) return `${fieldName} is required`;
      if (field.errors?.['email']) return 'Please enter a valid email address';
      if (field.errors?.['minlength']) return `${fieldName} must be at least ${field.errors['minlength'].requiredLength} characters`;
    }
    return '';
  }

  private isCardElementReady(): boolean {
    // Check if the card element container exists in DOM
    const container = document.getElementById('card-element');
    if (!container) {
      console.warn('❌ Card element container not found in DOM');
      return false;
    }

    // Check if container is visible (not hidden by display:none or visibility:hidden)
    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
      console.warn('❌ Card element container is hidden');
      return false;
    }

    // Check if element is visible (not hidden by *ngIf)
    if (this.term !== '1year' || this.checkoutComplete) {
      console.warn('❌ Card element should not be visible for this term or checkout state');
      return false;
    }

    // Check if Stripe components are ready
    if (!this.stripeReady || !this.paymentMethodCreated) {
      console.warn('❌ Stripe components not ready', { stripeReady: this.stripeReady, paymentMethodCreated: this.paymentMethodCreated });
      return false;
    }

    // Check if Stripe iframe is present (indicates successful mount)
    const stripeFrame = container.querySelector('iframe[name^="__privateStripeFrame"]');
    if (!stripeFrame) {
      console.warn('❌ Stripe iframe not found in container');
      return false;
    }

    console.log('✅ Card element ready check passed');
    return true;
  }

  formatPrice(price: number): string {
    return this.localizationService.formatCurrency(price);
  }

  getCurrentCurrency(): string {
    return this.localizationService.currentCurrency;
  }
}
