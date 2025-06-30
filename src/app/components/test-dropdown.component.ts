import { Component } from '@angular/core';

@Component({
  selector: 'app-test-dropdown',
  template: `
    <div class="test-dropdown">
      <button (click)="toggle()" class="test-button">
        Toggle Dropdown ({{ isOpen ? 'Open' : 'Closed' }})
      </button>
      <div class="test-dropdown-content" [class.show]="isOpen">
        <div class="test-item" (click)="select('Item 1')">Item 1</div>
        <div class="test-item" (click)="select('Item 2')">Item 2</div>
        <div class="test-item" (click)="select('Item 3')">Item 3</div>
      </div>
    </div>
  `,
  styles: [`
    .test-dropdown {
      position: relative;
      display: inline-block;
      margin: 20px;
    }
    .test-button {
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .test-dropdown-content {
      position: absolute;
      top: 100%;
      left: 0;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      min-width: 200px;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all 0.2s ease;
    }
    .test-dropdown-content.show {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .test-item {
      padding: 10px 15px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
    }
    .test-item:hover {
      background: #f5f5f5;
    }
    .test-item:last-child {
      border-bottom: none;
    }
  `]
})
export class TestDropdownComponent {
  isOpen = false;

  toggle() {
    console.log('Toggle clicked, current state:', this.isOpen);
    this.isOpen = !this.isOpen;
    console.log('New state:', this.isOpen);
  }

  select(item: string) {
    console.log('Selected:', item);
    this.isOpen = false;
  }
}
