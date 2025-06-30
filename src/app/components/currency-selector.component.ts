import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LocalizationService, CurrencyInfo, LocalizationState } from '../services/localization.service';
import { LocationService, LocationInfo } from '../services/location.service';

@Component({
  selector: 'app-currency-selector',
  template: `
    <div class="currency-selector">
      <button 
        class="currency-button"
        (click)="toggleDropdown()"
        type="button">
        <span class="currency-flag">{{ currentCurrency?.flag || '🌍' }}</span>
        <span class="currency-code">{{ currentCurrency?.code || 'USD' }}</span>
        <span class="dropdown-arrow" [class.rotated]="isDropdownOpen">▼</span>
      </button>

      <!-- Overlay to close dropdown when clicking outside -->
      <div 
        class="dropdown-overlay" 
        *ngIf="isDropdownOpen"
        (click)="closeDropdown()">
      </div>

      <div class="currency-dropdown" [class.open]="isDropdownOpen">
        <div class="dropdown-header">
          <span class="dropdown-title">Select Currency</span>
          <div class="location-info" *ngIf="detectedLocation">
            <small class="location-text">
              <span class="location-icon">📍</span>
              Detected: {{ detectedLocation.country }}
            </small>
          </div>
        </div>
        
        <ul class="currency-list" role="listbox">
          <li 
            *ngFor="let currency of supportedCurrencies"
            class="currency-option"
            [class.selected]="currency.code === currentCurrency?.code"
            (click)="selectCurrency(currency)">
            <span class="currency-flag">{{ currency.flag }}</span>
            <div class="currency-info">
              <span class="currency-code">{{ currency.code }}</span>
              <span class="currency-name">{{ currency.name }}</span>
            </div>
            <span class="currency-symbol">{{ currency.symbol }}</span>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .currency-selector {
      position: relative;
      display: inline-block;
    }

    .currency-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--surface-color, #ffffff);
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-color, #333333);
      transition: all 0.2s ease;
      min-width: 80px;
    }

    .currency-button:hover {
      background: var(--surface-hover-color, #f5f5f5);
      border-color: var(--primary-color, #1976d2);
    }

    .currency-button:focus {
      outline: none;
      border-color: var(--primary-color, #1976d2);
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
    }

    .currency-flag {
      font-size: 16px;
      line-height: 1;
    }

    .currency-code {
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .dropdown-arrow {
      font-size: 10px;
      transition: transform 0.2s ease;
      margin-left: auto;
    }

    .dropdown-arrow.rotated {
      transform: rotate(180deg);
    }

    .dropdown-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 998;
    }

    .currency-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      min-width: 200px;
      max-height: 300px;
      overflow: hidden;
      display: none;
    }

    .currency-dropdown.open {
      display: block;
      animation: fadeIn 0.2s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dropdown-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #e0e0e0);
      background: var(--surface-secondary-color, #f8f9fa);
    }

    .dropdown-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary-color, #666666);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .location-info {
      margin-top: 4px;
    }

    .location-text {
      font-size: 11px;
      color: var(--text-tertiary-color, #888888);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .location-icon {
      font-size: 10px;
    }

    .currency-list {
      list-style: none;
      margin: 0;
      padding: 8px 0;
      max-height: 200px;
      overflow-y: auto;
    }

    .currency-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .currency-option:hover {
      background: var(--surface-hover-color, #f5f5f5);
    }

    .currency-option:focus {
      outline: none;
      background: var(--surface-hover-color, #f5f5f5);
    }

    .currency-option.selected {
      background: var(--primary-light-color, #e3f2fd);
      color: var(--primary-color, #1976d2);
      font-weight: 600;
    }

    .currency-option.selected:hover {
      background: var(--primary-light-color, #e3f2fd);
    }

    .currency-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 2px;
    }

    .currency-option .currency-code {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .currency-name {
      font-size: 12px;
      color: var(--text-secondary-color, #666666);
      font-weight: 400;
    }

    .currency-symbol {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary-color, #666666);
      min-width: 24px;
      text-align: right;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      .currency-dropdown {
        min-width: 180px;
      }
      
      .currency-option {
        padding: 10px 12px;
      }
      
      .dropdown-header {
        padding: 10px 12px;
      }
    }
  `]
})
export class CurrencySelectorComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  
  currentCurrency: CurrencyInfo | null = null;
  supportedCurrencies: readonly CurrencyInfo[] = [];
  isDropdownOpen = false;
  detectedLocation: LocationInfo | null = null;

  constructor(
    private readonly localizationService: LocalizationService,
    private readonly locationService: LocationService
  ) {
    try {
      this.supportedCurrencies = this.localizationService.getSupportedCurrencies();
      this.currentCurrency = this.localizationService.currentCurrencyInfo;
    } catch (error) {
      console.error('❌ Error initializing currency selector:', error);
    }
  }

  ngOnInit(): void {
    // Subscribe to localization changes
    this.localizationService.localization$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: LocalizationState) => {
        this.currentCurrency = state.currency;
      });

    // Get location info (don't wait for it)
    this.locationService.detectUserLocation()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (location) => {
          this.detectedLocation = location;
        },
        error: (error) => {
          console.warn('Location detection failed:', error);
          this.detectedLocation = null;
        }
      });

    // Close dropdown on escape key
    document.addEventListener('keydown', this.handleEscapeKey.bind(this));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('keydown', this.handleEscapeKey.bind(this));
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  selectCurrency(currency: CurrencyInfo): void {
    if (!this.currentCurrency || currency.code !== this.currentCurrency.code) {
      this.localizationService.setCurrency(currency.code);
    }
    this.closeDropdown();
  }

  trackByCurrency(index: number, currency: CurrencyInfo): string {
    return currency.code;
  }

  private handleEscapeKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isDropdownOpen) {
      this.closeDropdown();
    }
  }
}
