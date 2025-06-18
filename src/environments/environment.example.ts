// Environment configuration template
// Copy this file to environment.ts and environment.prod.ts and fill in your actual keys

export const environment = {
  production: false, // Set to true for production
  apiUrl: 'http://localhost:8080/api', // Backend API URL
  pricingDataUrl: 'assets/pricing-data.json', // Fallback static data path
  stripe: {
    // Get your keys from: https://dashboard.stripe.com/developers/apikeys
    publishableKey: 'pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', // Your Stripe test publishable key
    environment: 'test' // 'test' for development, 'live' for production
  },
  chargebee: {
    // These will be configured on the backend
    // site: 'your-chargebee-site',
    // apiKey: 'configured-on-backend-only'
  }
};
