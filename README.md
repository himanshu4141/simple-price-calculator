# Simple Price Calculator

An Angular-based pricing calculator application for Nitro PDF and Nitro Sign products, featuring granular seat-based pricing tiers, package pricing, and API call pricing.

## Key Features

### Enhanced Pricing Structure
- **Dynamic Seat-Based Pricing**: Intelligent volume discounts across multiple tiers (1-10,000+ seats)
- **Package Management**: Built-in free package allocations with overage pricing
- **API Integration**: Dedicated API call pricing for enterprise plans
- **Commitment Terms**: Support for both 1-year and 3-year commitments with appropriate discounts

### Modern User Interface
- **Material Design**: Polished UI using Angular Material components
- **Responsive Layout**: Optimized for all screen sizes
- **Interactive Elements**: 
  - Dynamic price breakdowns
  - Real-time calculations
  - Tooltips for additional information
  - Visual feedback for volume discounts

### Components
- **Pricing Page**: 
  - Clear plan comparisons
  - Feature breakdowns
  - Transparent pricing tiers
  - Visible volume discounts
- **Price Calculator**: 
  - Granular control over quantities
  - Detailed price breakdowns
  - Real-time updates
  - Term selection
- **Cart**: 
  - Product configuration
  - Comprehensive order summary
  - Clear pricing breakdown
  - Package and API call management

## Live Demo

[View the latest deployed app on GitHub Pages](https://himanshu4141.github.io/simple-price-calculator/)

## Getting Started

To run the application locally:

1. **Clone the repository:**
   ```sh
   git clone https://github.com/himanshu4141/simple-price-calculator.git
   cd simple-price-calculator
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Start the development server:**
   ```sh
   ng serve
   ```
4. **Open your browser:**
   Visit [http://localhost:4200](http://localhost:4200)

## Deployment

This project is automatically deployed to GitHub Pages on every push to the `main` branch using GitHub Actions.

To deploy manually:
```sh
ng deploy --base-href=/simple-price-calculator/
```

## Project Structure

### Core Files
- `src/assets/pricing-data.json` — Complete pricing configuration including tiers, features, and terms
- `src/app/models/pricing.model.ts` — TypeScript interfaces for pricing structures
- `src/app/services/pricing.service.ts` — Centralized pricing calculation logic

### Components
- `src/app/components/pricing-page/` — Plan comparison and selection
- `src/app/components/price-calculator/` — Interactive pricing calculator
- `src/app/components/cart-page/` — Cart configuration and summary

### Configuration
- `angular.json` — Angular CLI configuration
- `.github/workflows/deploy.yml` — CI/CD workflow for GitHub Pages
- `tsconfig.json` — TypeScript configuration

## Technical Implementation
- **Shared Pricing Logic**: Centralized pricing calculations in `PricingService`
- **Dynamic Configuration**: All pricing tiers and features managed via `pricing-data.json`
- **Type Safety**: Strong TypeScript interfaces for all pricing models
- **Component Communication**: Clean separation of concerns between display and logic
- **Consistent Terminology**: Unified language across all components (e.g., "Commitment Term")
- **Error Handling**: Robust validation and error states for all user inputs

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

MIT License. See the LICENSE file for details.