export interface PowerPlant {
  id: string;
  name: string;
  output: number;
  outputDisplay: string;
  source: string;
  coordinates: [number, number]; // [longitude, latitude]
  country: 'CA' | 'US';
  // Additional fields for hover panel
  rawData?: Record<string, string>; // Store all original CSV fields
}