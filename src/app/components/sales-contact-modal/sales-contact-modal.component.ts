import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LocalizationService } from '../../services/localization.service';

export interface SalesContactData {
  title?: string;
  message?: string;
  productFamily?: string;
  planName?: string;
  term?: string;
  source?: string;
  selectedProducts?: Array<{
    family: string;
    plan: string;
    seats: number;
    packages?: number;
    apiCalls?: number;
  }>;
  totalPrice?: number;
}

@Component({
  selector: 'app-sales-contact-modal',
  templateUrl: './sales-contact-modal.component.html',
  styleUrls: ['./sales-contact-modal.component.scss']
})
export class SalesContactModalComponent {
  constructor(
    public dialogRef: MatDialogRef<SalesContactModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SalesContactData,
    private readonly localizationService: LocalizationService
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  onContactEmail(): void {
    const subject = this.buildEmailSubject();
    const body = this.buildEmailBody();
    const mailtoLink = `mailto:sales@nitro.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
    this.dialogRef.close();
  }

  onContactPhone(): void {
    // Track contact attempt
    console.log('📞 User initiated phone contact for 3-year terms');
    this.dialogRef.close();
  }

  private buildEmailSubject(): string {
    if (this.data.productFamily && this.data.planName) {
      return `3-Year Subscription Inquiry - ${this.data.productFamily} ${this.data.planName}`;
    }
    if (this.data.selectedProducts && this.data.selectedProducts.length > 0) {
      const productNames = this.data.selectedProducts.map(p => `${p.family} ${p.plan}`).join(', ');
      return `3-Year Subscription Inquiry - ${productNames}`;
    }
    return '3-Year Subscription Inquiry - Nitro Products';
  }

  private buildEmailBody(): string {
    let body = 'Hello Nitro Sales Team,\n\n';
    body += 'I am interested in learning more about 3-year subscription plans for Nitro products.\n\n';
    
    // Handle single product from pricing page
    if (this.data.productFamily && this.data.planName) {
      body += `Product of Interest: ${this.data.productFamily} - ${this.data.planName}\n\n`;
    }
    
    // Handle multiple products from calculator
    if (this.data.selectedProducts && this.data.selectedProducts.length > 0) {
      body += 'Products of Interest:\n';
      this.data.selectedProducts.forEach(product => {
        body += `• ${product.family} - ${product.plan} (${product.seats} seats`;
        if (product.packages && product.packages > 0) {
          body += `, ${product.packages} packages`;
        }
        if (product.apiCalls && product.apiCalls > 0) {
          body += `, ${product.apiCalls} API calls`;
        }
        body += ')\n';
      });
      
      if (this.data.totalPrice) {
        body += `\nEstimated Annual Cost: $${this.data.totalPrice.toLocaleString()}\n`;
      }
      body += '\n';
    }
    
    body += 'I would like to discuss:\n';
    body += '• Custom pricing for 3-year commitments\n';
    body += '• Volume discounts\n';
    body += '• Dedicated account management\n';
    body += '• Priority support options\n\n';
    body += 'Please contact me to schedule a discussion.\n\n';
    body += 'Thank you!';
    
    return body;
  }

  /**
   * Format price using localization service
   */
  formatPrice(price: number): string {
    return this.localizationService.formatCurrency(price);
  }
}
