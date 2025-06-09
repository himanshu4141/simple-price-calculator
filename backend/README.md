# Nitro Price Calculator API

## Phase 0 - Critical Setup & Discovery

This backend API is designed to integrate with Chargebee for pricing data and subscription management, with a focus on **1-year billing terms only**. 3-year pricing continues to use static data from the frontend.

## Quick Start

### Prerequisites
- Scala 2.13+
- SBT 1.9+
- Chargebee test environment access

### Setup

1. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Chargebee test credentials
   ```

2. **Start the Development Server**
   ```bash
   sbt run
   ```

3. **Test the Setup**
   ```bash
   # Health check
   curl http://localhost:8080/api/health
   
   # Chargebee discovery (requires valid credentials)
   curl http://localhost:8080/api/chargebee/discovery
   ```

## Phase 0 Critical Tasks

### ✅ COMPLETED
- [x] Basic Scala/Pekko-HTTP project structure
- [x] Chargebee client with discovery capabilities
- [x] Mock tax calculation service
- [x] Health check endpoints
- [x] CORS configuration for frontend integration

### 🚨 IMMEDIATE NEXT STEPS
1. **Configure Chargebee Credentials** - Add your test site and API key to `.env`
2. **Run Product Discovery** - Execute discovery endpoint to document actual structure
3. **Update PLANNING.md** - Document discovered products vs. assumed structure

## API Endpoints

### Discovery & Health
- `GET /api/health` - Health check for all services
- `GET /api/chargebee/discovery` - Discover actual Chargebee product structure

### Coming in Phase 1
- `GET /api/pricing` - Fetch pricing (Chargebee + static data)
- `POST /api/estimate` - Calculate quotes
- `POST /api/taxes` - Tax calculation
- `POST /api/checkout` - Process checkout (1-year only)

## Architecture Decisions

### Hybrid Pricing Strategy
- **1-Year Terms**: Real-time pricing from Chargebee APIs
- **3-Year Terms**: Static pricing from frontend `pricing-data.json`
- **Checkout**: 1-year automated, 3-year redirects to sales

### External Services
- **Chargebee**: Plans, addons, subscriptions (1-year only)
- **Stripe**: Payment processing (connected to Chargebee)
- **Avalara**: Tax calculation (mock implementation with feature flag)

## Configuration

### Environment Variables
```bash
# Required for Chargebee integration
CHARGEBEE_SITE=your-test-site
CHARGEBEE_API_KEY=your-test-api-key

# Required for payment processing  
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Optional - using mock by default
AVALARA_BASE_URL=https://sandbox-rest.avatax.com
AVALARA_API_KEY=your-avalara-key
```

### Feature Flags
- `features.use-real-avalara = false` - Use mock tax service
- `features.enable-3year-checkout = false` - Always false (3-year = sales contact)
- `features.enable-webhooks = true` - Webhook processing enabled

## Development Notes

### Mock Tax Service
The mock tax service provides realistic tax calculations for development:
- **US**: State-by-state sales tax rates
- **Canada**: GST/HST by province  
- **UK**: 20% VAT
- **Australia**: 10% GST
- **EU**: VAT by country (19-24%)

### Error Handling
- All external API failures are logged and handled gracefully
- Health checks verify service connectivity
- CORS headers configured for frontend integration

### Logging
- Structured logging with Logback
- Debug-level API request/response logging
- Error-level failure tracking

## Phase 1 Implementation

After Phase 0 discovery is complete, Phase 1 will add:
1. Core pricing endpoints with hybrid data sources
2. Quote estimation with volume tier calculations  
3. Checkout processing for 1-year terms
4. Static pricing data handler for 3-year terms

## Testing

```bash
# Run tests
sbt test

# Run with auto-reload during development
sbt ~run
```

## Deployment

The application is configured for Heroku deployment with environment variable configuration.

## Support

For development questions, refer to:
- `PLANNING.md` - Complete technical specification
- `TASKS.md` - Detailed task breakdown
- `PROJECT_STATUS.md` - Current implementation status
