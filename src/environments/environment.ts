export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081/api', // Backend API URL
  pricingDataUrl: 'assets/pricing-data.json', // Fallback static data path
  stripe: {
    publishableKey: 'pk_test_8Wd4WCLUXl1N7vEOu77Ah96g', // Replace with your actual Stripe test publishable key
    environment: 'test'
  }
};