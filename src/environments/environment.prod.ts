export const environment = {
  production: true,
  apiUrl: 'https://api.nitro-price-calculator.com/api', // Production API URL
  pricingDataUrl: 'assets/pricing-data.json', // Fallback static data path
  stripe: {
    publishableKey: 'YOUR_ACTUAL_STRIPE_LIVE_PUBLISHABLE_KEY_HERE', // Replace with your actual Stripe live publishable key
    environment: 'live'
  }
};