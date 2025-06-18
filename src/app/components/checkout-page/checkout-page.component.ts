import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PricingService, EstimateRequest, EstimateItemRequest } from '../../services/pricing.service';
import { StripeService } from '../../services/stripe.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface CheckoutItem {
  itemPriceId: string;
  quantity: number;
}

interface BillingAddress {
  firstName: string;
  lastName: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface Customer {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
}

interface CheckoutRequest {
  customer: Customer;
  billingAddress: BillingAddress;
  items: CheckoutItem[];
  currency: string;
  billingTerm: string;
  paymentMethodId?: string;
  stripeToken?: string;
}

interface CheckoutResponse {
  success: boolean;
  customerId?: string;
  subscriptionId?: string;
  salesContactRequired?: boolean;
  message?: string;
  error?: string;
}

interface TaxRequest {
  items: Array<{
    productFamily: string;
    planName: string;
    seats: number;
    packages?: number;
    apiCalls?: number;
  }>;
  customerAddress: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  currency: string;
}

interface Money {
  amount: number;
  currency: string;
}

interface TaxBreakdownItem {
  name: string;
  rate: number;
  amount: Money;
  description: string;
}

interface TaxLineItemResponse {
  description: string;
  subtotal: Money;
  taxAmount: Money;
  total: Money;
}

interface TaxResponse {
  totalTax: Money;
  taxBreakdown: TaxBreakdownItem[];
  lineItems: TaxLineItemResponse[];
}

@Component({
  selector: 'app-checkout-page',
  templateUrl: './checkout-page.component.html',
  styleUrls: ['./checkout-page.component.scss']
})
export class CheckoutPageComponent implements OnInit, AfterViewInit {
  @ViewChild('cardElementContainer', { static: false }) cardElementContainer!: ElementRef;
  
  checkoutForm: FormGroup;
  
  // Cart data from query params
  selectedPdfPlan = '';
  selectedSignPlan = '';
  pdfSeats = 1;
  signSeats = 1;
  signPackages = 0;
  signApiCalls = 0;
  term: '1year' | '3year' = '1year';
  
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
  countries = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private pricingService: PricingService,
    private stripeService: StripeService,
    private http: HttpClient,
    private ngZone: NgZone
  ) {
    this.checkoutForm = this.fb.group({
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
    // Get cart data from query parameters
    this.route.queryParams.subscribe(params => {
      this.selectedPdfPlan = params['nitropdf_plan'] || '';
      this.selectedSignPlan = params['nitrosign_plan'] || '';
      this.pdfSeats = parseInt(params['nitropdf_seats'], 10) || 1;
      this.signSeats = parseInt(params['nitrosign_seats'], 10) || 1;
      this.signPackages = parseInt(params['nitrosign_packages'], 10) || 0;
      this.signApiCalls = parseInt(params['nitrosign_apiCalls'], 10) || 0;
      this.term = (params['term'] as '1year' | '3year') || '1year';
      
      console.log('🛒 Checkout initialized with cart data:', {
        pdfPlan: this.selectedPdfPlan,
        signPlan: this.selectedSignPlan,
        term: this.term
      });
      
      // Calculate initial estimate
      this.calculateEstimate();
    });

    // Watch for address changes to recalculate tax
    this.checkoutForm.valueChanges.subscribe(() => {
      if (this.checkoutForm.valid) {
        this.calculateTax();
      }
    });

    // Initialize Stripe
    this.initializeStripe();
  }

  ngAfterViewInit(): void {
    // Set up Stripe Card Element after view is initialized
    if (this.term === '1year') {
      // Use setTimeout to ensure DOM is fully ready
      setTimeout(() => {
        this.setupStripeCardElement();
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
      currency: 'USD',
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
      currency: 'USD'
    };

    console.log('💰 Calculating tax:', taxRequest);

    this.http.post<TaxResponse>(`${environment.apiUrl}/taxes`, taxRequest).subscribe(
      response => {
        this.taxAmount = response.totalTax.amount; // Extract amount from Money object
        this.calculateFinalTotal();
        console.log('✅ Tax calculated:', { amount: response.totalTax.amount, currency: response.totalTax.currency });
      },
      error => {
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
    this.isLoading = true;
    this.errorMessage = '';
    this.paymentErrors = '';

    const formValue = this.checkoutForm.value;

    try {
      // Create Stripe PaymentMethod (more reliable than tokens)
      console.log('🔐 Creating Stripe PaymentMethod...');
      
      // Small delay to ensure any pending Angular updates are complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const paymentMethodResult = await this.stripeService.createPaymentMethod({
        name: `${formValue.firstName} ${formValue.lastName}`,
        email: formValue.email,
        address_line1: formValue.line1,
        address_city: formValue.city,
        address_state: formValue.state,
        address_zip: formValue.zip,
        address_country: formValue.country,
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
      await this.processCheckoutWithPaymentMethod(paymentMethodResult.paymentMethod);
      
    } catch (error) {
      console.error('❌ Stripe payment processing error:', error);
      this.paymentErrors = 'Payment processing failed. Please try again.';
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
      currency: 'USD',
      billingTerm: this.term,
      paymentMethodId: paymentMethod.id
    };

    console.log('🔄 Processing checkout with Stripe PaymentMethod:', {
      ...checkoutRequest,
      paymentMethodId: '***' // Don't log the actual PaymentMethod ID
    });

    this.http.post<CheckoutResponse>(`${environment.apiUrl}/checkout`, checkoutRequest).subscribe(
      response => {
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
      error => {
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
      currency: 'USD',
      billingTerm: this.term
    };

    console.log('🔄 Processing checkout without payment:', checkoutRequest);

    this.http.post<CheckoutResponse>(`${environment.apiUrl}/checkout`, checkoutRequest).subscribe(
      response => {
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
      error => {
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
}
