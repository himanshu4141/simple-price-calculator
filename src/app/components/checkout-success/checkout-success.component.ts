import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LocalizationService } from '../../services/localization.service';

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
  chargebeePortalUrl?: string;
  invoiceUrl?: string;
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
    private localizationService: LocalizationService
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

  goToPortal(): void {
    if (this.orderData?.chargebeePortalUrl) {
      window.open(this.orderData.chargebeePortalUrl, '_blank');
    } else {
      console.warn('⚠️ No portal URL available');
    }
  }

  startNewOrder(): void {
    this.router.navigate(['/']);
  }

  downloadInvoice(): void {
    if (this.orderData?.invoiceUrl) {
      window.open(this.orderData.invoiceUrl, '_blank');
    } else {
      console.warn('⚠️ No invoice URL available');
      // Fallback: try to generate invoice download link
      this.generateInvoiceDownload();
    }
  }

  private generateInvoiceDownload(): void {
    // In a real implementation, this would call your backend to generate invoice
    console.log('📄 Generating invoice download for confirmation:', this.orderData?.confirmationNumber);
    
    // Simulate invoice generation
    if (this.orderData?.subscriptionId) {
      const invoiceUrl = `https://nitro-software.chargebeeportal.com/portal/v2/invoices/${this.orderData.subscriptionId}`;
      window.open(invoiceUrl, '_blank');
    }
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
      'Use your account credentials to access your new subscription',
      'Visit the customer portal to manage your subscription and billing'
    ];

    return steps;
  }
}
