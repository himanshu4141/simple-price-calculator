# Avalara Integration Plan - Nitro Price Calculator

## 📋 **Project Overview**
Integrate Avalara AvaTax with Nitro Price Calculator for accurate tax calculations in US and UK markets, with primary focus on Chargebee integration for payment processing.

**Current Status**: Phase 1B - Chargebee Tax Configuration Complete ✅  
**Target Completion**: Phase 1B Complete, Phase 2 (Backend Direct API) Ready  
**Priority**: High (Required for accurate payment processing)

---

## 🤔 **Discovery Questions & Answers**

### **1. Avalara Sandbox Credentials**
- **Question**: Do you have your sandbox credentials ready? (Account ID, License Key)
- **Answer**: 
  - ✅ **Account ID**: 2001690981
  - ✅ **License Key**: Redacted  
  - **Status**: Credentials available and verified

### **2. US Tax Nexus**
- **Question**: Which US states does Nitro have tax nexus in?
- **Answer**: ✅ US nexus configured for 42 states including major states (CA, NY, TX, etc.)
- **Status**: Avalara sandbox configured with comprehensive US nexus

### **3. UK VAT Registration**
- **Question**: Is Nitro registered for UK VAT?
- **Answer**: ✅ Yes, Nitro is UK VAT registered
- **Action Required**: Configure UK VAT in sandbox to mimic production setup

### **4. Product Classification**
- **Question**: How should we classify Nitro PDF vs Nitro Sign for tax purposes?
- **Answer**: ✅ Both as "software subscriptions"
- **Action Required**: Map to appropriate Avalara tax codes for software/SaaS

### **5. Tax Exemptions**
- **Question**: Do you need to handle tax-exempt customers?
- **Answer**: ❌ Ignore for now, add to future enhancements
- **Action Required**: Document as Phase 2 feature

### **6. Integration Priority**
- **Question**: Chargebee vs Direct API integration priority?
- **Answer**: ✅ **Chargebee integration FIRST** - required for payment processing
- **Rationale**: Chargebee estimate API used in checkout flow, must have accurate taxes

---

## 🎯 **Revised Implementation Strategy**

**Priority Order**:
1. 🔥 **CRITICAL**: Chargebee-Avalara integration (enables accurate payment processing)
2. 🔧 **SECONDARY**: Direct API integration (for enhanced tax display)
3. 🎨 **ENHANCEMENT**: Frontend tax breakdown improvements

---

## 📅 **Phase-by-Phase Plan**

### **Phase 1A: Avalara Sandbox Setup** ⏳ **CURRENT**

#### **Step 1.1: Locate Sandbox Credentials**
- [x] **Find License Key**
  - Login to Avalara sandbox dashboard
  - Navigate to Settings → License Keys or Account Settings
  - Document Account ID and License Key
  - Test basic API connectivity

#### **Step 1.2: Configure Blank Sandbox**
Since this is a blank sandbox, we need to set everything up:

- [x] **Company Profile Setup**
  - Create "Nitro Software" company profile
  - Set primary business address
  - Configure as software/SaaS business type

- [x] **US Tax Nexus Configuration**
  - **Research**: Determine Nitro's actual US nexus (or use common states for testing)
  - **Configure**: Add nexus for testing states (CA, NY, TX as starting point)
  - **Test**: Verify nexus is working with sample calculations

- [x] **UK VAT Setup**
  - Configure UK VAT registration
  - Set up digital services VAT rules
  - Test UK VAT calculations

#### **Step 1.3: Product Tax Codes**
- [x] **Software Subscription Classification**
  - Research appropriate Avalara tax codes for software subscriptions
  - Create/configure tax codes for:
    - Nitro PDF subscription
    - Nitro Sign subscription
    - Add-on packages
  - Test tax code application

---

## ✅ PHASE 1A COMPLETE: Avalara Sandbox Setup

- Company profile created (Nitro Software)
- Nexus configured for US (42 states), UK, and EU
- Products (Nitro PDF, Nitro Sign) added and mapped to software/SaaS tax codes
- Tax calculator tested for US and UK addresses (results correct)

**Next Step:**

---

## 🚀 PHASE 1B: Chargebee-Avalara Integration (CRITICAL)

1. Go to Chargebee admin → Settings → Tax Settings
2. Enable Avalara AvaTax integration
3. Enter your Avalara sandbox Account ID and License Key
4. Map Chargebee products to Avalara tax codes (match what you set in Avalara)
5. Test Chargebee estimate API for US and UK addresses
6. Confirm tax amounts match Avalara sandbox calculations

**If you need help with any Chargebee step, let me know!**

---

## 🎯 **Revised Implementation Strategy**

**Priority Order**:
1. 🔥 **CRITICAL**: Chargebee-Avalara integration (enables accurate payment processing)
2. 🔧 **SECONDARY**: Direct API integration (for enhanced tax display)
3. 🎨 **ENHANCEMENT**: Frontend tax breakdown improvements

---

## 📅 **Phase-by-Phase Plan**

### **Phase 1B: Chargebee-Avalara Integration** 🔥 **CRITICAL**

#### **Step 1.4: Chargebee Tax Settings**
- [ ] **Enable Avalara in Chargebee**
  - Access Chargebee admin → Settings → Tax Settings
  - Configure Avalara AvaTax integration
  - Enter sandbox credentials (Account ID + License Key)
  - Test connection

