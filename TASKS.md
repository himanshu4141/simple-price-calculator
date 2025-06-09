# Nitro Price Calculator - Chargebee Integration Tasks

## Project Status: **Phase 1 Core Integration - 70% Complete**

## Current Sprint: **Phase 1 - Backend API Development**

### 🚨 IMMEDIATE NEXT STEPS (CRITICAL)
1. ✅ **Chargebee Product Discovery** - Use APIs to discover actual product/addon structure
2. ✅ **API Access Verification** - Confirm Chargebee and Stripe test environment access
3. ✅ **Backend API Development** - Create endpoints to receive webhook configurations later
4. **Avalara Mock Implementation** - Create tax calculation mock until sandbox is available ⏳ **IN PROGRESS**
5. **POST /api/checkout Endpoint** - Complete 1-year subscription creation (Phase 1 final milestone)

### ✅ **MAJOR ACCOMPLISHMENTS**
- **Chargebee Integration**: Complete PC 2.0 implementation with 40 item prices across 5 currencies
- **Hybrid Pricing Strategy**: Successfully merging 1-year Chargebee + 3-year static pricing
- **Core API Endpoints**: GET /api/pricing and POST /api/estimate fully functional
- **Volume Tier Calculations**: Automatic tier selection and pricing calculations working
- **Caching Strategy**: 1-hour TTL with graceful fallbacks implemented
- **Error Handling**: Comprehensive error handling and logging throughout

---

## Phase 0: Environment & Sandbox Setup
**Priority: Critical | Status: Not Started**

### 🔧 External Service Configuration
**Priority: Critical | Status: Not Started**

#### Task 0.1: Access Verification & Product Discovery ✅ **COMPLETE**
- [x] **Chargebee**: Verify test site access and API permissions
- [x] **Stripe**: Confirm existing Chargebee-Stripe connection is working
- [x] **Chargebee Product Discovery**: Document all configured items and pricing structure
  - [x] List all items configured in Chargebee test environment using PC 2.0 APIs
  - [x] Implement and test PC 2.0 models with correct field mapping
  - [x] Document volume tier configurations for each item
  - [x] Identify business rules and constraints
- [x] Update PLANNING.md with actual product structure findings

**✅ Results:** Successfully connected to `nitro-ubb-test` Chargebee site and implemented fully functional PC 2.0 discovery endpoint with complete product structure including 8 items and 40 item prices across 5 currencies.

**✅ Major Backend Integration Results:**
- **Hybrid Pricing Strategy**: Successfully implemented 1-year Chargebee + 3-year static pricing merge
- **Volume Tier Calculations**: Automatic tier selection working (e.g., 15 seats @ $162 vs 10 seats @ $171)
- **Caching Strategy**: 1-hour TTL with graceful fallbacks to cached data on API failures
- **Multi-Product Estimates**: Complex scenarios working (PDF + Sign + packages + API calls)
- **Real-World Testing**: Verified with realistic scenarios (e.g., $2,890 for Sign Enterprise with extras)
- **Error Handling**: Comprehensive error handling and logging throughout all endpoints

#### Task 0.2: Avalara Mock Implementation
- [ ] Create mock Avalara tax calculation service
- [ ] Implement tax calculation logic for supported countries/states
- [ ] Add configurable tax rates for testing (e.g., 10% for US, 20% for UK)
- [ ] Create tax breakdown response format matching Avalara API
- [ ] Add feature flag to switch between mock and real Avalara when ready
- [ ] Document mock tax scenarios for testing

---

## Phase 1: Core Integration (Current Focus)

### 🔧 Backend API Setup
**Priority: High | Status: Not Started**

#### Task 1.1: Project Setup & Dependencies ✅ **COMPLETE**
- [x] Create Scala/Pekko-HTTP project structure
- [x] Add dependencies (Pekko-HTTP, Cats, Chargebee SDK, Stripe SDK, JSON libraries)
- [x] Set up environment configuration (dev/test/prod)
- [x] Configure logging framework
- [x] Set up basic error handling framework
- [ ] Create Docker configuration for local development

