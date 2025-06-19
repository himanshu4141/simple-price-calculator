export const environment = {
  production: true,
  // Backend API URL - using same-origin proxy to avoid CORS
  apiUrl: '/api',  // Proxied through nginx to avoid CORS
  pricingDataUrl: 'assets/pricing-data.json', // Fallback static data path
  stripe: {
    // Stripe test publishable key for test environment deployment
    publishableKey: 'pk_test_8Wd4WCLUXl1N7vEOu77Ah96g',
    environment: 'test' // Using test environment for this deployment
  }
};