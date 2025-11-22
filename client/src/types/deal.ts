export interface Deal {
  id: number;
  title: string;
  description: string | null;
  originalPrice: number | null;
  dealPrice: number | null;
  discountPercentage: number | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  imageUrl: string | null;
  termsConditions: string | null;
  businessName: string;
  businessType: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  isSaved?: boolean;
  distanceMeters?: number | null;
}

