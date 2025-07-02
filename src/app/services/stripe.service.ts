import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Stripe,
  StripeElements,
  StripeCardElement,
  StripePaymentElement,
  StripeAddressElement,
  loadStripe,
  StripeCardElementOptions,
  StripePaymentElementOptions,
  StripeAddressElementOptions
} from '@stripe/stripe-js';

import { environment } from '../../environments/environment';

interface StripeElementsState {
  readonly isInitialized: boolean;
  readonly hasElements: boolean;
  readonly hasPaymentElement: boolean;
  readonly hasAddressElement: boolean;
}

interface StripeElementData {
  email?: string;
  address?: any;
  paymentMethod?: any;
}

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  
  // Legacy Card Element (for backwards compatibility)
  private cardElement: StripeCardElement | null = null;
  private cardElementContainerId: string | null = null;
  
  // New Elements
  private paymentElement: StripePaymentElement | null = null;
  private addressElement: StripeAddressElement | null = null;
  
  private isStripeInitializedState = false;

  constructor(private readonly httpClient: HttpClient) {}

  // Getters for compatibility
  public getElementsInstance(): StripeElements | null {
    return this.elements;
  }

  public getCardElement(): StripeCardElement | null {
    return this.cardElement;
  }

  // New Element Getters
  public getPaymentElement(): StripePaymentElement | null {
    return this.paymentElement;
  }

  public getAddressElement(): StripeAddressElement | null {
    return this.addressElement;
  }

  public get isStripeInitialized(): boolean {
    return this.isStripeInitializedState;
  }

  public getElementsState(): StripeElementsState {
    return {
      isInitialized: this.isStripeInitializedState,
      hasElements: !!this.elements,
      hasPaymentElement: !!this.paymentElement,
      hasAddressElement: !!this.addressElement
    };
  }

  /**
   * Get Nitro-themed appearance configuration for all Elements
   */
  private getNitroAppearance() {
    return {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#e97924', // Nitro orange
        colorBackground: '#ffffff',
        colorText: '#30313d', // Nitro black
        colorDanger: '#df1b41',
        fontFamily: 'DM Sans, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
        colorPrimaryText: '#30313d',
        colorSuccessText: '#065f46',
        colorDangerText: '#df1b41'
      },
      rules: {
        '.Input': {
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '16px',
          transition: 'border-color 0.2s ease'
        },
        '.Input:focus': {
          borderColor: '#e97924',
          outline: 'none',
          boxShadow: '0 0 0 3px rgba(233, 121, 36, 0.1)'
        },
        '.Label': {
          fontSize: '14px',
          fontWeight: '500',
          color: '#374151',
          marginBottom: '6px'
        },
        '.Error': {
          color: '#df1b41',
          fontSize: '14px'
        }
      }
    };
  }

  private getCardElementStyle(): StripeCardElementOptions {
    return {
      style: {
        base: {
          fontSize: '16px',
          color: '#30313d',
          fontFamily: 'DM Sans, sans-serif',
          '::placeholder': {
            color: '#9ca3af',
          },
        },
        invalid: {
          color: '#df1b41',
        },
      },
    };
  }

  /**
   * Initialize Stripe.js
   */
  async initializeStripe(): Promise<void> {
    if (this.isStripeInitializedState && this.stripe) {
      console.log('✅ Stripe already initialized');
      return;
    }

    console.log('🔧 Initializing Stripe.js...');
    try {
      this.stripe = await loadStripe(environment.stripe.publishableKey);
      if (!this.stripe) {
        throw new Error('Failed to load Stripe.js');
      }
      this.isStripeInitializedState = true;
      console.log('✅ Stripe.js initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Stripe:', error);
      throw error;
    }
  }

  /**
   * Create Elements instance with client secret or setup mode
   */
  async createElements(clientSecret?: string, localizationOptions?: {
    locale?: string;
    currency?: string;
    country?: string;
  }): Promise<void> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized. Call initializeStripe() first.');
    }

    console.log('🔧 Creating Elements instance...', { 
      hasClientSecret: !!clientSecret,
      localization: localizationOptions 
    });

    try {
      const elementsOptions: any = {
        appearance: this.getNitroAppearance(),
        loader: 'auto',
        paymentMethodCreation: 'manual', // Required for manual payment method creation
        paymentMethodConfiguration: 'pmc_0RciuMRIbsQt5S7qO8K3eHRa' // Use your specific payment method configuration
      };

      // Add localization options
      if (localizationOptions) {
        if (localizationOptions.locale) {
          elementsOptions.locale = localizationOptions.locale;
        }
        
        if (localizationOptions.currency) {
          elementsOptions.currency = localizationOptions.currency.toLowerCase();
        }
      }

      if (clientSecret) {
        elementsOptions.clientSecret = clientSecret;
      } else {
        // Use setup mode for collecting payment methods without immediate payment
        elementsOptions.mode = 'setup';
        elementsOptions.currency = localizationOptions?.currency?.toLowerCase() || 'usd';
      }

      this.elements = this.stripe.elements(elementsOptions);
      console.log('✅ Elements instance created successfully with localization:', {
        locale: elementsOptions.locale,
        currency: elementsOptions.currency,
        paymentMethodConfig: 'pmc_0RciuMRIbsQt5S7qO8K3eHRa'
      });
    } catch (error) {
      console.error('❌ Error creating Elements:', error);
      throw error;
    }
  }

  /**
   * Create and mount Payment Element
   */
  async createPaymentElement(containerId: string, options?: StripePaymentElementOptions): Promise<StripePaymentElement | null> {
    if (!this.elements) {
      throw new Error('Elements not created. Call createElements() first.');
    }

    console.log('🔧 Creating Payment Element...', { containerId });

    try {
      // Clean up existing payment element
      if (this.paymentElement) {
        this.paymentElement.unmount();
        this.paymentElement.destroy();
      }

      const paymentElementOptions: StripePaymentElementOptions = {
        layout: {
          type: 'accordion',
          defaultCollapsed: false,
          radios: false,
          spacedAccordionItems: true
        },
        defaultValues: options?.defaultValues || {},
        ...options
      };

      this.paymentElement = this.elements.create('payment', paymentElementOptions);
      
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container with ID "${containerId}" not found`);
      }

      await this.paymentElement.mount(`#${containerId}`);
      console.log('✅ Payment Element mounted successfully with payment method configuration');
      
      return this.paymentElement;
    } catch (error) {
      console.error('❌ Error creating Payment Element:', error);
      throw error;
    }
  }

  /**
   * Create and mount Address Element
   */
  async createAddressElement(
    containerId: string, 
    options?: StripeAddressElementOptions,
    localizationDefaults?: {
      country?: string;
      locale?: string;
    }
  ): Promise<StripeAddressElement | null> {
    if (!this.elements) {
      throw new Error('Elements not created. Call createElements() first.');
    }

    console.log('🔧 Creating Address Element...', { 
      containerId, 
      localizationDefaults 
    });

    try {
      // Clean up existing address element
      if (this.addressElement) {
        this.addressElement.unmount();
        this.addressElement.destroy();
      }

      // Determine default country based on localization
      const defaultCountry = localizationDefaults?.country || 
                            this.getCountryFromLocale(localizationDefaults?.locale) || 
                            'US';

      const addressElementOptions: StripeAddressElementOptions = {
        mode: 'billing',
        allowedCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI'],
        blockPoBox: true,
        autocomplete: {
          mode: 'automatic'
        },
        fields: {
          phone: 'auto'
        },
        defaultValues: {
          name: '',
          address: {
            country: defaultCountry
          },
          ...options?.defaultValues
        },
        ...options
      };

      this.addressElement = this.elements.create('address', addressElementOptions);
      
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container with ID "${containerId}" not found`);
      }

      await this.addressElement.mount(`#${containerId}`);
      console.log('✅ Address Element mounted successfully with default country:', defaultCountry);
      
      return this.addressElement;
    } catch (error) {
      console.error('❌ Error creating Address Element:', error);
      throw error;
    }
  }

  /**
   * Collect data from all Elements
   */
  async collectElementData(): Promise<StripeElementData> {
    console.log('📍 Starting collectElementData...');
    const data: StripeElementData = {};

    try {
      // Skip email collection - will be handled by form field
      // Collect address from Address Element
      console.log('📍 Checking Address Element availability:', !!this.addressElement);
      if (this.addressElement) {
        console.log('📍 Getting address value with timeout protection...');
        
        try {
          // Add timeout to prevent hanging
          const addressValuePromise = this.addressElement.getValue();
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Address element getValue() timed out after 5 seconds')), 5000);
          });
          
          const addressValue = await Promise.race([addressValuePromise, timeoutPromise]) as any;
          console.log('📍 Address value response:', addressValue);
          
          if (addressValue.complete && addressValue.value) {
            data.address = addressValue.value;
            console.log('📍 Address data collected:', addressValue.value);
          } else {
            console.warn('⚠️ Address element incomplete:', { complete: addressValue.complete, value: addressValue.value });
            
            // Check if we have minimal required data
            if (addressValue.value && addressValue.value.address) {
              console.log('📍 Using partially complete address data');
              data.address = addressValue.value;
            } else if (addressValue.value) {
              // Sometimes the address structure is different
              console.log('📍 Using available address data with different structure');
              data.address = addressValue;
            } else {
              throw new Error('Complete billing address is required. Please fill in all required address fields.');
            }
          }
        } catch (timeoutError) {
          console.error('❌ Address element getValue() failed:', timeoutError);
          
          // When address element fails, we cannot proceed with Stripe Elements
          // because the elements will be in an invalid state
          throw new Error('Address validation failed. Please ensure all address fields are completed correctly and try again.');
        }
      } else {
        console.warn('⚠️ Address Element not available');
        throw new Error('Address Element is required but not initialized');
      }

      // For Payment Element, we need to use submit() to get the payment method
      console.log('📍 Checking Payment Element availability:', !!this.paymentElement);
      if (this.paymentElement) {
        console.log('💳 Payment Element is available - payment method will be created during form submission');
        // Note: The actual payment method creation happens during form submission
        // We'll need to call this.elements.submit() and then stripe.confirmPayment()
      } else {
        throw new Error('Payment Element is required but not initialized');
      }

      console.log('✅ Element data collected successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error collecting element data:', error);
      throw error;
    }
  }

  /**
   * Legacy Card Element methods for backwards compatibility
   */
  async createCardElement(containerId: string): Promise<StripeCardElement | null> {
    console.log('🔧 Creating legacy card element...', { containerId });

    await this.cleanupExistingCardElement();
    
    if (!this.elements) {
      await this.createElements();
    }

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with ID "${containerId}" not found`);
    }

    try {
      this.cardElement = this.elements!.create('card', this.getCardElementStyle());
      await this.cardElement.mount(`#${containerId}`);
      this.cardElementContainerId = containerId;
      console.log('✅ Legacy Card Element mounted successfully');
      return this.cardElement;
    } catch (error) {
      console.error('❌ Error creating card element:', error);
      throw error;
    }
  }

  private async cleanupExistingCardElement(): Promise<void> {
    if (this.cardElement) {
      console.log('🧹 Destroying existing card element');
      try {
        this.cardElement.unmount();
        this.cardElement.destroy();
      } catch (error) {
        console.warn('⚠️ Error destroying previous card element:', error);
      }
      this.cardElement = null;
    }
  }

  async createPaymentMethod(billingDetails?: {
    name: string;
    email: string;
    address_line1: string;
    address_city: string;
    address_state: string;
    address_zip: string;
    address_country: string;
  }): Promise<{ paymentMethod?: any; error?: any }> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    if (this.paymentElement) {
      // New Payment Element flow
      return await this.stripe.createPaymentMethod({
        elements: this.elements!,
      });
    } else if (this.cardElement) {
      // Legacy Card Element flow with billing details
      const createPaymentMethodOptions: any = {
        type: 'card',
        card: this.cardElement,
      };

      if (billingDetails) {
        createPaymentMethodOptions.billing_details = {
          name: billingDetails.name,
          email: billingDetails.email,
          address: {
            line1: billingDetails.address_line1,
            city: billingDetails.address_city,
            state: billingDetails.address_state,
            postal_code: billingDetails.address_zip,
            country: billingDetails.address_country,
          },
        };
      }

      return await this.stripe.createPaymentMethod(createPaymentMethodOptions);
    } else {
      throw new Error('No payment element available');
    }
  }

  async confirmPayment(clientSecret: string, redirectUrl?: string): Promise<any> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    if (this.paymentElement) {
      // New Payment Element flow
      return await this.stripe.confirmPayment({
        elements: this.elements!,
        clientSecret,
        confirmParams: {
          return_url: redirectUrl || window.location.href,
        },
      });
    } else if (this.cardElement) {
      // Legacy Card Element flow
      const { paymentMethod, error } = await this.createPaymentMethod();
      if (error) {
        return { error };
      }

      return await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethod.id
      });
    } else {
      throw new Error('No payment element available');
    }
  }

  /**
   * Destroy all elements (cleanup)
   */
  destroyElements(): void {
    console.log('🧹 Destroying all Stripe elements...');

    if (this.paymentElement) {
      try {
        this.paymentElement.unmount();
        this.paymentElement.destroy();
      } catch (error) {
        console.warn('⚠️ Error destroying payment element:', error);
      }
      this.paymentElement = null;
    }

    if (this.addressElement) {
      try {
        this.addressElement.unmount();
        this.addressElement.destroy();
      } catch (error) {
        console.warn('⚠️ Error destroying address element:', error);
      }
      this.addressElement = null;
    }

    if (this.cardElement) {
      try {
        this.cardElement.unmount();
        this.cardElement.destroy();
      } catch (error) {
        console.warn('⚠️ Error destroying card element:', error);
      }
      this.cardElement = null;
    }

    if (this.elements) {
      this.elements = null;
    }
    
    console.log('✅ All Stripe elements cleaned up');
  }

  /**
   * Utility methods
   */
  isReady(): boolean {
    return this.isStripeInitialized && this.stripe !== null;
  }

  isCardElementReady(): boolean {
    return !!this.cardElement;
  }

  isPaymentElementReady(): boolean {
    return !!this.paymentElement;
  }

  isStripeJsLoaded(): boolean {
    return this.isStripeInitialized && this.stripe !== null;
  }

  // Legacy methods for backwards compatibility
  async getCardElementStatus(): Promise<{ complete: boolean; error?: any }> {
    if (!this.cardElement) {
      return { complete: false, error: 'Card element not available' };
    }
    
    // This is a simplified implementation
    return { complete: true };
  }

  forceRemountCardElement = async (): Promise<void> => {
    if (!this.cardElementContainerId) {
      throw new Error("Card element container ID not known for remounting.");
    }

    await this.cleanupExistingCardElement();
    await this.createCardElement(this.cardElementContainerId);
  }

  /**
   * Submit the elements form and create a payment method
   * This is the proper flow for Payment Element
   */
  async submitAndCreatePaymentMethod(email: string): Promise<{paymentMethodId: string, elementData: StripeElementData}> {
    if (!this.stripe || !this.elements) {
      throw new Error('Stripe is not initialized');
    }

    // Validate email
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }

    console.log('🔧 Submitting elements and creating payment method...');

    try {
      // First, check if elements are in a good state
      console.log('📍 Step 0: Checking elements readiness...');
      const readinessCheck = await this.checkElementsReadiness();
      if (!readinessCheck.ready) {
        const issuesList = readinessCheck.issues.join('; ');
        throw new Error(`Payment form is not ready: ${issuesList}`);
      }
      console.log('✅ Elements are ready for processing');

      // Collect element data (address only, email comes from parameter)
      console.log('📍 Step 1: Collecting element data...');
      let elementData: StripeElementData;
      
      try {
        elementData = await this.collectElementData();
        console.log('✅ Element data collected:', elementData);
      } catch (elementError: any) {
        console.error('❌ Element data collection failed:', elementError);
        
        // If element data collection fails, it means the Stripe Elements are in an invalid state
        // This usually happens when the address element times out or fails validation
        throw new Error(`Payment form validation failed: ${elementError?.message || 'Unknown error'}`);
      }
      
      // Add email to element data
      elementData.email = email.trim();

      // Submit the elements to validate them
      console.log('📍 Step 2: Submitting elements for validation...');
      const {error: submitError} = await this.elements.submit();
      if (submitError) {
        console.error('❌ Elements validation failed:', submitError);
        throw new Error(submitError.message || 'Payment form validation failed');
      }
      console.log('✅ Elements submitted successfully');

      // Create payment method from the Payment Element
      console.log('📍 Step 3: Creating payment method...');
      
      // Build billing details, handling case where address might be null
      const billingDetails: any = {
        email: elementData.email
      };
      
      // Add address data if available from Stripe Elements
      if (elementData.address) {
        billingDetails.name = elementData.address.name;
        billingDetails.address = {
          line1: elementData.address.address?.line1 || elementData.address.line1,
          line2: elementData.address.address?.line2 || elementData.address.line2,
          city: elementData.address.address?.city || elementData.address.city,
          state: elementData.address.address?.state || elementData.address.state,
          postal_code: elementData.address.address?.postal_code || elementData.address.postal_code,
          country: elementData.address.address?.country || elementData.address.country,
        };
      }
      
      const {error: paymentMethodError, paymentMethod} = await this.stripe.createPaymentMethod({
        elements: this.elements,
        params: {
          billing_details: billingDetails
        }
      });

      if (paymentMethodError) {
        console.error('❌ Payment method creation failed:', paymentMethodError);
        throw new Error(paymentMethodError.message || 'Failed to create payment method');
      }

      if (!paymentMethod) {
        throw new Error('Payment method creation failed - no payment method returned');
      }

      console.log('✅ Payment method created successfully:', paymentMethod.id);
      
      return {
        paymentMethodId: paymentMethod.id,
        elementData: elementData
      };

    } catch (error) {
      console.error('❌ Error in submitAndCreatePaymentMethod:', error);
      throw error;
    }
  }

  /**
   * Helper method to map locale to country code
   */
  private getCountryFromLocale(locale?: string): string | null {
    if (!locale) return null;
    
    const localeToCountryMap: Record<string, string> = {
      'en-US': 'US',
      'en-CA': 'CA', 
      'en-GB': 'GB',
      'en-AU': 'AU',
      'de-DE': 'DE',
      'fr-FR': 'FR',
      'es-ES': 'ES',
      'it-IT': 'IT',
      'nl-NL': 'NL',
      'sv-SE': 'SE',
      'no-NO': 'NO',
      'da-DK': 'DK',
      'fi-FI': 'FI'
    };
    
    return localeToCountryMap[locale] || null;
  }

  /**
   * Get value from Address Element
   */
  async getAddressElementValue(): Promise<any> {
    if (!this.addressElement) {
      throw new Error('Address Element not initialized');
    }

    try {
      const addressValue = await this.addressElement.getValue();
      if (addressValue.complete && addressValue.value) {
        console.log('📍 Address Element value retrieved:', addressValue.value);
        return addressValue.value;
      } else {
        console.warn('⚠️ Address Element is incomplete');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting Address Element value:', error);
      throw error;
    }
  }

  /**
   * Validate that address element is in a valid state for payment processing
   */
  async validateAddressElementState(): Promise<boolean> {
    console.log('🔍 Validating address element state...');
    
    if (!this.addressElement) {
      console.warn('⚠️ Address element not available');
      return false;
    }

    try {
      // Try to get the current value with a short timeout
      const addressValuePromise = this.addressElement.getValue();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Address validation timeout')), 3000);
      });
      
      const addressValue = await Promise.race([addressValuePromise, timeoutPromise]) as any;
      
      // Check if we have at least some address data
      const hasMinimalData = addressValue && (
        addressValue.complete || 
        (addressValue.value && (
          addressValue.value.address || 
          addressValue.value.line1 || 
          addressValue.value.city
        ))
      );
      
      console.log('📍 Address element validation result:', {
        hasValue: !!addressValue,
        complete: addressValue?.complete,
        hasMinimalData,
        value: addressValue?.value
      });
      
      return hasMinimalData;
    } catch (error) {
      console.error('❌ Address element validation failed:', error);
      return false;
    }
  }

  /**
   * Check if Stripe Elements are ready for payment processing
   */
  async checkElementsReadiness(): Promise<{ready: boolean, issues: string[]}> {
    console.log('🔍 Checking elements readiness...');
    const issues: string[] = [];
    
    if (!this.stripe) {
      issues.push('Stripe not initialized');
    }
    
    if (!this.elements) {
      issues.push('Stripe Elements not created');
    }
    
    if (!this.paymentElement) {
      issues.push('Payment Element not available');
    }
    
    if (!this.addressElement) {
      issues.push('Address Element not available');
    } else {
      // Check address element state
      const addressValid = await this.validateAddressElementState();
      if (!addressValid) {
        issues.push('Address Element is not in a valid state - please complete all required address fields');
      }
    }
    
    const ready = issues.length === 0;
    console.log('📍 Elements readiness check:', { ready, issues });
    
    return { ready, issues };
  }

  public getStripeInstance(): Stripe | null {
    return this.stripe;
  }

  /**
   * Refresh the address element if it's in a bad state
   */
  async refreshAddressElement(containerId: string, options?: StripeAddressElementOptions, localizationDefaults?: { country?: string; locale?: string; }): Promise<void> {
    console.log('🔄 Refreshing address element...');
    
    try {
      // Unmount and destroy existing element
      if (this.addressElement) {
        console.log('📍 Cleaning up existing address element...');
        try {
          this.addressElement.unmount();
          this.addressElement.destroy();
        } catch (cleanupError) {
          console.warn('⚠️ Error during address element cleanup:', cleanupError);
        }
        this.addressElement = null;
      }
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Recreate the address element
      console.log('📍 Recreating address element...');
      await this.createAddressElement(containerId, options, localizationDefaults);
      
      console.log('✅ Address element refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing address element:', error);
      throw error;
    }
  }
}