#### Task 1.2: Chargebee Integration Foundation ✅ **COMPLETE**
- [x] Implement Chargebee client wrapper with proper error handling
- [x] Create models for Chargebee entities (Plans, Addons, Subscriptions, Customers)
- [x] Implement connection testing and health checks
- [x] Add retry logic for API failures
- [x] Create caching layer for pricing data (1-hour TTL)
- [x] **IMPORTANT**: Only configure/handle 1-year pricing terms in Chargebee

#### Task 1.2b: Static Pricing Data Handler ✅ **COMPLETE**
- [x] Load pricing-data.json file for 3-year pricing (NOT from Chargebee)
- [x] Create data models that match current frontend expectations
- [x] Implement pricing calculation logic for 3-year terms using static data
- [x] Ensure consistency between Chargebee and static data formats
- [x] Add validation to ensure static data structure matches frontend needs
- [x] **IMPORTANT**: 3-year pricing will NEVER be configured in Chargebee

#### Task 1.3: Chargebee Product Discovery ✅ **COMPLETE**
- [x] **GET /api/chargebee/discovery** - Investigate actual Chargebee setup
  - [x] List all items configured in Chargebee test environment using PC 2.0 APIs
  - [x] Implement correct PC 2.0 models (ChargebeeItem, ChargebeeItemPrice) with proper field mapping
  - [x] Fix field naming to match Chargebee JSON structure (snake_case)
  - [x] Test and validate discovery endpoint returns correct data
  - [x] Update PLANNING.md with actual product structure findings

**✅ Discovery Results Summary:**
- **8 Items**: Including subscription container, 5 product items, and 2 addon items
- **35 Item Prices**: Volume-based pricing across 5 currencies (USD, EUR, GBP, CAD, AUD)
- **PC 2.0 Implementation**: Successfully using Product Catalog 2.0 APIs with correct models
- **Volume Tiers**: All items have proper volume-based pricing with tier breakpoints
- **Discovery Endpoint**: Fully functional and tested, ready for frontend integration

#### Task 1.4: Core API Endpoints ✅ **PARTIALLY COMPLETE**
- [x] **GET /api/pricing** - Fetch and cache pricing from multiple sources
  - [x] Retrieve 1-year pricing from Chargebee with volume tiers (based on discovery findings)
  - [x] Load 3-year pricing from static pricing-data.json file
  - [x] Merge pricing data into unified response format for frontend
  - [x] Implement caching with TTL (1-year data only, 3-year is static)
  - [x] Add fallback to cached data on Chargebee failures
- [x] **POST /api/estimate** - Calculate quote totals
  - [x] Validate addon selection constraints (max 1 PDF, 1 Sign, if sign addon is in cart allow for sign-packages addon and if sign-enterprise in in cart allow for sign-api as well)
  - [x] **1-Year Terms**: Calculate volume-based pricing using Chargebee tiers
  - [x] **3-Year Terms**: Calculate pricing using static pricing-data.json
  - [x] Return subtotals and total before tax
- [x] **GET /api/health** - Health check endpoint
  - [x] Check Chargebee connectivity
  - [x] Check Stripe connectivity  
  - [x] Check Avalara connectivity

**✅ API Endpoints Results Summary:**
- **GET /api/pricing**: Fully functional hybrid pricing (1-year from Chargebee, 3-year from static data)
- **POST /api/estimate**: Complete volume tier calculations, package pricing, API call pricing
- **GET /api/health**: Service status monitoring for all external integrations
- **Hybrid Strategy**: Successfully merges real-time Chargebee pricing with static 3-year pricing
- **Caching**: 1-hour TTL implemented for Chargebee data with graceful fallback
- **Testing**: All endpoints tested and verified working with realistic scenarios

### 💰 Payment Integration
**Priority: High | Status: Not Started**

#### Task 1.5: Stripe Integration
- [ ] Implement Stripe client wrapper
- [ ] Create payment intent creation via Chargebee
- [ ] Handle payment confirmation flow
- [ ] Add proper error handling for payment failures

#### Task 1.6: Tax Calculation (Mock Implementation)
- [ ] **POST /api/taxes** - Tax calculation endpoint
  - [ ] Implement mock tax calculation service (using Phase 0 mock)
  - [ ] Handle multiple currencies (USD, EUR, AUD, CAD, GBP)
  - [ ] Accept customer addresses and return appropriate tax rates
  - [ ] Return detailed tax breakdown (federal, state/provincial, local where applicable)
  - [ ] Add feature flag for future Avalara integration
  - [ ] Document tax calculation logic and rates used

