import { Component, OnInit } from '@angular/core';
import { PricingService, EstimateRequest } from '../../services/pricing.service';

@Component({
  selector: 'app-api-test',
  templateUrl: './api-test.component.html',
  styleUrls: ['./api-test.component.scss']
})
export class ApiTestComponent implements OnInit {
  healthStatus = '';
  healthMessage = 'Not tested';
  pricingResult: any = null;
  pricingError = '';
  estimateResult: any = null;
  estimateError = '';

  constructor(private pricingService: PricingService) {}

  ngOnInit(): void {
    console.log('🧪 API Test component initialized');
  }

  testApiHealth(): void {
    this.healthStatus = '';
    this.healthMessage = 'Testing...';
    
    this.pricingService.checkApiHealth().subscribe(
      isHealthy => {
        this.healthStatus = isHealthy ? 'success' : 'warning';
        this.healthMessage = isHealthy ? '✅ Backend API is healthy' : '⚠️ Backend API is not responding';
      },
      error => {
        this.healthStatus = 'error';
        this.healthMessage = '❌ Failed to check API health: ' + error.message;
      }
    );
  }

  testPricingData(): void {
    this.pricingResult = null;
    this.pricingError = '';
    
    this.pricingService.fetchPricingData('USD').subscribe(
      result => {
        this.pricingResult = result;
        console.log('📊 Pricing data test result:', result);
      },
      error => {
        this.pricingError = error.message;
        console.error('❌ Pricing data test error:', error);
      }
    );
  }

  testEstimate(): void {
    this.estimateResult = null;
    this.estimateError = '';
    
    const testRequest: EstimateRequest = {
      items: [
        {
          productFamily: 'Nitro PDF',
          planName: 'Nitro PDF Standard',
          seats: 10,
          packages: 0,
          apiCalls: 0
        },
        {
          productFamily: 'Nitro Sign',
          planName: 'Nitro Sign Standard',
          seats: 5,
          packages: 1000,
          apiCalls: 0
        }
      ],
      currency: 'USD',
      billingTerm: '1year'
    };
    
    this.pricingService.getEstimate(testRequest).subscribe(
      result => {
        this.estimateResult = result;
        console.log('🧮 Estimate test result:', result);
      },
      error => {
        this.estimateError = error.message;
        console.error('❌ Estimate test error:', error);
      }
    );
  }
}
