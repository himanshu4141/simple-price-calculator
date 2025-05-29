import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { PricingPageComponent } from './components/pricing-page/pricing-page.component';
import { CartPageComponent } from './components/cart-page/cart-page.component';
import { PriceCalculatorComponent } from './components/price-calculator/price-calculator.component';

const routes: Routes = [
  { path: '', component: PricingPageComponent },
  { path: 'cart', component: CartPageComponent },
  { path: 'calculator', component: PriceCalculatorComponent }
];

@NgModule({
  declarations: [
    AppComponent,
    PricingPageComponent,
    CartPageComponent,
    PriceCalculatorComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    RouterModule.forRoot(routes),
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatSliderModule,
    MatButtonToggleModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }