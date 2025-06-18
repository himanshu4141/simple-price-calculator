import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Stripe, StripeElements, StripeCardElement, loadStripe, StripeCardElementOptions } from '@stripe/stripe-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;
  private isStripeInitialized = false;
  private cardElementContainerId: string | null = null;

  // Debug state
  private lastError: any = null;

  constructor(private http: HttpClient) {}

  public getElementsInstance(): StripeElements | null {
    return this.elements;
  }

  public getCardElement(): StripeCardElement | null {
    return this.cardElement;
  }

  private getCardElementStyle(): StripeCardElementOptions {
    return {
      style: {
        base: {
          fontSize: '16px',
          color: '#424770',
          '::placeholder': {
            color: '#aab7c4',
          },
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
        invalid: {
          color: '#9e2146',
        },
      },
      hidePostalCode: true, // Hide postal code field since we collect it in billing address
    };
  }

  /**
   * Initialize Stripe with publishable key
   */
  async initializeStripe(): Promise<void> {
    if (this.isStripeInitialized && this.stripe) {
      console.log('Stripe already initialized.');
      return;
    }
    try {
      this.stripe = await loadStripe(environment.stripe.publishableKey);
      if (!this.stripe) {
        throw new Error('Stripe.js failed to load.');
      }
      this.isStripeInitialized = true;
      console.log('✅ Stripe.js loaded and initialized successfully.');
    } catch (error) {
      console.error('❌ Error loading Stripe.js:', error);
      this.lastError = error;
      this.isStripeInitialized = false;
      throw error;
    }
  }

  /**
   * Create Stripe Elements instance for card collection
   */
  createElements(): void {
    if (!this.stripe) {
      throw new Error('Stripe.js not loaded. Cannot create elements.');
    }
    if (this.elements) {
      console.warn('Stripe elements already created. Destroying and recreating.');
      this.destroyElements();
    }
    
    try {
      this.elements = this.stripe.elements();
      console.log('✅ Stripe Elements created');
    } catch (error) {
      console.error('❌ Error creating Stripe Elements:', error);
      this.lastError = error;
      throw error;
    }
  }

  /**
   * Create and mount Card Element
   */
  async createCardElement(containerId: string): Promise<StripeCardElement | null> {
    console.log('🔧 Creating card element...', {
      containerId,
      existingCardElement: !!this.cardElement,
      elementsCreated: !!this.elements
    });

    // Clean up any existing card element completely
    if (this.cardElement) {
      console.log('🧹 Destroying existing card element before creating new one');
      try {
        this.cardElement.unmount();
        this.cardElement.destroy();
      } catch (error) {
        console.warn('⚠️ Error destroying previous card element:', error);
      }
      this.cardElement = null;
    }

    if (!this.elements) {
      throw new Error('Elements not created. Call createElements() first.');
    }

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with ID "${containerId}" not found`);
    }

    // Clear container completely and ensure it's ready
    container.innerHTML = '';
    
    // Wait a moment for DOM to be fully ready
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Create and mount card element
      this.cardElement = this.elements.create('card', this.getCardElementStyle());
      this.cardElement.mount(`#${containerId}`);
      this.cardElementContainerId = containerId;

      console.log('✅ Card Element mounted in container:', containerId);

      // Add event listeners for real-time validation
      this.cardElement.on('change', (event) => {
        if (event.error) {
          console.warn('Card element validation error:', event.error);
        } else {
          console.log('Card element is valid');
        }
      });

      // Verify mount was successful by checking for Stripe's iframe
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stripeFrame = container.querySelector('iframe[name^="__privateStripeFrame"]');
      if (!stripeFrame) {
        throw new Error('Card Element mount verification failed - no Stripe iframe found');
      }
      
      console.log('✅ Card Element mount verified with iframe present');
      return this.cardElement;
    } catch (error) {
      console.error('❌ Error creating/mounting card element:', error);
      this.cardElement = null;
      this.cardElementContainerId = null;
      throw error;
    }
  }

  /**
   * Create payment method from card element (Modern approach - preferred over tokens)
   */
  async createPaymentMethod(billingDetails: {
    name: string;
    email: string;
    address_line1: string;
    address_city: string;
    address_state: string;
    address_zip: string;
    address_country: string;
  }): Promise<{ paymentMethod?: any; error?: any }> {
    console.log('🔧 Starting PaymentMethod creation...', {
      stripeInitialized: !!this.stripe,
      cardElementExists: !!this.cardElement,
      elementsExists: !!this.elements,
      containerId: this.cardElementContainerId
    });

    if (!this.stripe) {
      const error = { message: 'Stripe not initialized' };
      console.error('❌ Stripe not ready:', error);
      return { error };
    }

    // Ensure we have a fresh, valid card element before attempting PaymentMethod creation
    if (!this.cardElement || !this.cardElementContainerId) {
      const error = { message: 'Card Element not properly initialized' };
      console.error('❌ Card Element not ready:', error);
      return { error };
    }

    try {
      // Capture DOM reference and debug current state
      console.log('🔍 Pre-validation check:');
      this.debugElementState();
      
      const container = document.getElementById(this.cardElementContainerId);
      if (!container) {
        console.error('❌ Card element container missing from DOM');
        return { error: { message: 'Payment form container not found' } };
      }

      // Check if the element appears to be mounted by looking for Stripe's iframe
      const stripeFrame = container.querySelector('iframe[name^="__privateStripeFrame"]');
      if (!stripeFrame) {
        console.warn('⚠️ Stripe iframe not found, element may be unmounted');
        return { error: { message: 'Payment form not ready, please try again' } };
      }

      console.log('🔄 About to call stripe.createPaymentMethod...');
      
      // Final debug check right before Stripe call
      console.log('🔍 Final pre-call check:');
      this.debugElementState();
      
      // Create PaymentMethod - this is the critical call that's been failing
      const result = await this.stripe.createPaymentMethod({
        type: 'card',
        card: this.cardElement,
        billing_details: {
          name: billingDetails.name,
          email: billingDetails.email,
          address: {
            line1: billingDetails.address_line1,
            city: billingDetails.address_city,
            state: billingDetails.address_state,
            postal_code: billingDetails.address_zip,
            country: billingDetails.address_country,
          },
        },
      });

      if (result.error) {
        console.error('❌ Error creating PaymentMethod:', result.error);
        
        // If element unmounted error, try to recreate element and retry once
        if (result.error.message && 
            result.error.message.includes('Element')) {
          console.log('🔄 Element unmounted error detected, attempting to recreate element...');
          return await this.recreateElementAndRetry(billingDetails);
        }
        
        return { error: result.error };
      }

      if (result.paymentMethod) {
        console.log('✅ PaymentMethod created successfully:', result.paymentMethod.id);
        return { paymentMethod: result.paymentMethod };
      }

      return { error: { message: 'No PaymentMethod returned from Stripe' } };
    } catch (error) {
      console.error('❌ Exception during PaymentMethod creation:', error);
      return { error };
    }
  }

  /**
   * Recreate element and retry PaymentMethod creation (fallback for unmounted element)
   */
  private async recreateElementAndRetry(billingDetails: {
    name: string;
    email: string;
    address_line1: string;
    address_city: string;
    address_state: string;
    address_zip: string;
    address_country: string;
  }): Promise<{ paymentMethod?: any; error?: any }> {
    try {
      console.log('🔧 Recreating card element after unmount error...');
      
      if (!this.cardElementContainerId) {
        return { error: { message: 'No container ID available for element recreation' } };
      }

      // Recreate the card element
      await this.createCardElement(this.cardElementContainerId);
      
      // Wait a bit for the element to be fully mounted
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (!this.cardElement) {
        return { error: { message: 'Failed to recreate card element' } };
      }

      console.log('🔄 Retrying PaymentMethod creation with recreated element...');
      
      // Retry PaymentMethod creation
      const result = await this.stripe!.createPaymentMethod({
        type: 'card',
        card: this.cardElement,
        billing_details: {
          name: billingDetails.name,
          email: billingDetails.email,
          address: {
            line1: billingDetails.address_line1,
            city: billingDetails.address_city,
            state: billingDetails.address_state,
            postal_code: billingDetails.address_zip,
            country: billingDetails.address_country,
          },
        },
      });

      if (result.error) {
        console.error('❌ Retry also failed:', result.error);
        return { error: result.error };
      }

      if (result.paymentMethod) {
        console.log('✅ PaymentMethod created successfully on retry:', result.paymentMethod.id);
        return { paymentMethod: result.paymentMethod };
      }

      return { error: { message: 'No PaymentMethod returned on retry' } };
    } catch (error) {
      console.error('❌ Element recreation failed:', error);
      return { error };
    }
  }

  /**
   * Validate Card Element before submission
   */
  async validateCardElement(): Promise<{ complete: boolean; error?: any }> {
    if (!this.cardElement) {
      return { complete: false, error: { message: 'Card Element not initialized' } };
    }

    if (!this.elements) {
      return { complete: false, error: { message: 'Card elements not initialized' } };
    }

    try {
      // Check if element is still mounted by verifying container exists
      if (this.cardElementContainerId) {
        const container = document.getElementById(this.cardElementContainerId);
        if (!container) {
          return { complete: false, error: { message: 'Card Element container no longer exists' } };
        }
      }

      // For PaymentMethod approach, we don't need to check completion here
      // The createPaymentMethod call will validate the card data
      console.log('✅ Card Element validation passed');
      return { complete: true };
    } catch (error) {
      console.error('❌ Card Element validation failed:', error);
      return { complete: false, error };
    }
  }

  /**
   * Get card element validation status
   */
  async getCardElementStatus(): Promise<{ complete: boolean; error?: any }> {
    return this.validateCardElement();
  }

  /**
   * Destroy elements (cleanup)
   */
  destroyElements(): void {
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
    console.log('🧹 Stripe elements cleaned up');
  }

  /**
   * Force remount of Card Element (for troubleshooting)
   */
  forceRemountCardElement = async (): Promise<void> => {
    console.log("🔄 StripeService: Forcing remount of Card Element...");
    if (!this.stripe) {
      console.error("❌ Stripe.js not loaded. Cannot remount.");
      throw new Error("Stripe.js not loaded.");
    }

    if (!this.cardElementContainerId) {
      console.error("❌ Card element container ID not known. Cannot remount.");
      throw new Error("Card element container ID not known for remounting.");
    }

    this.destroyElements(); // Destroy existing elements first

    try {
      console.log("Re-creating Elements instance for remount");
      this.elements = this.stripe.elements();
      
      console.log("Re-creating Card Element for remount in container:", this.cardElementContainerId);
      this.cardElement = this.elements.create('card', this.getCardElementStyle());
      
      if (this.cardElement) {
        this.cardElement.mount(`#${this.cardElementContainerId}`);
        console.log("✅ Card Element remounted successfully in StripeService.");
      } else {
        throw new Error('Failed to create card element during remount.');
      }
    } catch (error) {
      console.error("❌ Error during forceRemountCardElement in StripeService:", error);
      this.lastError = error;
      throw error;
    }
  }

  /**
   * Check if Stripe is properly initialized
   */
  isReady(): boolean {
    return this.isStripeInitialized && this.stripe !== null;
  }

  /**
   * Check if Card Element is ready
   */
  isCardElementReady(): boolean {
    return !!this.cardElement;
  }

  isStripeJsLoaded(): boolean {
    return this.isStripeInitialized && this.stripe !== null;
  }

  /**
   * Get current state for debugging
   */
  getDebugState(): any {
    return {
      stripeLoaded: this.isStripeJsLoaded(),
      stripeInitialized: this.isStripeInitialized,
      elementsInitialized: !!this.elements,
      cardElementMounted: !!this.cardElement && !!this.cardElementContainerId,
      lastError: this.lastError
    };
  }

  /**
   * Check DOM state and Stripe iframe presence for debugging
   */
  checkElementDOMState(): { containerExists: boolean; containerVisible: boolean; containerHtml: string; stripeFrames: number } {
    const container = document.getElementById(this.cardElementContainerId || 'card-element');
    
    // Look for Stripe iframes more comprehensively
    const stripeFrameSelectors = [
      'iframe[name^="__privateStripeFrame"]',
      'iframe[src*="stripe"]',
      'iframe[title*="stripe"]',
      '.StripeElement iframe',
      '#card-element iframe'
    ];
    
    let stripeFrames = 0;
    for (const selector of stripeFrameSelectors) {
      const frames = document.querySelectorAll(selector);
      stripeFrames += frames.length;
      if (frames.length > 0) {
        console.log(`Found ${frames.length} Stripe frames with selector: ${selector}`);
      }
    }
    
    return {
      containerExists: container !== null,
      containerVisible: container ? container.offsetParent !== null : false,
      containerHtml: container ? container.innerHTML : '',
      stripeFrames: stripeFrames
    };
  }

  /**
   * Test element readiness with comprehensive debugging
   */
  async testElementReadiness(): Promise<{ ready: boolean; errors: string[]; domState: any; elementState: any }> {
    const errors: string[] = [];
    const domState = this.checkElementDOMState();
    const elementState = this.getDebugState();

    if (!this.stripe) errors.push('Stripe not initialized');
    if (!this.elements) errors.push('Elements not created');
    if (!this.cardElement) errors.push('Card element not mounted');
    if (!domState.containerExists) errors.push('Container element not found');
    if (!domState.containerVisible) errors.push('Container element not visible');
    if (domState.stripeFrames === 0) errors.push('No Stripe iframes detected');

    return {
      ready: errors.length === 0,
      errors,
      domState,
      elementState
    };
  }

  /**
   * Debug method to check element state
   */
  debugElementState(): void {
    console.log('🔍 Debugging Stripe element state:', {
      stripe: !!this.stripe,
      elements: !!this.elements,
      cardElement: !!this.cardElement,
      containerId: this.cardElementContainerId
    });

    if (this.cardElementContainerId) {
      // Try multiple ways to find the container
      const container = document.getElementById(this.cardElementContainerId);
      const containerByQuery = document.querySelector(`#${this.cardElementContainerId}`);
      const allElements = document.querySelectorAll(`[id="${this.cardElementContainerId}"]`);
      
      console.log('🔍 Container state:', {
        containerExists: !!container,
        containerByQueryExists: !!containerByQuery,
        allElementsCount: allElements.length,
        containerHTML: container ? container.innerHTML.substring(0, 200) : 'N/A'
      });

      if (container) {
        const frames = container.querySelectorAll('iframe');
        const stripeFrames = container.querySelectorAll('iframe[name^="__privateStripeFrame"]');
        console.log('🔍 iframes found:', {
          totalFrames: frames.length,
          stripeFrames: stripeFrames.length
        });
        
        frames.forEach((frame, index) => {
          console.log(`  Frame ${index}:`, frame.getAttribute('name'));
        });
      }
    }
  }
}