#### Task 1.7: Webhook Infrastructure & Monitoring
- [ ] **POST /api/webhooks/chargebee** - Chargebee webhook endpoint
  - [ ] Implement webhook signature verification for security
  - [ ] Log important subscription events (created, modified, cancelled, reactivated)
  - [ ] Log payment events (successful, failed, refunded)
  - [ ] Log customer events (created, modified)
  - [ ] Extract and log key details (customer_id, subscription_id, event_type, timestamp)
  - [ ] Implement proper error handling and response codes (200/4xx/5xx)
  - [ ] Add idempotency handling for duplicate webhook deliveries
  - [ ] Implement webhook delivery failure monitoring and alerting
- [ ] **POST /api/webhooks/stripe** - Stripe webhook endpoint (future)
  - [ ] Placeholder for future Stripe webhook handling
  - [ ] Log payment intent events for monitoring

### 🛒 Checkout Implementation  
**Priority: High | Status: Not Started**

#### Task 1.8: Customer & Subscription Management
- [ ] **POST /api/checkout** - Complete checkout flow (1-year terms only)
  - [ ] Validate customer information
  - [ ] **Reject 3-year terms** with sales contact error response
  - [ ] Create Chargebee customer (1-year only)
  - [ ] Create subscription with base plan and addons (using discovered structure)
  - [ ] Process payment via Stripe through Chargebee
  - [ ] Handle payment success/failure scenarios
  - [ ] Return appropriate response for frontend

#### Task 1.9: Webhook Configuration (After API Endpoints Ready)
- [ ] **Chargebee Webhook Setup** - Configure after Task 1.7 completion
  - [ ] Deploy webhook endpoints to accessible URL (staging/production)
  - [ ] Configure webhook URLs in Chargebee admin panel
    - [ ] Add webhook URL for subscription events
    - [ ] Add webhook URL for payment events  
    - [ ] Add webhook URL for customer events
  - [ ] Test webhook delivery with test events
  - [ ] Verify webhook signature verification is working
- [ ] **Stripe Webhook Setup** (if needed)
  - [ ] Configure Stripe webhook endpoints if required
  - [ ] Test payment intent webhook delivery

---

## Phase 2: Frontend Integration

### 🎨 Frontend Updates
**Priority: High | Status: Not Started**

#### Task 2.1: Service Layer Updates
- [ ] Update `PricingService` to call backend APIs instead of static data
- [ ] Implement error handling with fallback to cached data
- [ ] Add loading states for all API calls
- [ ] Implement retry logic for failed requests

#### Task 2.2: Pricing Page Integration
- [ ] Update pricing page to fetch data from `/api/pricing`
- [ ] Handle loading states and errors gracefully
- [ ] Ensure pricing cards display current Chargebee data
- [ ] Maintain existing navigation to calculator

#### Task 2.3: Calculator Page Integration  
- [ ] Integrate with `/api/estimate` for real-time pricing
- [ ] Update quantity change handlers to call estimate API
- [ ] Display volume tier information from Chargebee
- [ ] Handle addon selection constraints (1 PDF max, 1 Sign max)
- [ ] Update "Add to Cart" to store proper addon IDs

#### Task 2.4: Cart Page Integration
- [ ] Update cart calculations to use `/api/estimate`
- [ ] Add tax calculation integration with `/api/taxes`
- [ ] Update cart totals to show subtotal, tax, and total
- [ ] Maintain cart data in browser session storage

### 🔄 Checkout Flow Implementation
**Priority: High | Status: Not Started**

#### Task 2.5: Checkout Page Creation
- [ ] Create new checkout component with customer information form
  - [ ] Email field (required)
  - [ ] Company name field
  - [ ] Billing address form (line1, city, state, zip, country)
  - [ ] Form validation with inline error messages
- [ ] **3-Year Term Handling**: Show "Contact Sales" popup instead of payment processing
  - [ ] Detect 3-year term selection
  - [ ] Display contact sales modal with hi@test.com
  - [ ] Prevent payment form from showing for 3-year terms
- [ ] **1-Year Term Processing**: Normal checkout flow
  - [ ] Integrate Stripe Elements for payment collection
  - [ ] Connect to `/api/checkout` endpoint
  - [ ] Handle payment processing with proper loading states
  - [ ] Implement proper error handling and user feedback

