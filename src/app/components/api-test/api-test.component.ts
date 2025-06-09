import { Component, OnInit } from '@angular/core';
import { PricingService, EstimateRequest } from '../../services/pricing.service';

@Component({
  selector: 'app-api-test',
  template: `
    <div class="api-test-container">
      <h2>Backend API Integration Test</h2>
      
      <div class="test-section">
        <h3>🔄 API Health Check</h3>
        <button (click)="testApiHealth()" class="test-btn">Test API Health</button>
        <div class="result" [ngClass]="healthStatus">{{ healthMessage }}</div>
      </div>

      <div class="test-section">
        <h3>💰 Pricing Data Test</h3>
        <button (click)="testPricingData()" class="test-btn">Fetch Pricing Data</button>
        <div class="result">
          <div *ngIf="pricingResult">
            ✅ Success: {{ pricingResult.productFamilies.length }} product families loaded
            <div>Supported currencies: {{ pricingResult.supportedCurrencies.join(', ') }}</div>
            <div>Last updated: {{ pricingResult.lastUpdated | date:'short' }}</div>
          </div>
          <div *ngIf="pricingError" class="error">❌ Error: {{ pricingError }}</div>
        </div>
      </div>

      <div class="test-section">
        <h3>🧮 Estimate Test</h3>
        <button (click)="testEstimate()" class="test-btn">Test Estimate Calculation</button>
        <div class="result">
          <div *ngIf="estimateResult">
            ✅ Success: ${{ estimateResult.total }} total for {{ estimateResult.items.length }} items
            <div *ngFor="let item of estimateResult.items">
              - {{ item.productFamily }} {{ item.planName }}: ${{ item.totalPrice }}
            </div>
          </div>
          <div *ngIf="estimateError" class="error">❌ Error: {{ estimateError }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .api-test-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .test-section {
      margin: 20px 0;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    .test-btn {
      background: #007bff;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 10px;
    }
    .test-btn:hover {
      background: #0056b3;
    }
    .result {
      padding: 10px;
      margin-top: 10px;
      border-radius: 4px;
      background: #f8f9fa;
    }
    .error {
      background: #f8d7da;
      color: #721c24;
    }
    .success {
      background: #d4edda;
      color: #155724;
    }
    .warning {
      background: #fff3cd;
      color: #856404;
    }
  `]
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
