// This is a web worker script for processing EIA data in the background
// Web workers run in a separate thread, preventing UI blocking

// Type definitions
interface EIADataEntry {
  plantid: string;
  generatorid: string;
  plantName: string;
  latitude: string;
  longitude: string;
  'nameplate-capacity-mw': string;
  'net-summer-capacity-mw': string;
  'net-winter-capacity-mw': string;
  'energy-source-desc': string;
  [key: string]: string;
}

interface PowerPlant {
  id: string;
  name: string;
  output: number;
  outputDisplay: string;
  source: string;
  coordinates: [number, number];
  country: string;
  capacityFactor: number | null;
  netSummerCapacity?: number;
  netWinterCapacity?: number;
  rawData: EIADataEntry;
}

// Mapping function for energy sources to match existing source types
function mapEnergySource(source: string): string {
  const sourceMap: Record<string, string> = {
    // Existing mappings
    'Coal': 'coal',
    'Natural Gas': 'gas',
    'Nuclear': 'nuclear',
    'Hydroelectric': 'hydro',
    'Wind': 'wind',
    'Solar': 'solar',
    'Petroleum': 'oil',
    'Biomass': 'biomass',
    'Geothermal': 'geothermal',
    'Tidal': 'tidal',
    'Pumped-Storage Hydroelectric': 'hydro',

    // Additional mappings for better coverage
    'Gas': 'gas',
    'Diesel': 'diesel',
    'Oil': 'oil',
    'Waste': 'waste',
    'Biofuel': 'biofuel',
    'Battery': 'battery',
    'Pumped Storage': 'hydro',
    'Run-of-river': 'hydro',
    'Conventional Hydroelectric': 'hydro',
    'Onshore Wind': 'wind',
    'Offshore Wind': 'wind',
    'Photovoltaic': 'solar',
    'Concentrated Solar': 'solar',
    'Combined Cycle': 'gas',
    'Combustion Turbine': 'gas',
    'Steam Turbine': 'coal',
    'Internal Combustion': 'diesel',
    'Landfill Gas': 'biomass',
    'Municipal Solid Waste': 'waste',
    'Wood': 'biomass',
    'Other Biomass': 'biomass',
    'Other Gases': 'gas'
  };

  // Normalize source name for better matching
  const normalized = source.toLowerCase().trim();

  // Try exact match first
  if (sourceMap[source]) return sourceMap[source];

  // Try normalized match
  const normalizedMatch = Object.keys(sourceMap).find(key =>
    key.toLowerCase().trim() === normalized
  );
  if (normalizedMatch) return sourceMap[normalizedMatch];

  // Default to 'other' if no match found
  return 'other';
}

// Function to parse EIA data from eia_aggregated_plant_capacity.json for US power plants
function parseEIAData(jsonData: EIADataEntry[]): PowerPlant[] {
  const plants: PowerPlant[] = [];

  if (!Array.isArray(jsonData)) {
    console.error('Invalid EIA data structure: expected an array');
    return plants;
  }

  for (const item of jsonData) {
    try {
      const latitude = parseFloat(item.latitude);
      const longitude = parseFloat(item.longitude);
      const nameplateCapacity = parseFloat(item['nameplate-capacity-mw']) || 0;
      const netSummerCapacity = parseFloat(item['net-summer-capacity-mw']) || 0;
      const netWinterCapacity = parseFloat(item['net-winter-capacity-mw']) || 0;

      // Skip if invalid coordinates or no capacity
      if (isNaN(latitude) || isNaN(longitude) || nameplateCapacity <= 0) {
        continue;
      }

      const source = mapEnergySource(item['energy-source-desc'] || 'Other');

      // Calculate proxy capacity factor: net summer capacity utilization ratio
      const capacityFactor = nameplateCapacity > 0 ? (netSummerCapacity / nameplateCapacity) * 100 : null;

      const plant: PowerPlant = {
        id: `us-${item.plantid}-${item.generatorid}`,
        name: item.plantName || 'Unknown Plant',
        output: nameplateCapacity,
        outputDisplay: `${nameplateCapacity.toFixed(1)} MW`,
        source: source,
        coordinates: [longitude, latitude],
        country: 'US',
        capacityFactor: capacityFactor,
        netSummerCapacity: netSummerCapacity,
        netWinterCapacity: netWinterCapacity,
        rawData: item
      };

      plants.push(plant);
    } catch (error) {
      console.warn('Error processing EIA plant entry:', error, item);
      // Continue processing other entries
    }
  }

  return plants;
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'PROCESS_EIA_DATA':
      try {
        const plants = parseEIAData(data);
        // Send the processed data back to the main thread
        self.postMessage({
          type: 'EIA_DATA_PROCESSED',
          data: plants
        });
      } catch (error) {
        self.postMessage({
          type: 'EIA_DATA_ERROR',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      break;

    default:
      console.warn('Unknown message type in worker:', type);
  }
});

// Export nothing as this is a worker script
export {};