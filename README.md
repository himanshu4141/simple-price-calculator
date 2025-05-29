# Simple Price Calculator

This project is an Angular application designed to provide a simple price calculator for Nitro PDF and Nitro Sign products. It allows users to view pricing information, select plans, and calculate total subscription prices based on their input.

## Project Structure

The project is organized as follows:

- `src/app`: Contains the main application code.
  - `components`: Contains the various components of the application.
    - `pricing-page`: Displays pricing information for Nitro products.
    - `cart-page`: Manages the selection of plans and displays the cart summary.
    - `price-calculator`: Contains logic for calculating final pricing based on user inputs.
  - `models`: Contains TypeScript interfaces and types related to pricing models.
  - `services`: Contains services for fetching pricing data and calculating prices.
  - `app.module.ts`: The main module of the application.
  - `app.component.ts`: The root component of the application.

- `src/assets`: Contains static assets such as images or additional JSON files for configuration.

- `src/environments`: Contains environment-specific settings for development and production.

- `src/index.html`: The main HTML file that serves as the entry point for the application.

## Features

- **Pricing Page**: Displays detailed pricing information for Nitro PDF and Nitro Sign products.
- **Cart Page**: Allows users to select plans and view a summary of their selections.
- **Price Calculator**: Calculates the total subscription price based on user input for seats, packages, and API calls.

## Getting Started

To run the application locally, follow these steps:

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd simple-price-calculator
   ```

3. Install the dependencies:
   ```
   npm install
   ```

4. Start the development server:
   ```
   ng serve
   ```

5. Open your browser and navigate to `http://localhost:4200`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.