# Simple Price Calculator

An Angular-based pricing calculator application for Nitro PDF and Nitro Sign products, featuring granular seat-based pricing tiers, package pricing, and API call pricing. **Now with full Chargebee integration, real-time pricing, and complete checkout flow!**

## 🚀 Current Status: **Phase 2 Complete + CORS Integration Fixed** 🎉

### 🎉 **Major Milestone: Full Integration Operational** (June 11, 2025)
- **CORS Integration**: Complete frontend-backend communication ✅
- **Tax Calculations**: Real-time tax API integration working ✅  
- **Checkout Flow**: Customer creation and subscription management ✅
- **Field Mapping**: All data structures properly aligned ✅
- **Chargebee Integration**: Production-ready subscription creation ✅

### ✅ **Recently Completed Backend Integration**
- **Chargebee Product Catalog 2.0**: Full integration with real-time pricing data
- **Hybrid Pricing Strategy**: 1-year pricing from Chargebee APIs + 3-year pricing from static data
- **Volume Tier Calculations**: Automatic tier selection and pricing (e.g., 15 seats @ $162 vs 10 seats @ $171)
- **Multi-Product Estimates**: Complex pricing scenarios with packages and API calls
- **Caching & Performance**: 1-hour TTL with graceful fallbacks for reliability

### 🔄 **Active Development**
- **Checkout Endpoint**: Complete subscription creation with Chargebee (final Phase 1 milestone)
- **Frontend Integration**: Ready to connect frontend to new backend APIs

### ✅ **Recently Completed Tax Service**
- **Mock Tax Service**: Multi-currency tax calculations now fully operational
- **Tax Breakdown**: Detailed tax calculations by jurisdiction (US states, Canadian provinces, VAT, etc.)
- **POST /api/taxes**: Complete endpoint for real-time tax calculations
- **Feature Flag Ready**: Easy switch to real Avalara when sandbox becomes available

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

## Live Demo & Backend API

### Frontend Demo
[View the latest deployed app on GitHub Pages](https://himanshu4141.github.io/simple-price-calculator/)

### Backend API (Development)
**Server Status**: ✅ Running on `localhost:8080`  
**API Endpoints**:
- `GET /api/health` - Service health checks
- `GET /api/pricing?currency=USD` - Hybrid pricing (1yr Chargebee + 3yr static)  
- `POST /api/estimate` - Volume tier calculations with packages & API calls
- `GET /api/chargebee/discovery` - Product structure discovery
- ✅ `POST /api/taxes` - Mock tax calculation (complete and operational)
- 🔄 `POST /api/checkout` - Subscription creation (final milestone)

**Example API Response**:
```json
{
  "items": [{
    "productFamily": "Nitro PDF",
    "planName": "Nitro PDF Standard", 
    "seats": 10,
    "basePrice": 1710.00,
    "totalPrice": 1710.00,
    "appliedTier": {"minSeats": 5, "price": 171.00}
  }],
  "subtotal": 1710.00,
  "total": 1710.00,
  "currency": "USD",
  "billingTerm": "1year"
}
```

## Getting Started

### Frontend Development
To run the Angular application locally:

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

### Backend Development  
To run the Scala backend API locally:

1. **Navigate to backend directory:**
   ```sh
   cd backend
   ```

2. **Start the backend server:**
   ```sh
   ./restart-server.sh
   ```

3. **Check server status:**
   ```sh
   ./status-server.sh
   ```

4. **Test API endpoints:**
   ```sh
   curl http://localhost:8080/api/health
   curl "http://localhost:8080/api/pricing?currency=USD"
   ```

**Backend Requirements**: Java 21, SBT 1.9.7, Scala 2.13
4. **Open your browser:**
   Visit [http://localhost:4200](http://localhost:4200)

## Deployment

This project is automatically deployed to GitHub Pages on every push to the `main` branch using GitHub Actions.

To deploy manually:
```sh
ng deploy --base-href=/simple-price-calculator/
```

## Project Structure

### Frontend Structure
- `src/assets/pricing-data.json` — Static 3-year pricing configuration
- `src/app/models/pricing.model.ts` — TypeScript interfaces for pricing structures
- `src/app/services/pricing.service.ts` — Centralized pricing calculation logic
- `src/app/components/pricing-page/` — Plan comparison and selection
- `src/app/components/price-calculator/` — Interactive pricing calculator
- `src/app/components/cart-page/` — Cart configuration and summary

### Backend Structure (New!)
- `backend/src/main/scala/com/nitro/pricing/` — Scala backend API
  - `models/Models.scala` — Chargebee models and API response models
  - `services/ChargebeeClient.scala` — Chargebee Product Catalog 2.0 integration
  - `services/PricingService.scala` — Hybrid pricing logic and calculations
  - `routes/ApiRoutes.scala` — REST API endpoint definitions
  - `Main.scala` — Server bootstrap and configuration
- `backend/src/main/resources/` — Configuration files
  - `pricing-data.json` — Static 3-year pricing data (copied from frontend)
  - `application.conf` — Server and external service configuration

### Configuration
- `angular.json` — Angular CLI configuration
- `backend/build.sbt` — Scala build configuration
- `backend/*.sh` — Server management scripts (restart, status, stop)
- `.github/workflows/deploy.yml` — CI/CD workflow for GitHub Pages
- `tsconfig.json` — TypeScript configuration

## Technical Implementation

### Frontend Architecture
- **Shared Pricing Logic**: Centralized pricing calculations in `PricingService`
- **Dynamic Configuration**: All pricing tiers and features managed via `pricing-data.json`
- **Type Safety**: Strong TypeScript interfaces for all pricing models
- **Component Communication**: Clean separation of concerns between display and logic
- **Consistent Terminology**: Unified language across all components (e.g., "Commitment Term")
- **Error Handling**: Robust validation and error states for all user inputs

### Backend Architecture (New!)
- **Hybrid Pricing Strategy**: 1-year pricing from Chargebee APIs + 3-year from static data
- **Chargebee Product Catalog 2.0**: Real-time integration with volume tier support
- **Intelligent Caching**: 1-hour TTL with graceful fallbacks for reliability
- **Volume Tier Engine**: Automatic tier selection based on seat count
- **Multi-Currency Support**: USD, EUR, GBP, CAD, AUD pricing
- **Error Recovery**: Comprehensive error handling with fallback to cached data

### Integration Strategy
- **Phase 1**: Backend API development with hybrid pricing (70% complete)
- **Phase 2**: Frontend integration with new APIs (next priority)
- **Phase 3**: Complete checkout flow with Chargebee subscription creation

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

MIT License. See the LICENSE file for details.