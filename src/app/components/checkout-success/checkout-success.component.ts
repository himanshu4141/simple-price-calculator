import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LocalizationService } from '../../services/localization.service';
import { environment } from '../../../environments/environment';

interface SuccessOrderData {
  items: Array<{
    id: string;
    productName: string;
    planName: string;
    seats: number;
    term: string;
    price: number;
    isAddon?: boolean;
    description?: string;
  }>;
  customerInfo: {
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
  };
  pricing: {
    subtotal: number;
    tax: number;
    total: number;
    discountAmount: number;
    appliedCoupon: string;
  };
  confirmationNumber: string;
  orderDate: string;
  subscriptionId?: string;
  customerId?: string;
  portalSessionUrl?: string;
  portalSessionId?: string;
}

@Component({
  selector: 'app-checkout-success',
  templateUrl: './checkout-success.component.html',
  styleUrls: ['./checkout-success.component.scss']
})
export class CheckoutSuccessComponent implements OnInit {
  orderData: SuccessOrderData | null = null;
  showDetails = false;

  constructor(
    private router: Router,
    private localizationService: LocalizationService,
    private httpClient: HttpClient
  ) {
    // Get order data from router state
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state?.['orderData']) {
      this.orderData = navigation.extras.state['orderData'] as SuccessOrderData;
    }
  }

  ngOnInit(): void {
    // If no order data, redirect to home
    if (!this.orderData) {
      console.warn('⚠️ No order data found on success page, redirecting to home');
      this.router.navigate(['/']);
    } else {
      // Clear any stored checkout data
      sessionStorage.removeItem('checkoutOrderData');
      
      console.log('✅ Order success page loaded:', this.orderData);
    }
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  async goToPortal(): Promise<void> {
    console.log('🔗 goToPortal() called');
    console.log('📋 Customer ID:', this.orderData?.customerId);
    
    if (!this.orderData?.customerId) {
      console.warn('⚠️ No customer ID available for portal session');
      alert('Unable to access customer portal. Customer ID not found.');
      return;
    }

    try {
      console.log('🔄 Creating fresh portal session for customer:', this.orderData.customerId);
      
      // Create a fresh portal session each time (since they're single-use)
      const response = await this.httpClient.post<any>(`${environment.apiUrl}/create-portal-session`, {
        customerId: this.orderData.customerId
      }).toPromise();

      if (response.success && response.portalSessionUrl) {
        console.log('✅ Fresh portal session created:', response.portalSessionUrl);
        window.open(response.portalSessionUrl, '_blank');
      } else {
        console.error('❌ Failed to create portal session:', response);
        alert('Unable to access customer portal. Please try again or contact support.');
      }
    } catch (error) {
      console.error('❌ Error creating portal session:', error);
      
      // Fallback: try the stored URL if available
      if (this.orderData?.portalSessionUrl) {
        console.log('🔄 Falling back to stored portal URL:', this.orderData.portalSessionUrl);
        window.open(this.orderData.portalSessionUrl, '_blank');
      } else {
        alert('Unable to access customer portal. Please contact support.');
      }
    }
  }

  startNewOrder(): void {
    this.router.navigate(['/']);
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

  formatDate(dateString: string): string {
    const localization = this.localizationService.currentLocalization;
    const date = new Date(dateString);
    
    return new Intl.DateTimeFormat(localization.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  get customerName(): string {
    if (!this.orderData?.customerInfo) return '';
    return `${this.orderData.customerInfo.firstName} ${this.orderData.customerInfo.lastName}`.trim();
  }

  get formattedTotal(): string {
    return this.orderData ? this.formatPrice(this.orderData.pricing.total) : '';
  }

  get formattedOrderDate(): string {
    return this.orderData ? this.formatDate(this.orderData.orderDate) : '';
  }

  getItemDescription(item: any): string {
    if (item.description) return item.description;
    
    let description = `${item.seats} ${item.seats === 1 ? 'seat' : 'seats'}`;
    if (item.term) {
      description += ` • ${item.term}`;
    }
    
    return description;
  }

  getNextSteps(): string[] {
    const steps = [
      'Check your email for a confirmation message with your subscription details',
      'Download and install your software from the links provided in the email',
      'Use the "Manage Subscription" button below to access your customer portal',
      'In the portal, you can update billing info, change plans, and view invoices'
    ];

    return steps;
  }
}
