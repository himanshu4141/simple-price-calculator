# Nitro Price Calculator Backend API

A Scala/Pekko-HTTP backend service providing real-time pricing integration with Chargebee Product Catalog 2.0, hybrid pricing strategies, and volume tier calculations.

## 🚀 Current Status: **Phase 1 Core Integration - 70% Complete**

### ✅ **Completed Features**
- **Chargebee Product Catalog 2.0 Integration**: Full PC 2.0 API integration with 40 item prices across 5 currencies
- **Hybrid Pricing Strategy**: 1-year pricing from Chargebee + 3-year pricing from static data
- **Volume Tier Calculations**: Automatic tier selection and pricing calculations
- **Intelligent Caching**: 1-hour TTL with graceful fallbacks for reliability  
- **Multi-Product Estimates**: Complex pricing scenarios with packages and API calls
- **Error Handling**: Comprehensive error handling and logging throughout

### 🔄 **In Progress**
- **Mock Tax Service**: Multi-currency tax calculations (next priority)
- **Checkout Endpoint**: Complete subscription creation with Chargebee (final Phase 1 milestone)

## API Endpoints

### Core Endpoints

#### `GET /api/health`
Service health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "services": {
    "chargebee": "connected",
    "taxService": "mock-ready", 
    "stripe": "not-tested"
  },
  "timestamp": "2025-06-09T21:53:02.836397Z"
}
```

#### `GET /api/pricing?currency=USD`
Hybrid pricing data combining Chargebee 1-year pricing with static 3-year pricing.

**Parameters**:
- `currency` (optional): USD, EUR, GBP, CAD, AUD (default: USD)

**Response**:
```json
{
  "productFamilies": [
    {
      "name": "Nitro PDF",
      "description": "Professional PDF creation and editing",
      "plans": [
        {
          "name": "Nitro PDF Standard",
          "oneYearPricing": [
            {"minSeats": 1, "price": 180.00},
            {"minSeats": 5, "price": 171.00},
            {"minSeats": 11, "price": 162.00}
          ],
          "threeYearPricing": [
            {"minSeats": 1, "price": 119},
            {"minSeats": 10, "price": 109}
          ]
        }
      ]
    }
  ],
  "supportedCurrencies": ["USD", "EUR", "GBP", "CAD", "AUD"],
  "lastUpdated": "2025-06-09T22:17:26.789Z"
}
```

#### `POST /api/estimate`
Calculate pricing estimates with volume tiers, packages, and API calls.

**Request**:
```json
{
  "items": [
    {
      "productFamily": "Nitro PDF",
      "planName": "Nitro PDF Standard",
      "seats": 10,
      "packages": 5
    }
  ],
  "currency": "USD",
  "billingTerm": "1year"
}
```

**Response**:
```json
{
  "items": [
    {
      "productFamily": "Nitro PDF",
      "planName": "Nitro PDF Standard",
      "seats": 10,
      "basePrice": 1710.00,
      "packagesPrice": 0,
      "apiCallsPrice": 0,
      "totalPrice": 1710.00,
      "appliedTier": {"minSeats": 5, "price": 171.00},
      "includedPackages": null,
      "extraPackages": 5
    }
  ],
  "subtotal": 1710.00,
  "total": 1710.00,
  "currency": "USD", 
  "billingTerm": "1year"
}
```

### Discovery Endpoints

#### `GET /api/chargebee/discovery`
Discover actual Chargebee product structure and item prices.

**Response**:
```json
{
  "items": [
    {
      "id": "Nitro_PDF_STD",
      "name": "Nitro PDF Standard",
      "status": "active",
      "type": "plan"
    }
  ],
  "itemPrices": [
    {
      "id": "Nitro_PDF_STD-USD-yearly",
      "item_id": "Nitro_PDF_STD", 
      "currency_code": "USD",
      "period": 1,
      "period_unit": "year",
      "tiers": [
        {"starting_unit": 1, "price": 18000, "price_in_decimal": "180.00"},
        {"starting_unit": 5, "price": 17100, "price_in_decimal": "171.00"}
      ]
    }
  ]
}
```

### Future Endpoints

#### `POST /api/taxes` (Coming Soon)
Mock tax calculation service.

#### `POST /api/checkout` (Coming Soon) 
Complete checkout flow for 1-year subscriptions.

## Quick Start

### Prerequisites
- Java 21
- SBT 1.9.7
- Scala 2.13

### Environment Setup
1. Copy `.env.example` to `.env`
2. Configure Chargebee credentials:
   ```
   CHARGEBEE_SITE=nitro-ubb-test
   CHARGEBEE_API_KEY=your_api_key
   ```

### Running the Server

#### Option 1: Using Scripts (Recommended)
```bash
# Start/restart server
./restart-server.sh

