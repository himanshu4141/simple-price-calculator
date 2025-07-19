import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { LocalizationService } from '../../services/localization.service';
import { PricingService } from '../../services/pricing.service';
import { StripeService } from '../../services/stripe.service';
import { environment } from '../../../environments/environment';

interface ConfirmationItem {
  id: string;
  productName: string;
  planName: string;
  seats: number;
  term: string;
  price: number;
  isAddon?: boolean;
  description?: string;
}

interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

@Component({
  selector: 'app-checkout-confirmation',
  templateUrl: './checkout-confirmation.component.html',
  styleUrls: ['./checkout-confirmation.component.scss']
})
export class CheckoutConfirmationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Loading states
  isLoading = true;
  isProcessing = false;
  retryAttempts = 0;
  maxRetryAttempts = 2;
  
  // Order data
  items: ConfirmationItem[] = [];
  customerInfo: CustomerInfo | null = null;
  
  // Pricing
  subtotal = 0;
  tax = 0;
  total = 0;
  discountAmount = 0;
  appliedCoupon = '';
  
  // Error handling
  errorMessage = '';
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private localizationService: LocalizationService,
    private pricingService: PricingService,
    private stripeService: StripeService,
    private httpClient: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadOrderData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadOrderData(): void {
    // Load order data from session storage or route state
    const orderData = this.getOrderDataFromStorage();
    
    console.log('🔍 Debug: Raw order data from sessionStorage:', orderData);
    
    if (!orderData) {
      console.error('❌ No order data found, redirecting to cart');
      this.router.navigate(['/enhanced-cart']);
      return;
    }

    this.items = orderData.items || [];
    this.customerInfo = orderData.customerInfo;
    this.subtotal = orderData.subtotal || 0;
    this.tax = orderData.tax || 0;
    this.total = orderData.total || 0;
    this.discountAmount = orderData.discountAmount || 0;
    this.appliedCoupon = orderData.appliedCoupon || '';
    
    console.log('🔍 Debug: Assigned values - Tax:', this.tax, 'Subtotal:', this.subtotal, 'Total:', this.total);
    
    this.isLoading = false;
    
    console.log('✅ Order data loaded for confirmation:', {
      items: this.items,
      customerInfo: this.customerInfo,
      pricing: { subtotal: this.subtotal, tax: this.tax, total: this.total }
    });
  }

  private getOrderDataFromStorage(): any {
    try {
      return JSON.parse(sessionStorage.getItem('checkoutOrderData') || '{}');
    } catch (error) {
      console.error('❌ Error parsing order data from storage:', error);
      return null;
    }
  }

  goBack(): void {
    // Navigate back to enhanced cart with current order data preserved
    // Keep the checkout data in sessionStorage so cart can restore state
    this.router.navigate(['/enhanced-cart'], { 
      queryParams: { 
        step: 'cart',
        returnFromConfirmation: 'true'
      }
    });
  }

  async confirmOrder(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.errorMessage = '';
    
    try {
      console.log('🚀 Processing actual checkout...');
      
      // Create the order in the backend
      const checkoutResult = await this.processRealCheckout();
      
      // Reset retry attempts on success
      this.retryAttempts = 0;
      
      // Clear checkout data on successful order
      sessionStorage.removeItem('checkoutOrderData');
      sessionStorage.removeItem('checkoutPaymentData');
      
      // Log portal session data for debugging
      console.log('🔍 Checkout result portal data:');
      console.log('  - portalSessionUrl:', checkoutResult.portalSessionUrl);
      console.log('  - portalUrl (fallback):', checkoutResult.portalUrl);
      console.log('  - portalSessionId:', checkoutResult.portalSessionId);
      
      const orderData = {
        items: this.items,
        customerInfo: this.customerInfo,
        pricing: {
          subtotal: this.subtotal,
          tax: this.tax,
          total: this.total,
          discountAmount: this.discountAmount,
          appliedCoupon: this.appliedCoupon
        },
        confirmationNumber: checkoutResult.confirmationNumber,
        orderDate: new Date().toISOString(),
        subscriptionId: checkoutResult.subscriptionId,
        customerId: checkoutResult.customerId,
        portalSessionUrl: checkoutResult.portalSessionUrl || checkoutResult.portalUrl,
        portalSessionId: checkoutResult.portalSessionId
      };
      
      console.log('🔍 Order data being sent to success page:');
      console.log('  - portalSessionUrl:', orderData.portalSessionUrl);
      console.log('  - portalSessionId:', orderData.portalSessionId);
      
      // Navigate to success page with real order data
      this.router.navigate(['/checkout-success'], {
        state: { 
          orderData: orderData
        }
      });
      
    } catch (error) {
      console.error('❌ Error processing checkout:', error);
      
      // Provide specific error messages for common Stripe issues
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('return_url') && errorMessage.includes('paymentintent')) {
          this.errorMessage = 'The backend payment configuration needs to be updated. Please contact the development team to configure Stripe PaymentIntent settings to disable redirect-based payment methods.';
        } else if (errorMessage.includes('automatic_payment_methods') && errorMessage.includes('paymentintent')) {
          this.errorMessage = 'Payment method configuration issue. Please contact support as the payment system needs configuration updates.';
        } else if (errorMessage.includes('address') && errorMessage.includes('required')) {
          this.errorMessage = 'Please complete all required address fields and try again.';
        } else if (errorMessage.includes('payment form') && errorMessage.includes('validation')) {
          this.errorMessage = 'Please check your payment details and address information, then try again.';
        } else if (errorMessage.includes('mounted element')) {
          this.errorMessage = 'There was an issue with the payment form. Please refresh the page and try again.';
        } else if (errorMessage.includes('timeout')) {
          this.errorMessage = 'The payment form took too long to respond. Please check your internet connection and try again.';
        } else if (errorMessage.includes('currency') || errorMessage.includes('chargebee')) {
          this.errorMessage = 'There was an issue with pricing configuration. Please try again or contact support.';
        } else {
          this.errorMessage = error.message;
        }
      } else {
        this.errorMessage = 'Failed to process order. Please try again.';
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processRealCheckout(): Promise<any> {
    // Build checkout items exactly like the old checkout
    const checkoutItems: any[] = [];
    
    console.log(`💰 Building checkout items with currency: ${this.localizationService.currentCurrency}`);
    
    this.items.forEach(item => {
      const [productFamily, planName] = item.productName.split(' - ');
      
      // Add main product
      const itemPriceId = this.getChargebeeItemPriceId(planName.trim(), this.getBillingTermFromItems());
      checkoutItems.push({
        itemPriceId: itemPriceId,
        quantity: item.seats
      });
      
      console.log(`📦 Added main item: ${planName.trim()} -> ${itemPriceId} (qty: ${item.seats})`);
      
      // Parse and add add-ons from description
      if (item.description) {
        const packagesMatch = item.description.match(/(\d+) packages/);
        if (packagesMatch) {
          const packageCount = parseInt(packagesMatch[1], 10);
          if (packageCount > 0) {
            const packageAddonId = this.getPackageAddonItemPriceId(this.getBillingTermFromItems());
            checkoutItems.push({
              itemPriceId: packageAddonId,
              quantity: packageCount
            });
            console.log(`📦 Added package addon: ${packageAddonId} (qty: ${packageCount})`);
          }
        }
        
        const apiCallsMatch = item.description.match(/(\d+) API calls/);
        if (apiCallsMatch) {
          const apiCallCount = parseInt(apiCallsMatch[1], 10);
          if (apiCallCount > 0) {
            const apiAddonId = this.getApiCallAddonItemPriceId(this.getBillingTermFromItems());
            checkoutItems.push({
              itemPriceId: apiAddonId,
              quantity: apiCallCount
            });
            console.log(`📦 Added API call addon: ${apiAddonId} (qty: ${apiCallCount})`);
          }
        }
      }
    });

    // Get payment method from Stripe first
    const paymentMethodId = await this.getPaymentMethodFromStripe();

    // Build checkout request exactly like old checkout
    const checkoutRequest = {
      customer: {
        firstName: this.customerInfo?.firstName || '',
        lastName: this.customerInfo?.lastName || '',
        email: this.customerInfo?.email || '',
        company: this.customerInfo?.company || ''
      },
      billingAddress: {
        firstName: this.customerInfo?.firstName || '',
        lastName: this.customerInfo?.lastName || '',
        line1: this.customerInfo?.address?.line1 || '',
        city: this.customerInfo?.address?.city || '',
        state: this.customerInfo?.address?.state || '',
        postalCode: this.customerInfo?.address?.postalCode || '',
        country: this.customerInfo?.address?.country || 'US'
      },
      items: checkoutItems,
      currency: this.localizationService.currentCurrency,
      billingTerm: this.getBillingTermFromItems(),
      paymentMethodId: paymentMethodId
    };

    console.log('🚀 Processing checkout with real backend API (same as old checkout):', checkoutRequest);

    try {
      // Use the existing backend checkout endpoint (same as old checkout)
      const response = await this.httpClient.post<any>(`${environment.apiUrl}/checkout`, checkoutRequest).toPromise();

      console.log('🔍 Backend response received:', response);
      console.log('🔍 Portal session data in response:');
      console.log('  - response.portalSessionUrl:', response.portalSessionUrl);
      console.log('  - response.chargebeePortalUrl:', response.chargebeePortalUrl);
      console.log('  - response.portalUrl:', response.portalUrl);
      console.log('  - response.portalSessionId:', response.portalSessionId);
      console.log('🔍 Payment status data in response:');
      console.log('  - response.paymentStatus:', response.paymentStatus);
      console.log('  - response.paymentIntentClientSecret:', response.paymentIntentClientSecret);

      if (!response.success) {
        throw new Error(response.error || response.message || 'Checkout processing failed');
      }

      // Check if 3DS authentication is required
      if (response.paymentIntentClientSecret && response.paymentStatus === 'requires_confirmation') {
        console.log('🔐 3DS authentication required, triggering Stripe confirmation...');
        
        // Handle 3DS authentication
        const confirmedResult = await this.handle3DSAuthentication(response.paymentIntentClientSecret, paymentMethodId);
        
        if (!confirmedResult.success) {
          throw new Error(confirmedResult.error || '3DS authentication failed');
        }
        
        console.log('✅ 3DS authentication completed successfully');
        
        // Complete subscription creation after successful 3DS
        console.log('🔄 Completing subscription creation after 3DS...');
        const subscriptionResult = await this.completeSubscriptionAfter3DS(
          response.customerId, 
          response.paymentIntentId!, 
          checkoutItems
        );
        
        if (!subscriptionResult.success) {
          throw new Error(subscriptionResult.message || 'Failed to complete subscription after 3DS');
        }
        
        console.log('✅ Subscription creation completed after 3DS');
        
        // Update the response with subscription details
        Object.assign(response, subscriptionResult);
      }

      const result = {
        confirmationNumber: response.confirmationNumber || this.generateConfirmationNumber(),
        subscriptionId: response.subscriptionId,
        customerId: response.customerId,
        portalSessionUrl: response.portalSessionUrl || response.chargebeePortalUrl || response.portalUrl,
        portalSessionId: response.portalSessionId
      };
      
      console.log('🔍 Processed result being returned:');
      console.log('  - portalSessionUrl:', result.portalSessionUrl);
      console.log('  - portalSessionId:', result.portalSessionId);

      return result;
    } catch (error: any) {
      console.error('❌ Backend checkout failed:', error);
      throw new Error(error.error?.message || 'Failed to process payment. Please try again.');
    }
  }

  /**
   * Handle 3DS authentication for PaymentIntent
   */
  private async handle3DSAuthentication(paymentIntentClientSecret: string, paymentMethodId: string): Promise<{success: boolean, error?: string}> {
    try {
      console.log('🔐 Starting 3DS authentication process...');
      
      // Initialize Stripe if not already done
      if (!this.stripeService.getStripeInstance()) {
        await this.stripeService.initializeStripe();
      }
      
      const stripe = this.stripeService.getStripeInstance();
      if (!stripe) {
        throw new Error('Stripe not initialized');
      }
      
      // Confirm the PaymentIntent with 3DS handling
      console.log('🔐 Confirming PaymentIntent with 3DS...');
      const { paymentIntent, error } = await stripe.confirmPayment({
        clientSecret: paymentIntentClientSecret,
        confirmParams: {
          // We don't need to provide payment_method since it's already attached
          return_url: `${window.location.origin}/checkout-success`, // Fallback URL
        },
        redirect: 'if_required' // Only redirect if absolutely necessary
      });
      
      if (error) {
        console.error('❌ 3DS authentication failed:', error);
        return { success: false, error: error.message };
      }
      
      if (!paymentIntent) {
        return { success: false, error: 'PaymentIntent confirmation returned no result' };
      }
      
      console.log('✅ 3DS authentication completed, PaymentIntent status:', paymentIntent.status);
      
      // Check if the PaymentIntent is in a successful state
      if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture') {
        console.log('✅ PaymentIntent is ready for capture');
        return { success: true };
      } else if (paymentIntent.status === 'requires_action') {
        // This shouldn't happen with redirect: 'if_required', but handle it just in case
        console.error('❌ PaymentIntent still requires action after confirmation');
        return { success: false, error: 'Payment requires additional authentication that could not be completed' };
      } else {
        console.error('❌ Unexpected PaymentIntent status after confirmation:', paymentIntent.status);
        return { success: false, error: `Payment failed with status: ${paymentIntent.status}` };
      }
      
    } catch (error) {
      console.error('❌ Error in 3DS authentication:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during 3DS authentication' 
      };
    }
  }

  /**
   * Complete subscription creation after successful 3DS authentication
   */
  private async completeSubscriptionAfter3DS(customerId: string, paymentIntentId: string, checkoutItems: any[]): Promise<any> {
    console.log('🔄 Calling backend to complete subscription after 3DS...');
    
    const request = {
      customerId: customerId,
      paymentIntentId: paymentIntentId,
      items: checkoutItems,
      billingAddress: {
        firstName: this.customerInfo?.firstName || '',
        lastName: this.customerInfo?.lastName || '',
        line1: this.customerInfo?.address?.line1 || '',
        city: this.customerInfo?.address?.city || '',
        state: this.customerInfo?.address?.state || '',
        postalCode: this.customerInfo?.address?.postalCode || '',
        country: this.customerInfo?.address?.country || 'US'
      },
      currency: this.localizationService.currentCurrency
    };
    
    console.log('🚀 Sending complete-subscription-after-3ds request:', request);
    
    const response = await this.httpClient.post<any>(`${environment.apiUrl}/payment/complete-subscription-after-3ds`, request).toPromise();
    
    console.log('✅ Complete subscription after 3DS response:', response);
    
    return response;
  }

  // Chargebee item price ID mapping (same as old checkout)
  private getChargebeeItemPriceId(planName: string, term: string = '1year'): string {
    // Use the current localized currency instead of hardcoded USD
    const currency = this.localizationService.currentCurrency;
    const termSuffix = term === '3year' ? '3_YEAR' : '1_YEAR';
    
    // Map plan names to Chargebee item price IDs
    const planMappings: { [key: string]: string } = {
      'Nitro PDF Standard': `Nitro_PDF_STD-${currency}-${termSuffix}`,
      'Nitro PDF Plus': `Nitro_PDF_PLUS-${currency}-${termSuffix}`,
      'Nitro PDF Enterprise': `Nitro_PDF_ENT-${currency}-${termSuffix}`,
      'Nitro Sign Standard': `Nitro_SIGN_STD-${currency}-${termSuffix}`,
      'Nitro Sign Plus': `Nitro_SIGN_PLUS-${currency}-${termSuffix}`,
      'Nitro Sign Enterprise': `Nitro_SIGN_ENT-${currency}-${termSuffix}`,
      'PDF Standard': `Nitro_PDF_STD-${currency}-${termSuffix}`,
      'PDF Plus': `Nitro_PDF_PLUS-${currency}-${termSuffix}`,
      'PDF Enterprise': `Nitro_PDF_ENT-${currency}-${termSuffix}`,
      'Sign Standard': `Nitro_SIGN_STD-${currency}-${termSuffix}`,
      'Sign Plus': `Nitro_SIGN_PLUS-${currency}-${termSuffix}`,
      'Sign Enterprise': `Nitro_SIGN_ENT-${currency}-${termSuffix}`
    };

    const itemPriceId = planMappings[planName];
    if (!itemPriceId) {
      console.error(`No Chargebee item price ID found for plan: ${planName}`);
      return planName.toLowerCase().replace(/ /g, '-'); // fallback
    }
    
    console.log(`📍 Using Chargebee item price ID: ${itemPriceId} for plan: ${planName} (${currency})`);
    return itemPriceId;
  }

  private getPackageAddonItemPriceId(term: string = '1year'): string {
    // Use the current localized currency instead of hardcoded USD
    const currency = this.localizationService.currentCurrency;
    const termSuffix = term === '3year' ? '3-Year' : 'Yearly';
    const addonId = `sign-packages-${currency}-${termSuffix}`;
    console.log(`📍 Using package addon item price ID: ${addonId} (${currency})`);
    return addonId;
  }

  private getApiCallAddonItemPriceId(term: string = '1year'): string {
    // Use the current localized currency instead of hardcoded USD
    const currency = this.localizationService.currentCurrency;
    const termSuffix = term === '3year' ? '3-Year' : 'Yearly';
    const addonId = `sign-api-${currency}-${termSuffix}`;
    console.log(`📍 Using API call addon item price ID: ${addonId} (${currency})`);
    return addonId;
  }

  private getBillingTermFromItems(): string {
    // Extract billing term from first item
    return this.items.length > 0 && this.items[0].term.includes('3') ? '3year' : '1year';
  }

  private generateConfirmationNumber(): string {
    return 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  }

  // Formatting helpers
  formatPrice(amount: number): string {
    const currency = this.localizationService.currentCurrency;
    const localization = this.localizationService.currentLocalization;
    
    return new Intl.NumberFormat(localization.locale, {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  get formattedSubtotal(): string {
    return this.formatPrice(this.subtotal);
  }

  get formattedTax(): string {
    return this.formatPrice(this.tax);
  }

  get formattedTotal(): string {
    return this.formatPrice(this.total);
  }

  get formattedDiscount(): string {
    return this.formatPrice(this.discountAmount);
  }

  get customerName(): string {
    if (!this.customerInfo) return '';
    return `${this.customerInfo.firstName} ${this.customerInfo.lastName}`.trim();
  }

  get customerAddress(): string {
    if (!this.customerInfo?.address) return '';
    
    const addr = this.customerInfo.address;
    const addressParts = [
      addr.line1,
      addr.line2,
      addr.city,
      addr.state,
      addr.postalCode,
      addr.country
    ].filter(Boolean);
    
    return addressParts.join(', ');
  }

  getItemDescription(item: ConfirmationItem): string {
    if (item.description) return item.description;
    
    let description = `${item.seats} ${item.seats === 1 ? 'seat' : 'seats'}`;
    if (item.term) {
      description += ` • ${item.term}`;
    }
    
    return description;
  }

  private async getPaymentMethodFromStripe(): Promise<string> {
    try {
      console.log('💳 Creating payment method using customer info (Elements not available on confirmation page)...');
      
      // Check if we have stored payment method data from the cart page
      const storedPaymentData = this.getStoredPaymentData();
      if (storedPaymentData?.paymentMethodId) {
        console.log('✅ Using stored payment method ID:', storedPaymentData.paymentMethodId);
        return storedPaymentData.paymentMethodId;
      }

      console.log('❌ No stored payment method found!');
      throw new Error('Payment method not found. Please return to the cart page and complete payment details again.');
      
    } catch (error) {
      console.error('❌ Error in getPaymentMethodFromStripe:', error);
      throw new Error(`Failed to process payment method: ${error instanceof Error ? error.message : 'Unknown error'}. Please verify your payment information and try again.`);
    }
  }

  private getStoredPaymentData(): any {
    try {
      const paymentData = sessionStorage.getItem('checkoutPaymentData');
      return paymentData ? JSON.parse(paymentData) : null;
    } catch (error) {
      console.error('❌ Error parsing stored payment data:', error);
      return null;
    }
  }

  retryCheckout(): void {
    if (this.retryAttempts >= this.maxRetryAttempts) {
      return;
    }
    
    this.retryAttempts++;
    this.errorMessage = '';
    this.confirmOrder();
  }
}
