# Render Deployment Guide

This guide walks you through deploying the Nitro Price Calculator to Render.com with both frontend and backend services.

## 🚀 **Quick Deployment Overview**

### **Architecture on Render**
- **Frontend**: Angular app served via nginx (containerized)
- **Backend**: Scala API server (containerized)  
- **Database**: Not required (using external APIs)
- **Cost**: Free tier for both services

### **Services Created**
1. `nitro-price-calculator-frontend` - Angular frontend
2. `nitro-price-calculator-api` - Scala backend API

---

## 📋 **Step-by-Step Deployment**

### **Step 1: Prepare Your Repository**
```bash
# Ensure all files are committed
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

### **Step 2: Create Render Account**
1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Connect your GitHub repository

### **Step 3: Deploy Backend Service**
1. **Create New Web Service**:
   - Repository: `your-username/simple-price-calculator`
   - Branch: `main`
   - Root Directory: `backend`
   - Runtime: `Docker`
   - Dockerfile Path: `./Dockerfile`

2. **Service Configuration**:
   - Name: `nitro-price-calculator-api`
   - Region: `Oregon (US West)`
   - Plan: `Free`
   - Auto-Deploy: `Yes`

3. **Environment Variables** (Set in Render Dashboard):
   ```
   PORT=8080
   ENVIRONMENT=production
   JAVA_OPTS=-Xmx512m -Xms256m -XX:+UseG1GC -Dfile.encoding=UTF-8
   
   # Chargebee Test Environment
   CHARGEBEE_SITE=nitro-ubb-test
   CHARGEBEE_API_KEY=test_... (SECRET)
   CHARGEBEE_GATEWAY_ACCOUNT_ID=gw_BTU37EUmr7R4M6lX
   
   # Stripe Test Environment
   STRIPE_PUBLIC_KEY=pk_test_8Wd4WCLUXl1N7vEOu77Ah96g
   STRIPE_SECRET_KEY=sk_test_... (SECRET)
   STRIPE_WEBHOOK_SECRET=whsec_... (SECRET)
   
   # Feature Flags
   AVALARA_ENABLED=false
   FEATURES_ENABLE_WEBHOOKS=true
   FEATURES_ENABLE_3YEAR_CHECKOUT=false
   ```

4. **Health Check**: `/api/health`

### **Step 4: Deploy Frontend Service**
1. **Create New Web Service**:
   - Repository: `your-username/simple-price-calculator`
   - Branch: `main`
   - Root Directory: `/` (project root)
   - Runtime: `Docker`
   - Dockerfile Path: `./Dockerfile`

2. **Service Configuration**:
   - Name: `nitro-price-calculator-frontend`
   - Region: `Oregon (US West)`
   - Plan: `Free`
   - Auto-Deploy: `Yes`

3. **Environment Variables**:
   ```
   NODE_ENV=production
   API_BASE_URL=https://nitro-price-calculator-api.onrender.com
   STRIPE_PUBLISHABLE_KEY=pk_test_8Wd4WCLUXl1N7vEOu77Ah96g
   ```

4. **Health Check**: `/health`

### **Step 5: Update Frontend Configuration**
After backend is deployed, update your Angular environment files with the backend URL:

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://nitro-price-calculator-api.onrender.com',
  stripePublishableKey: 'pk_test_...' // Your Stripe publishable key
};
```

---

## 🔧 **Configuration Details**

### **Backend Service Configuration**
- **Build Time**: ~5-10 minutes (SBT compilation)
- **Memory**: 512MB (free tier limit)
- **Startup Time**: ~60 seconds
- **Health Check**: Automatically configured
- **Logs**: Available in Render dashboard

### **Frontend Service Configuration**
- **Build Time**: ~3-5 minutes (npm build + nginx)
- **Memory**: 256MB 
- **Startup Time**: ~30 seconds
- **Static Assets**: Served via nginx with caching
- **SPA Routing**: Configured for Angular router

### **Environment Variables Setup**