#### Task 2.6: Contact Sales Modal & Success Pages
- [ ] **Create Contact Sales Modal Component**
  - [ ] Modal dialog for 3-year pricing contact
  - [ ] Display contact email: hi@test.com
  - [ ] Include estimated pricing summary
  - [ ] Professional messaging about sales-assisted process
  - [ ] Close modal and return to cart functionality
- [ ] Create success page component for completed purchases (1-year only)
- [ ] Create error handling for payment failures
- [ ] Implement proper navigation flows
- [ ] Add basic order confirmation details

---

## Phase 3: Testing & Deployment

### 🧪 Testing & Quality Assurance
**Priority: Medium | Status: Not Started**

#### Task 3.1: Backend Testing
- [ ] Unit tests for all API endpoints
- [ ] Integration tests with Chargebee test environment
- [ ] Mock tests for external service failures
- [ ] Load testing for pricing endpoint caching
- [ ] Error scenario testing (API failures, network issues)

#### Task 3.2: Frontend Testing
- [ ] Update existing component tests for new service integrations
- [ ] E2E testing for complete checkout flow (1-year terms)
- [ ] **3-Year Pricing Flow Testing**
  - [ ] Test 3-year pricing display and calculations work correctly
  - [ ] Test contact sales modal appears for 3-year checkout attempts
  - [ ] Verify no payment processing occurs for 3-year terms
- [ ] Cross-browser testing for payment processing
- [ ] Mobile responsiveness testing
- [ ] Test error handling and fallback scenarios

#### Task 3.3: Integration Testing
- [ ] Test complete user journey from pricing to payment (1-year terms)
- [ ] **Test 3-year pricing flow**: Display → Calculation → Contact Sales redirect
- [ ] Validate Chargebee subscription creation (1-year only)
- [ ] Test Stripe payment processing in test mode
- [ ] Verify tax calculation accuracy
- [ ] Test multi-currency support
- [ ] **Validate backend properly rejects 3-year checkout attempts**

### 🚀 Deployment & Production
**Priority: Medium | Status: Not Started**

#### Task 3.4: Deployment Setup
- [ ] Set up Heroku app for backend API
- [ ] Configure environment variables for production
- [ ] Set up CI/CD pipeline for automated deployments
- [ ] Configure monitoring and logging
- [ ] Set up health check monitoring

#### Task 3.5: Production Cutover
- [ ] Deploy backend API to production
- [ ] Update frontend to use production API endpoints
- [ ] Test complete flow in production environment
- [ ] Monitor for any issues post-deployment
- [ ] Update documentation and runbooks

---

## Backlog: Future Enhancements

### 📋 Phase 4: Extended Features (Future)
**Priority: Low | Status: Backlog**

#### Enhanced Billing Features
- [ ] Monthly and 3-year billing term support
- [ ] Promotional codes and discount handling
- [ ] Free trial functionality implementation
- [ ] Advanced tax exempt customer handling

#### Real Avalara Integration (When Sandbox Available)
- [ ] Set up Avalara sandbox account and API credentials
- [ ] Configure tax calculation settings
  - [ ] Set up tax jurisdictions for supported countries
  - [ ] Configure product tax codes for software subscriptions
  - [ ] Set up currency handling for international transactions
- [ ] Replace mock tax service with real Avalara integration
- [ ] Add address validation capabilities
- [ ] Test tax calculation accuracy with real scenarios
- [ ] Update feature flag to enable real Avalara

#### User Experience Improvements  
- [ ] PDF quote generation
- [ ] Quote sharing capabilities
- [ ] Save quotes for later functionality
- [ ] Enhanced mobile checkout experience

#### Administrative Features
- [ ] Admin interface for pricing management
- [ ] Webhook handling for subscription lifecycle events
- [ ] Analytics and reporting dashboard
- [ ] Customer management interface

#### Advanced Integrations
- [ ] CRM/sales tool integration
- [ ] SSO integration for enterprise customers
- [ ] Address validation with Avalara
- [ ] 3D Secure authentication for payments
- [ ] Advanced fraud detection

#### Compliance & Security
- [ ] SOC2 compliance implementation
- [ ] GDPR compliance features
- [ ] Enhanced security monitoring
- [ ] Audit logging and compliance reporting

