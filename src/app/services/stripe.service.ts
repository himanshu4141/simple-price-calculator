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
  async createElements(clientSecret?: string): Promise<void> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized. Call initializeStripe() first.');
    }

    console.log('🔧 Creating Elements instance...', { hasClientSecret: !!clientSecret });

    try {
      const elementsOptions: any = {
        appearance: this.getNitroAppearance(),
        loader: 'auto',
        paymentMethodCreation: 'manual', // Required for manual payment method creation
        paymentMethodConfiguration: 'pmc_0RciuMRIbsQt5S7qO8K3eHRa' // Use your specific payment method configuration
      };

      if (clientSecret) {
        elementsOptions.clientSecret = clientSecret;
      } else {
        // Use setup mode for collecting payment methods without immediate payment
        elementsOptions.mode = 'setup';
        elementsOptions.currency = 'usd';
      }

      this.elements = this.stripe.elements(elementsOptions);
      console.log('✅ Elements instance created successfully with payment method configuration:', 'pmc_0RciuMRIbsQt5S7qO8K3eHRa');
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
  async createAddressElement(containerId: string, options?: StripeAddressElementOptions): Promise<StripeAddressElement | null> {
    if (!this.elements) {
      throw new Error('Elements not created. Call createElements() first.');
    }

    console.log('🔧 Creating Address Element...', { containerId });

    try {
      // Clean up existing address element
      if (this.addressElement) {
        this.addressElement.unmount();
        this.addressElement.destroy();
      }

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
        ...options
      };

      this.addressElement = this.elements.create('address', addressElementOptions);
      
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container with ID "${containerId}" not found`);
      }

      await this.addressElement.mount(`#${containerId}`);
      console.log('✅ Address Element mounted successfully');
      
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
    const data: StripeElementData = {};

    try {
      // Skip email collection - will be handled by form field
      // Collect address from Address Element
      if (this.addressElement) {
        const addressValue = await this.addressElement.getValue();
        if (addressValue.complete && addressValue.value) {
          data.address = addressValue.value;
          console.log('📍 Address data collected:', addressValue.value);
        } else {
          throw new Error('Complete billing address is required. Please fill in all required address fields.');
        }
      } else {
        throw new Error('Address Element is required but not initialized');
      }

      // For Payment Element, we need to use submit() to get the payment method
      if (this.paymentElement) {
        console.log('� Payment Element is available - payment method will be created during form submission');
        // Note: The actual payment method creation happens during form submission
        // We'll need to call this.elements.submit() and then stripe.confirmPayment()
      } else {
        throw new Error('Payment Element is required but not initialized');
      }

      console.log('�📊 Element data collected successfully:', data);
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
      // First collect element data (address only, email comes from parameter)
      const elementData = await this.collectElementData();
      
      // Add email to element data
      elementData.email = email.trim();

      // Submit the elements to validate them
      const {error: submitError} = await this.elements.submit();
      if (submitError) {
        console.error('❌ Elements validation failed:', submitError);
        throw new Error(submitError.message || 'Payment form validation failed');
      }

      // Create payment method from the Payment Element
      const {error: paymentMethodError, paymentMethod} = await this.stripe.createPaymentMethod({
        elements: this.elements,
        params: {
          billing_details: {
            email: elementData.email,
            name: elementData.address?.name,
            address: {
              line1: elementData.address?.address?.line1,
              line2: elementData.address?.address?.line2,
              city: elementData.address?.address?.city,
              state: elementData.address?.address?.state,
              postal_code: elementData.address?.address?.postal_code,
              country: elementData.address?.address?.country,
            }
          }
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
}
