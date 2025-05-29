export interface RampPrice {
  minSeats: number;
  price: number;
}

export interface Plan {
  name: string;
  description: string;
  features: string[];
  oneYearPricing: RampPrice[];
  threeYearPricing: RampPrice[];
  packagePrice?: number;  // Price per package beyond free tier
  apiPrice?: number;      // Price per API call
  freePackagesPerSeat?: number;  // Number of free packages per seat
}

export interface ProductFamily {
  name: string;
  description: string;
  plans: Plan[];
}

export interface CartItem {
  productFamily: string;
  planName: string;
  seats: number;
  packages?: number;
  apiCalls?: number;
  term: '1year' | '3year';
  price: number;
}