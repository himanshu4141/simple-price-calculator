# Environment Variables Reference

This document lists all environment variables needed for deploying the Nitro Price Calculator to Render.

## 📋 **Environment Variables Setup**

### **Backend Service Environment Variables**

#### **Public Variables** (can be set in render.yaml)
```bash
# Server Configuration
PORT=8080
ENVIRONMENT=production
JAVA_OPTS=-Xmx512m -Xms256m -XX:+UseG1GC -Dfile.encoding=UTF-8

# Chargebee Configuration (non-sensitive)
CHARGEBEE_SITE=nitro-ubb-test
CHARGEBEE_GATEWAY_ACCOUNT_ID=gw_BTU37EUmr7R4M6lX

# Stripe Configuration (public key)
STRIPE_PUBLIC_KEY=pk_test_8Wd4WCLUXl1N7vEOu77Ah96g

# Feature Flags
AVALARA_ENABLED=false
FEATURES_ENABLE_WEBHOOKS=true
FEATURES_ENABLE_3YEAR_CHECKOUT=false
```

#### **Secret Variables** (must be set manually in Render dashboard)
```bash
# Chargebee Secrets
CHARGEBEE_API_KEY=the api key

# Stripe Secrets
STRIPE_SECRET_KEY=sk_....
STRIPE_WEBHOOK_SECRET=whsec_...
```

### **Frontend Service Environment Variables**

#### **Public Variables** (can be set in render.yaml)
```bash
# Build Configuration
NODE_ENV=production

# Backend API URL
API_BASE_URL=https://nitro-price-calculator-api.onrender.com

# Stripe Frontend Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_8Wd4WCLUXl1N7vEOu77Ah96g
```

## 🔐 **Secret Variables Setup in Render Dashboard**

When deploying to Render, you'll need to manually set these secret environment variables in the Render dashboard:

### **For Backend Service:**
1. Go to your backend service in Render dashboard
2. Navigate to "Environment" tab
3. Add these secret variables:

| Variable Name | Value | Notes |
|---------------|-------|-------|
| `CHARGEBEE_API_KEY` | `test_...` | Chargebee test API key |
| `STRIPE_SECRET_KEY` | `sk_test_sk_...` | Stripe test secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec....` | Stripe webhook secret |

### **For Frontend Service:**
Frontend service only uses public variables which are already defined in render.yaml.

## 🎯 **Test Environment Configuration**

This deployment uses **test environment** credentials:

- **Chargebee**: `nitro-ubb-test` site with test API keys
- **Stripe**: Test mode keys (`pk_test_*` and `sk_test_*`)
- **Webhooks**: Test webhook endpoints

## 🔄 **Environment Variable Validation**

### **Backend Health Check**
The backend `/api/health` endpoint validates:
- Chargebee connectivity using `CHARGEBEE_API_KEY`
- Stripe connectivity using `STRIPE_SECRET_KEY`
- All required environment variables are present

### **Frontend Configuration**
The frontend validates:
- Backend API connectivity via `API_BASE_URL`
- Stripe Elements initialization via `STRIPE_PUBLISHABLE_KEY`

## 📝 **Production Notes**

### **For Live Production Deployment:**
1. Replace test Stripe keys with live keys
2. Update Chargebee to production site
3. Configure live webhook endpoints
4. Update `environment.prod.ts` with live configuration
5. Set `FEATURES_ENABLE_WEBHOOKS=true` for production monitoring

### **Security Best Practices:**
- Never commit secret keys to Git repository
- Use Render's secret environment variables for all sensitive data
- Regularly rotate API keys
- Monitor webhook delivery for production deployments

## 🚀 **Deployment Checklist**

- [ ] Backend secrets added to Render dashboard
- [ ] Frontend API URL points to deployed backend
- [ ] Stripe publishable key matches secret key environment
- [ ] Chargebee site matches API key environment
- [ ] Health checks pass for both services
- [ ] Payment flow tested end-to-end
