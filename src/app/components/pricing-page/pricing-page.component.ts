// Angular core and common modules
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

// RxJS modules
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// Core application imports
import { PricingService, ProductFamily, BillingTerm, BILLING_TERMS } from '../../services/pricing.service';

@Component({
  selector: 'app-pricing-page',
  templateUrl: './pricing-page.component.html',
  styleUrls: ['./pricing-page.component.scss']
})
export class PricingPageComponent implements OnInit {
  // Service injection using traditional constructor injection
  constructor(
    private readonly pricingService: PricingService,
    private readonly router: Router
  ) {}

  // Component state properties
  public productFamilies: readonly ProductFamily[] = [];
  public selectedTerm: BillingTerm = BILLING_TERMS.ONE_YEAR;
  public isLoadingPricingData: boolean = false;
  public errorMessage: string | null = null;

  // Computed property using getter
  public get isThreeYearSelected(): boolean {
    return this.selectedTerm === BILLING_TERMS.THREE_YEAR;
  }

  // Constants for template
  public readonly BILLING_TERMS = BILLING_TERMS;

  ngOnInit(): void {
    this.fetchPricingData();
  }

  private fetchPricingData(): void {
    this.isLoadingPricingData = true;
    this.errorMessage = null;

    this.pricingService.fetchPricingData('USD')
      .pipe(
        catchError(error => {
          console.error('Error fetching pricing data:', error);
          this.errorMessage = 'Failed to load pricing data. Please try again.';
          return of(null);
        })
      )
      .subscribe(response => {
        this.isLoadingPricingData = false;
        
        if (response?.productFamilies) {
          this.productFamilies = Object.freeze([...response.productFamilies]);
        } else {
          this.productFamilies = [];
          if (!this.errorMessage) {
            this.errorMessage = 'No pricing data available.';
          }
        }
      });
  }

  public selectPlan(productFamily: ProductFamily, planName: string): void {
    const navigationParams = Object.freeze({
      product: productFamily.name,
      plan: planName,
      term: this.selectedTerm
    });

    this.router.navigate(['/cart'], { queryParams: navigationParams });
  }

  public toggleTerm(): void {
    const newTerm = this.selectedTerm === BILLING_TERMS.ONE_YEAR 
      ? BILLING_TERMS.THREE_YEAR 
      : BILLING_TERMS.ONE_YEAR;
    
    this.selectedTerm = newTerm;
  }

  getPlanPrice(plan: any, seats: number = 1): number {
    const pricing = this.selectedTerm === '1year' ? plan.oneYearPricing : plan.threeYearPricing;
    const applicableTier = [...pricing]
      .sort((a, b) => b.minSeats - a.minSeats)
      .find(tier => seats >= tier.minSeats);
    return applicableTier ? applicableTier.price : 0;
  }

  // Team size suggestions based on plan names
  getTeamSuggestion(planName: string): string {
    const suggestions: { [key: string]: string } = {
      'Essential': 'Ideal for small teams (1-5 users)',
      'Pro': 'Perfect for growing teams (5-25 users)', 
      'Business': 'Best for larger teams (25+ users)',
      'Enterprise': 'Designed for large organizations (100+ users)',
      'Starter': 'Great for individuals and small teams (1-10 users)',
      'Professional': 'Perfect for mid-size teams (10-50 users)',
      'Premium': 'Best for large teams (50+ users)'
    };
    return suggestions[planName] || '';
  }

  // Convert technical terminology to user-friendly language
  getFeatureDisplayText(feature: string): string {
    const featureMap: { [key: string]: string } = {
      'OCR technology': 'Text Recognition & Editing',
      'Advanced OCR': 'Advanced Text Recognition & Editing', 
      'API access': 'System Integration & API Access',
      'SSO integration': 'Single Sign-On (SSO) Integration',
      'Advanced analytics': 'Detailed Usage Analytics & Reporting'
    };
    return featureMap[feature] || feature;
  }

  // Check if a feature is technical and needs a tooltip
  isFeatureTechnical(feature: string): boolean {
    const technicalFeatures = ['OCR technology', 'Advanced OCR', 'API access', 'SSO integration'];
    return technicalFeatures.includes(feature);
  }

  // Get tooltip text for technical features
  getFeatureTooltip(feature: string): string {
    const tooltips: { [key: string]: string } = {
      'OCR technology': 'Optical Character Recognition technology that converts scanned documents and images into editable text',
      'Advanced OCR': 'Enhanced text recognition with better accuracy for complex documents and handwriting',
      'API access': 'Application Programming Interface that allows integration with your existing business systems',
      'SSO integration': 'Single Sign-On allows users to access Nitro with their existing company credentials'
    };
    return tooltips[feature] || '';
  }

  // Configure plan with options before adding to cart
  configurePlan(productFamily: ProductFamily, planName: string): void {
    this.router.navigate(['/calculator'], {
      queryParams: {
        product: productFamily.name,
        plan: planName,
        term: this.selectedTerm,
        mode: 'configure'
      }
    });
  }

  // Quick add plan to cart with default settings
  quickAddPlan(productFamily: ProductFamily, planName: string): void {
    this.router.navigate(['/cart'], {
      queryParams: {
        product: productFamily.name,
        plan: planName,
        term: this.selectedTerm,
        seats: 1,
        quickAdd: true
      }
    });
  }

  // Navigate to calculator for cost estimation help
  goToCalculator(): void {
    this.router.navigate(['/calculator'], {
      queryParams: {
        source: 'pricing',
        term: this.selectedTerm
      }
    });
  }
}