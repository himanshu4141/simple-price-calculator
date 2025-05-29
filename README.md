# Simple Price Calculator

A modern Angular app for calculating and comparing subscription pricing for Nitro PDF and Nitro Sign products. Built with Angular Material and deployed to GitHub Pages.

## Features

- **Pricing Page**: View all available plans for Nitro PDF and Nitro Sign, with ramp-based pricing and feature breakdowns.
- **Cart Page**: Select plans and independently set seat/package/API quantities for each product family. See a live summary and total.
- **Price Calculator**: Interactive calculator with sliders for seats, packages, and API calls. Shows detailed price breakdown and supports both 1-year and 3-year terms.
- **Consistent UI**: Uses Angular Material for a modern, responsive, and accessible interface.
- **Robust Logic**: All pricing logic is shared and robust, with correct handling of free packages, ramp pricing, and term selection.
- **CI/CD**: Automatic deployment to GitHub Pages on every push to `main` (or `master`) via GitHub Actions.

## Live Demo

[View the latest deployed app on GitHub Pages](https://himanshu4141.github.io/simple-price-calculator/)

## Getting Started

To run the application locally:

1. **Clone the repository:**
   ```sh
   git clone https://github.com/himanshu4141/simple-price-calculator.git
   cd simple-price-calculator
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Start the development server:**
   ```sh
   ng serve
   ```
4. **Open your browser:**
   Visit [http://localhost:4200](http://localhost:4200)

## Deployment

This project is automatically deployed to GitHub Pages on every push to the `main` branch using GitHub Actions.

To deploy manually:
```sh
ng deploy --base-href=/simple-price-calculator/
```

## Project Structure

- `src/app/components/` — Main UI components (pricing-page, cart-page, price-calculator)
- `src/assets/pricing-data.json` — All pricing and plan configuration
- `src/app/services/pricing.service.ts` — Shared pricing logic
- `.github/workflows/deploy.yml` — GitHub Actions workflow for CI/CD

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

MIT License. See the LICENSE file for details.