export const environment = {
  production: true,
  // Backend API URL for Render deployment
  apiUrl: 'https://nitro-price-calculator-api.onrender.com/api',
  pricingDataUrl: 'assets/pricing-data.json', // Fallback static data path
  stripe: {
    // Stripe test publishable key for test environment deployment
    publishableKey: 'pk_test_8Wd4WCLUXl1N7vEOu77Ah96g',
    environment: 'test' // Using test environment for this deployment
  }
};