---

## Dependencies & Blockers

### External Dependencies
- [ ] **Chargebee test environment access and API verification** ⚠️ CRITICAL
- [x] **Stripe test account connected to Chargebee** ✅ COMPLETED  
- [ ] **Avalara test account setup** 🔄 FUTURE (Mock implementation ready)
- [ ] Heroku deployment environment setup
- [ ] **Chargebee product discovery and documentation** ⚠️ BLOCKS DEVELOPMENT

### Technical Dependencies
- [ ] Scala/Pekko-HTTP project template
- [ ] Frontend build process updates for API integration
- [ ] Environment configuration management
- [ ] SSL certificate setup for production

### Business Dependencies
- [ ] **Chargebee product configuration discovery and validation** ⚠️ CRITICAL
- [ ] Final approval on checkout flow UX
- [ ] Tax jurisdiction requirements validation (mock implementation ready)
- [ ] Production environment provisioning approval
- [ ] **Webhook URL configuration in external services** 🔄 AFTER API ENDPOINTS READY

---

## Risk Assessment

### High Risk Items
- **Chargebee Addon Constraints**: Need to ensure frontend properly validates single PDF/Sign addon selection
- **Payment Flow Complexity**: Coordinating Chargebee subscription creation with Stripe payment processing
- **Tax Calculation**: Ensuring accurate tax calculation across multiple currencies and jurisdictions

### Medium Risk Items  
- **API Performance**: Caching strategy effectiveness for pricing data
- **Error Handling**: Graceful degradation when external services are unavailable
- **Mobile Experience**: Ensuring smooth checkout flow on mobile devices

### Mitigation Strategies
- Extensive testing in Chargebee test environment before production
- Implement comprehensive fallback mechanisms for all external API calls
- Mobile-first approach for checkout page development
- Staged rollout with feature flags for production deployment

---

## Success Metrics

### Technical Metrics
- [ ] API response times < 500ms for cached pricing data
- [ ] Payment success rate > 95%
- [ ] Zero data loss during checkout process
- [ ] 99.9% uptime for pricing and checkout APIs

### Business Metrics
- [ ] Successful replacement of static pricing with dynamic Chargebee data
- [ ] Functional end-to-end checkout with payment processing
- [ ] Accurate tax calculation for all supported currencies
- [ ] Zero customer-facing errors during checkout process

### User Experience Metrics
- [ ] Checkout completion rate improvement over current static implementation
- [ ] Reduced support tickets related to pricing discrepancies
- [ ] Mobile checkout completion rate > 80%
- [ ] Average checkout time < 3 minutes

---

## Notes & Considerations

### Development Notes
- All monetary calculations should use decimal precision to avoid floating-point errors
- Implement idempotency for all payment-related API calls
- Log all external API interactions for debugging and monitoring
- Use feature flags for gradual rollout of new functionality

#### Tax Calculation Implementation Strategy
- **Phase 1**: Use mock tax service with configurable rates
  - US: Federal (0%) + State (varies, default 8.5%)
  - Canada: GST/HST (5-15% depending on province)
  - UK: VAT (20%)
  - Australia: GST (10%)
  - EU: VAT (varies by country, default 20%)
- **Phase 2**: Replace with real Avalara when sandbox is available
- **Feature Flag**: `USE_REAL_AVALARA` to switch between mock and real service

### Business Notes
- Remove PDF Enterprise from all frontend displays as it's no longer offered
- Ensure pricing display matches Chargebee configuration exactly (1-year terms)
- Maintain 3-year pricing from existing pricing-data.json file
- Consider user notification for any pricing changes during session
- Plan for future expansion to additional billing terms and promotional features
- **Hybrid Pricing Strategy**: 
  - **1-Year Terms**: Real-time pricing from Chargebee APIs
  - **3-Year Terms**: Static pricing from pricing-data.json file
  - Display both pricing options normally throughout the application
  - Allow price calculations and estimates for both terms
  - Redirect to sales contact (hi@test.com) at checkout for 3-year terms
  - Only process automated checkout for 1-year terms

---

**Last Updated:** June 9, 2025
**Next Review:** Weekly during active development  
**Project Lead:** Development Team
**Stakeholders:** Product, Engineering, Finance