#### **Backend (API) Environment Variables**:
```bash
# Server Configuration
PORT=8080
ENVIRONMENT=production
JAVA_OPTS=-Xmx512m -Xms256m -XX:+UseG1GC -Dfile.encoding=UTF-8

# Chargebee Test Environment (Required)
CHARGEBEE_SITE=nitro-ubb-test
CHARGEBEE_API_KEY=test_...
CHARGEBEE_GATEWAY_ACCOUNT_ID=gw_BTU37EUmr7R4M6lX

# Stripe Test Environment (Required)
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Avalara Configuration (Optional - using mock by default)
AVALARA_ENABLED=false

# Feature Flags
FEATURES_ENABLE_WEBHOOKS=true
FEATURES_ENABLE_3YEAR_CHECKOUT=false
```

#### **Frontend Environment Variables**:
```bash
# Build Configuration
NODE_ENV=production

# Backend API URL (after backend is deployed)
API_BASE_URL=https://nitro-price-calculator-api.onrender.com

# Stripe Configuration (Frontend)
STRIPE_PUBLISHABLE_KEY=pk_test_8Wd4WCLUXl1N7vEOu77Ah96g
```

---

## 🔍 **Monitoring & Troubleshooting**

### **Health Checks**
- **Backend**: `GET /api/health` (returns service status)
- **Frontend**: `GET /health` (nginx health check)

### **Logs Access**
1. Go to Render Dashboard
2. Select your service
3. Click "Logs" tab for real-time log viewing

### **Common Issues & Solutions**

#### **Backend Build Failures**:
```bash
# If SBT build fails, check:
# 1. Java version compatibility (using OpenJDK 21)
# 2. SBT assembly plugin configuration
# 3. Memory limits during build
```

#### **Frontend Build Failures**:
```bash
# If npm build fails, check:
# 1. Node.js version (using Node 18)
# 2. npm dependencies in package.json
# 3. Angular build configuration
```

#### **Runtime Issues**:
```bash
# Backend not starting:
# 1. Check PORT environment variable
# 2. Verify health check endpoint
# 3. Check application logs for errors

# Frontend not loading:
# 1. Verify nginx configuration
# 2. Check API_BASE_URL environment variable
# 3. Verify CORS settings in backend
```

---

## 🚦 **Deployment Status Monitoring**

### **Expected Deployment Times**
- **Backend**: 8-12 minutes (build + deploy)
- **Frontend**: 5-8 minutes (build + deploy)
- **Total**: ~15-20 minutes for both services

### **Service URLs** (after deployment)
- **Frontend**: `https://nitro-price-calculator-frontend.onrender.com`
- **Backend API**: `https://nitro-price-calculator-api.onrender.com`
- **API Health Check**: `https://nitro-price-calculator-api.onrender.com/api/health`

### **Verification Steps**
1. ✅ Backend health check responds with 200
2. ✅ Frontend loads without errors
3. ✅ Pricing data loads from backend API
4. ✅ Stripe payment form initializes correctly
5. ✅ Test checkout flow works end-to-end

---

## 💡 **Production Optimization Tips**

### **Performance**
- Services auto-sleep after 15 minutes of inactivity (free tier)
- First request after sleep may take 30-60 seconds
- Consider upgrading to paid plan for production use

### **Security**
- All environment variables are encrypted at rest
- HTTPS is automatically provided by Render
- nginx security headers are configured

### **Cost Management**
- Free tier: 750 build hours/month per service
- Monitor usage in Render dashboard
- Upgrade to paid plans for production workloads

---

## 🔄 **Continuous Deployment**

### **Auto-Deploy Setup**
- Enabled by default for `main` branch
- Any push to `main` triggers automatic redeployment
- Build status visible in GitHub commit status

### **Manual Deploy**
- Available via Render dashboard
- Click "Manual Deploy" -> "Deploy latest commit"
- Useful for troubleshooting or rollbacks

---

**🎉 Ready to Deploy!**

Follow these steps and you'll have your full-stack Nitro Price Calculator running on Render with automatic HTTPS, monitoring, and continuous deployment from your Git repository.
