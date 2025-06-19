/**
 * Utility functions for package calculations across the application
 * Uses immutable patterns and pure functions for predictable outcomes
 */

// Constants for better maintainability
export const DEFAULT_FREE_PACKAGES_PER_SEAT = 200;

// Interface for package breakdown result
export interface PackageBreakdown {
  readonly freePackages: number;
  readonly extraPackages: number;
  readonly totalPackages: number;
  readonly freePackagesPerSeat: number;
}

export class PackageCalculations {
  
  /**
   * Pure function - Calculate extra packages that need to be paid for
   * @param signSeats Number of Sign seats
   * @param requestedPackages Total packages requested
   * @param freePackagesPerSeat Free packages included per seat
   * @returns Number of extra packages that need to be paid for
   */
  static calculateExtraPackages(
    signSeats: number, 
    requestedPackages: number, 
    freePackagesPerSeat: number = DEFAULT_FREE_PACKAGES_PER_SEAT
  ): number {
    if (!this.isValidSeatCount(signSeats)) {
      return requestedPackages;
    }
    
    const freePackages = this.calculateFreePackages(signSeats, freePackagesPerSeat);
    return Math.max(0, requestedPackages - freePackages);
  }

  /**
   * Pure function - Calculate total free packages included
   * @param signSeats Number of Sign seats
   * @param freePackagesPerSeat Free packages included per seat
   * @returns Total number of free packages included
   */
  static calculateFreePackages(
    signSeats: number, 
    freePackagesPerSeat: number = DEFAULT_FREE_PACKAGES_PER_SEAT
  ): number {
    if (!this.isValidSeatCount(signSeats)) {
      return 0;
    }
    return signSeats * freePackagesPerSeat;
  }

  /**
   * Pure function - Get comprehensive package breakdown for display
   * @param signSeats Number of Sign seats
   * @param requestedPackages Total packages requested
   * @param freePackagesPerSeat Free packages included per seat
   * @returns Immutable object with complete package breakdown
   */
  static getPackageBreakdown(
    signSeats: number, 
    requestedPackages: number, 
    freePackagesPerSeat: number = DEFAULT_FREE_PACKAGES_PER_SEAT
  ): PackageBreakdown {
    const freePackages = this.calculateFreePackages(signSeats, freePackagesPerSeat);
    const extraPackages = this.calculateExtraPackages(signSeats, requestedPackages, freePackagesPerSeat);
    
    return Object.freeze({
      freePackages,
      extraPackages,
      totalPackages: requestedPackages,
      freePackagesPerSeat
    });
  }

  /**
   * Pure function - Validate seat count
   * @param seatCount Number to validate
   * @returns Whether the seat count is valid
   */
  private static isValidSeatCount(seatCount: number): boolean {
    return Number.isInteger(seatCount) && seatCount > 0;
  }
}