#### **Step 1.5: Product Mapping in Chargebee**
- [ ] **Map Chargebee Items to Tax Codes**
  - Map each Chargebee product item to Avalara tax codes
  - Configure tax behavior for subscription items
  - Set up addon tax classification
  - Test tax calculation in Chargebee estimates

#### **Step 1.6: Test Chargebee Tax Flow**
- [ ] **Validate Tax Calculations**
  - Create test estimate for US customer (CA address)
  - Create test estimate for UK customer
  - Verify tax amounts are calculated correctly
  - Compare with expected tax rates

### **Phase 2: Backend Direct Integration** 🔧 **SECONDARY**

#### **Step 2.1: Add Avalara SDK**
- [ ] **Dependencies & Configuration**
  - Add Avalara REST SDK to `build.sbt`
  - Update environment configuration
  - Create AvalaraClient service
  - Add feature flag for mock vs real

#### **Step 2.2: Implement Real Tax Service**
- [ ] **Replace Mock Implementation**
  - Update TaxCalculationService to call Avalara
  - Implement address validation
  - Add detailed tax breakdown support
  - Maintain fallback to mock on failures

#### **Step 2.3: Integration Testing**
- [ ] **Validate Accuracy**
  - Compare direct API results with Chargebee results
  - Test various US states and UK addresses
  - Verify edge case handling

### **Phase 3: Frontend Enhancements** 🎨 **FUTURE**

#### **Step 3.1: Enhanced Tax Display**
- [ ] **Detailed Tax Breakdown UI**
  - Show jurisdiction-specific taxes
  - Display Avalara tax details
  - Add address validation feedback

---

## ✅ PHASE 1B COMPLETE: Chargebee-Avalara Integration

### **Chargebee Configuration Verified:**
- ✅ **Product Catalog Discovery**: All products and item prices have `"is_taxable": true`
- ✅ **Tax Code Mapping**: Products are mapped to Avalara tax codes in Chargebee
- ✅ **Multi-Currency Support**: USD, EUR, GBP, CAD, AUD all configured with tax settings
- ✅ **Volume Tier Pricing**: Complex pricing tiers working with tax calculation

### **Products Successfully Configured:**
- **Nitro PDF Standard**: Item prices for all currencies with tax enabled
- **Nitro Sign Standard**: Item prices for all currencies with tax enabled  
- **Subscription Plans**: Base subscription container with tax enabled
- **All Item Prices**: Show `"is_taxable": true` in Chargebee discovery

### **Next Step: Phase 2 - Backend Direct Avalara Integration**

---

## 🔧 **Technical Specifications**

### **Environment Configuration**
```bash
# Sandbox Configuration
AVALARA_ACCOUNT_ID=your_sandbox_account_id
AVALARA_LICENSE_KEY=your_sandbox_license_key  # TO BE FOUND
AVALARA_BASE_URL=https://sandbox-rest.avatax.com
AVALARA_ENABLED=true

# Production (Future)
AVALARA_ACCOUNT_ID=your_production_account_id
AVALARA_LICENSE_KEY=your_production_license_key
AVALARA_BASE_URL=https://rest.avatax.com
```

### **Tax Code Mapping Strategy**
```
Nitro PDF Products → Software/SaaS Tax Code (TBD)
Nitro Sign Products → Software/SaaS Tax Code (TBD)
Packages/Add-ons → Digital Services Tax Code (TBD)
```

### **Nexus Configuration (Starting Point)**
```
US States: CA, NY, TX (expand based on research)
UK: VAT registered for digital services
```

---

## ⚠️ **Immediate Action Items**

### **For You (User)**
1. **Find License Key**: Login to Avalara sandbox → Settings → License Keys
2. **Research Nexus**: Determine which US states Nitro should collect tax in
3. **UK VAT Details**: Confirm UK VAT registration number and requirements

### **Next Steps After Credentials**
1. Complete sandbox company setup
2. Configure basic nexus and tax codes
3. Test Chargebee-Avalara connection
4. Validate tax calculations

---

## 📊 **Success Metrics**

### **Phase 1 Success Criteria**
- [ ] Chargebee estimates return accurate tax calculations
- [ ] US state tax calculated correctly
- [ ] UK VAT calculated correctly
- [ ] Tax amounts match expected rates

### **Phase 2 Success Criteria**
- [ ] Direct API tax calculations match Chargebee
- [ ] Fallback to mock works on API failures
- [ ] Performance acceptable (<500ms for tax calls)

---

## 🚨 **Risk Assessment**

### **High Risk**
- **Chargebee Integration Complexity**: First time setup may have unexpected issues
- **Tax Configuration**: Incorrect setup could result in wrong tax collection

### **Medium Risk**
- **Sandbox Limitations**: May not perfectly mirror production behavior
- **Performance**: Additional API calls may slow checkout process

### **Mitigation Strategies**
- **Extensive Testing**: Test with various addresses and scenarios
- **Fallback Mechanism**: Maintain mock tax service as backup
- **Monitoring**: Log all tax calculations for audit trail

---

**Last Updated**: June 20, 2025  
**Next Review**: After Phase 1A completion  
**Document Owner**: Development Team
