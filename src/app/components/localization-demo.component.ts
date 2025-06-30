import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LocalizationService, LocalizationState } from '../services/localization.service';
import { LocationService, LocationInfo } from '../services/location.service';

@Component({
  selector: 'app-localization-demo',
  template: `
    <div class="localization-demo">
      <h3>🌍 Localization System Demo</h3>
      
      <div class="demo-section">
        <h4>Current Settings</h4>
        <div class="info-row">
          <span class="label">Currency:</span>
          <span class="value">{{ currentLocalization?.currency.code }} ({{ currentLocalization?.currency.symbol }})</span>
        </div>
        <div class="info-row">
          <span class="label">Locale:</span>
          <span class="value">{{ currentLocalization?.locale }}</span>
        </div>
        <div class="info-row">
          <span class="label">Sample Price:</span>
          <span class="value">{{ formatSamplePrice() }}</span>
        </div>
      </div>

      <div class="demo-section" *ngIf="detectedLocation">
        <h4>Detected Location</h4>
        <div class="info-row">
          <span class="label">Country:</span>
          <span class="value">{{ detectedLocation.country }} ({{ detectedLocation.countryCode }})</span>
        </div>
        <div class="info-row">
          <span class="label">Suggested Currency:</span>
          <span class="value">{{ detectedLocation.currency }}</span>
        </div>
        <div class="info-row">
          <span class="label">Timezone:</span>
          <span class="value">{{ detectedLocation.timezone }}</span>
        </div>
      </div>

      <div class="demo-section">
        <h4>Actions</h4>
        <button class="demo-button" (click)="resetAutoDetection()">
          Reset Auto-Detection
        </button>
        <button class="demo-button" (click)="clearStoredSettings()">
          Clear Stored Settings
        </button>
      </div>

      <div class="demo-section">
        <h4>Price Formatting Examples</h4>
        <div class="price-examples">
          <div class="price-example" *ngFor="let price of samplePrices">
            <span class="original">{{ price }}</span>
            <span class="formatted">{{ formatPrice(price) }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .localization-demo {
      max-width: 600px;
      margin: 20px auto;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .demo-section {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #eee;
    }

    .demo-section:last-child {
      border-bottom: none;
    }

    h3 {
      margin-top: 0;
      color: #333;
    }

    h4 {
      margin-bottom: 12px;
      color: #555;
      font-size: 16px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      padding: 4px 0;
    }

    .label {
      font-weight: 600;
      color: #666;
    }

    .value {
      color: #333;
      font-family: monospace;
    }

    .demo-button {
      background: #007bff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 8px;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .demo-button:hover {
      background: #0056b3;
    }

    .price-examples {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .price-example {
      display: flex;
      justify-content: space-between;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .original {
      color: #666;
    }

    .formatted {
      font-weight: 600;
      color: #007bff;
    }
  `]
})
export class LocalizationDemoComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  currentLocalization: LocalizationState | null = null;
  detectedLocation: LocationInfo | null = null;
  samplePrices = [29.99, 99, 149.50, 1299];

  constructor(
    private readonly localizationService: LocalizationService,
    private readonly locationService: LocationService
  ) {}

  ngOnInit(): void {
    // Subscribe to localization changes
    this.localizationService.localization$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.currentLocalization = state;
      });

    // Get location info
    this.locationService.detectUserLocation()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: location => this.detectedLocation = location,
        error: () => this.detectedLocation = null
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  formatSamplePrice(): string {
    return this.localizationService.formatCurrency(29.99);
  }

  formatPrice(price: number): string {
    return this.localizationService.formatCurrency(price);
  }

  resetAutoDetection(): void {
    this.localizationService.resetAutoDetection();
    // Reload the page to trigger auto-detection again
    setTimeout(() => window.location.reload(), 100);
  }

  clearStoredSettings(): void {
    localStorage.clear();
    // Reload the page to start fresh
    setTimeout(() => window.location.reload(), 100);
  }
}