# Check status  
./status-server.sh

# Stop server
./stop-server.sh
```

#### Option 2: Direct SBT
```bash
# Compile
sbt compile

# Run
sbt run
```

### Testing the API
```bash
# Health check
curl http://localhost:8080/api/health

# Get pricing
curl "http://localhost:8080/api/pricing?currency=USD"

# Calculate estimate
curl -X POST http://localhost:8080/api/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productFamily": "Nitro PDF",
        "planName": "Nitro PDF Standard", 
        "seats": 10
      }
    ],
    "currency": "USD",
    "billingTerm": "1year"
  }'
```

## Architecture

### Tech Stack
- **Framework**: Scala 2.13 with Pekko-HTTP
- **JSON**: Circe for JSON encoding/decoding
- **HTTP Client**: Pekko-HTTP client for Chargebee integration
- **Logging**: Logback with structured logging
- **Configuration**: Typesafe Config

### Key Components

#### `ChargebeeClient`
- Product Catalog 2.0 integration
- Automatic pagination handling
- Error handling with retries
- Connection testing

#### `PricingService` 
- Hybrid pricing strategy implementation
- Volume tier calculations
- Intelligent caching with TTL
- Static data merging

#### `ApiRoutes`
- REST API endpoint definitions
- CORS configuration
- Error handling and logging
- Request/response validation

### Data Models

#### Core Models
- `ChargebeeItem` - Chargebee product items
- `ChargebeeItemPrice` - Pricing with volume tiers
- `PricingApiResponse` - Frontend-compatible pricing format
- `PricingEstimateRequest/Response` - Estimate calculation models

#### Pricing Models
- `RampPrice` - Volume tier pricing structure
- `PricingPlan` - Product plan with 1-year and 3-year pricing
- `PricingProductFamily` - Grouped product families

## Configuration

### Environment Variables
```bash
CHARGEBEE_SITE=nitro-ubb-test
CHARGEBEE_API_KEY=your_chargebee_api_key
SERVER_PORT=8080
LOG_LEVEL=INFO
```

### Application Configuration
See `src/main/resources/application.conf` for detailed configuration options.

## Development

### Project Structure
```
src/main/scala/com/nitro/pricing/
├── Main.scala                 # Server bootstrap
├── models/Models.scala        # All data models and JSON codecs
├── services/
│   ├── ChargebeeClient.scala  # Chargebee PC 2.0 integration
│   ├── PricingService.scala   # Hybrid pricing logic
│   └── TaxCalculationService.scala # Mock tax service
└── routes/
    └── ApiRoutes.scala        # API endpoint definitions
```

### Key Features

#### Hybrid Pricing Strategy
- **1-Year Terms**: Real-time pricing from Chargebee APIs
- **3-Year Terms**: Static pricing from `pricing-data.json`
- **Merging Logic**: Intelligent combination of data sources
- **Fallback Strategy**: Graceful degradation on API failures

#### Volume Tier Engine
- **Automatic Selection**: Finds best tier based on seat count
- **Multi-Tier Support**: Handles complex tier structures
- **Price Calculation**: Accurate total pricing with tier discounts

#### Caching Strategy
- **TTL**: 1-hour cache for Chargebee data
- **Fallback**: Uses cached data on API failures
- **Performance**: Sub-500ms response times for cached data

## Monitoring & Logging

### Health Checks
- Chargebee connectivity
- Service status monitoring  
- External dependency verification

### Logging
- Structured JSON logging
- Request/response logging
- Error tracking with stack traces
- Performance metrics

### Server Management
- Process ID tracking
- Graceful shutdown handling
- Background process management

## Testing

### Manual Testing
See API examples above for manual testing commands.

### Automated Testing
```bash
# Run tests
sbt test

# Run with coverage
sbt clean coverage test coverageReport
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 8080
lsof -i :8080

# Kill process
kill -9 <PID>
```

#### Chargebee Connection Issues
1. Verify API key in `.env`
2. Check network connectivity
3. Review server logs for detailed errors

#### SBT Issues
```bash
# Clean and reload
sbt clean reload compile
```

### Log Files
- `server.log` - Main application logs
- `server.pid` - Process ID file

## Contributing

1. Follow Scala best practices
2. Add comprehensive error handling
3. Include logging for debugging
4. Update documentation for new features
5. Test all API endpoints manually

## License

MIT License. See the LICENSE file for details.
