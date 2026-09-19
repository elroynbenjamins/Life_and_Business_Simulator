import { ImageSourcePropType } from 'react-native';

export const businessTypeImages: Record<string, ImageSourcePropType> = {
  coffee_shop: require('../../assets/pixel-art/businesses/coffee-shop.png'), food_truck: require('../../assets/pixel-art/businesses/food-truck.png'),
  restaurant: require('../../assets/pixel-art/businesses/restaurant.png'), clothing_store: require('../../assets/pixel-art/businesses/clothing-store.png'),
  tech_startup: require('../../assets/pixel-art/businesses/software-company.png'), fitness_gym: require('../../assets/pixel-art/businesses/fitness-gym.png'),
  construction_co: require('../../assets/pixel-art/businesses/construction-company.png'), digital_agency: require('../../assets/pixel-art/businesses/digital-agency.png'),
  pharmacy: require('../../assets/pixel-art/businesses/pharmacy.png'), auto_repair: require('../../assets/pixel-art/businesses/auto-repair.png'),
  real_estate_agency: require('../../assets/pixel-art/businesses/real-estate-agency.png'), bakery: require('../../assets/pixel-art/businesses/bakery.png'),
};

export const disciplineImages: Record<string, ImageSourcePropType> = {
  retail: require('../../assets/pixel-art/disciplines/retail.png'), office: require('../../assets/pixel-art/disciplines/administration.png'),
  administration: require('../../assets/pixel-art/disciplines/administration.png'), sales: require('../../assets/pixel-art/disciplines/sales.png'),
  accounting: require('../../assets/pixel-art/disciplines/finance.png'), finance: require('../../assets/pixel-art/disciplines/finance.png'),
  marketing: require('../../assets/pixel-art/disciplines/marketing.png'), software: require('../../assets/pixel-art/disciplines/technology.png'),
  technology: require('../../assets/pixel-art/disciplines/technology.png'), healthcare: require('../../assets/pixel-art/disciplines/healthcare.png'),
  legal: require('../../assets/pixel-art/disciplines/legal.png'), logistics: require('../../assets/pixel-art/disciplines/logistics.png'),
  hospitality: require('../../assets/pixel-art/disciplines/hospitality.png'),
};

export const employeeRoleImages: Record<string, ImageSourcePropType> = {
  worker: require('../../assets/pixel-art/employees/worker.png'), skilled_worker: require('../../assets/pixel-art/employees/skilled-worker.png'),
  supervisor: require('../../assets/pixel-art/employees/supervisor.png'), manager: require('../../assets/pixel-art/employees/manager.png'),
  specialist: require('../../assets/pixel-art/employees/specialist.png'),
};

export const prestigeImages: Record<string, ImageSourcePropType> = {
  salary_boost: require('../../assets/pixel-art/prestige/salary-boost.png'), study_speed: require('../../assets/pixel-art/prestige/quick-learner.png'),
  starting_cash: require('../../assets/pixel-art/prestige/trust-fund.png'), business_costs: require('../../assets/pixel-art/prestige/cost-cutter.png'),
  skill_growth: require('../../assets/pixel-art/prestige/landlord-pro.png'), loan_rate: require('../../assets/pixel-art/prestige/credit-score.png'),
  deposit_interest: require('../../assets/pixel-art/prestige/deposit-investor.png'), property_income: require('../../assets/pixel-art/prestige/landlord-pro.png'),
  tax_reduction: require('../../assets/pixel-art/prestige/tax-planning.png'), dividend_boost: require('../../assets/pixel-art/prestige/dividend-hunter.png'),
  negotiation: require('../../assets/pixel-art/prestige/master-negotiator.png'),
};

export const prestigeImageKey = (id: string) => id.replace(/_[2345]$/, '');
