import { CacheManager } from './cache';
import { globalProgressIndicator } from './progressIndicator';
import { loadLargeJsonData } from './streamingJsonParser';
import type { PowerPlant } from '../models/PowerPlant';

// Constants for caching
const EIA_DATA_CACHE_KEY = 'eia-power-plants-v1';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Efficiently loads and caches the EIA power plant data
 * @returns Promise resolving to array of PowerPlant objects
 */
export async function loadEIADataEfficiently(): Promise<PowerPlant[]> {
  try {
    // Report initial progress
    globalProgressIndicator.update(0, 'Checking cached data...');
    
    // First, check if we have valid cached data
    const cachedData = getCachedEIAData();
    if (cachedData) {
      globalProgressIndicator.update(100, 'Loaded from cache');
      console.log('Loaded EIA data from cache');
      return cachedData;
    }

    // If no valid cache, load from network
    globalProgressIndicator.update(10, 'Loading EIA data from network...');
    console.log('Loading EIA data from network');
    
    const response = await fetch('/data/eia_aggregated_plant_capacity.json');
    
    if (!response.ok) {
      throw new Error(`Failed to load EIA data: ${response.statusText}`);
    }

    // Try streaming parser first for better memory efficiency
    // Fall back to regular JSON parsing if streaming is not supported
    let plants: PowerPlant[] = [];
    
    try {
      // Use streaming parser for large JSON files
      plants = [];
      
      await loadLargeJsonData(
        '/data/eia_aggregated_plant_capacity.json',
        (item, index) => {
          // Update progress periodically
          if (index % 1000 === 0) {
            globalProgressIndicator.update(
              30 + Math.min(40, (index / 10000) * 40), // Use 30-70% range for processing
              `Processing plant ${index + 1}...`
            );
          }
          
          try {
            const plant = transformEIAItemToPowerPlant(item);
            if (plant) {
              plants.push(plant);
            }
          } catch (error) {
            console.warn('Error processing EIA plant entry:', error, item);
          }
          
        }
      );
    } catch (streamingError) {
      console.warn('Streaming parser failed, falling back to regular JSON parsing:', streamingError);
      
      // Fallback to regular JSON parsing
      globalProgressIndicator.update(30, 'Parsing EIA data...');
      const rawData = await response.json();
      
      globalProgressIndicator.update(50, 'Processing EIA data...');
      plants = transformEIADataToPowerPlants(rawData);
    }
    
    // Update progress
    globalProgressIndicator.update(80, `Processed ${plants.length} plants, caching...`);
    
    // Cache the processed data
    cacheEIAData(plants);
    
    // Final progress update
    globalProgressIndicator.update(100, `Loaded ${plants.length} power plants`);
    
    return plants;
  } catch (error) {
    globalProgressIndicator.update(0, 'Error loading data');
    console.error('Error loading EIA data efficiently:', error);
    return []; // Return empty array as fallback
  }
}

/**
 * Transform a single EIA data item to PowerPlant format
 * @param item Raw EIA data item
 * @returns PowerPlant object or null if invalid
 */
function transformEIAItemToPowerPlant(item: any): PowerPlant | null {
  const latitude = parseFloat(item.latitude);
  const longitude = parseFloat(item.longitude);
  const nameplateCapacity = parseFloat(item['nameplate-capacity-mw']) || 0;
  const netSummerCapacity = parseFloat(item['net-summer-capacity-mw']);
  const netWinterCapacity = parseFloat(item['net-winter-capacity-mw']);

  // Skip if invalid coordinates or no capacity
  if (isNaN(latitude) || isNaN(longitude) || nameplateCapacity <= 0) {
    return null;
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
    rawData: item
  };

  // Only add optional fields if they exist and are valid numbers
  if (!isNaN(netSummerCapacity)) {
    plant.netSummerCapacity = netSummerCapacity;
  }
  
  if (!isNaN(netWinterCapacity)) {
    plant.netWinterCapacity = netWinterCapacity;
  }

  return plant;
}

/**
 * Transform EIA data array to PowerPlant array
 * @param jsonData Raw EIA data array
 * @returns Array of PowerPlant objects
 */
export function transformEIADataToPowerPlants(jsonData: any[]): PowerPlant[] {
  const plants: PowerPlant[] = [];

  if (!Array.isArray(jsonData)) {
    console.error('Invalid EIA data structure: expected an array');
    return plants;
  }

  // Report progress in chunks for large datasets
  const totalItems = jsonData.length;
  const progressInterval = Math.max(1, Math.floor(totalItems / 10)); // Update every 10%

  for (let i = 0; i < jsonData.length; i++) {
    const item = jsonData[i];
    
    // Update progress periodically
    if (i % progressInterval === 0 || i === totalItems - 1) {
      const progress = 50 + (i / totalItems) * 40; // Use 50-90% range for processing
      globalProgressIndicator.update(
        Math.round(progress), 
        `Processing plant ${i + 1} of ${totalItems}...`
      );
    }
    
    try {
      const plant = transformEIAItemToPowerPlant(item);
      if (plant) {
        plants.push(plant);
      }
    } catch (error) {
      console.warn('Error processing EIA plant entry:', error, item);
      // Continue processing other entries
    }
  }

  console.log(`Processed ${plants.length} power plants from EIA data`);
  return plants;
}

/**
 * Gets cached EIA data if it exists and is still valid
 * @returns Array of PowerPlant objects or null if no valid cache
 */
function getCachedEIAData(): PowerPlant[] | null {
  const entry = CacheManager.getCachedData(EIA_DATA_CACHE_KEY);
  
  if (!entry) {
    return null;
  }

  // Check if cache is still valid
  if (!CacheManager.isCacheValid(entry, CACHE_DURATION)) {
    // Clear expired cache
    CacheManager.clearCache(EIA_DATA_CACHE_KEY);
    return null;
  }

  try {
    const data = CacheManager.getDecompressedData<PowerPlant[]>(EIA_DATA_CACHE_KEY);
    console.log(`Loaded ${data?.length || 0} plants from cache`);
    return data || null;
  } catch (error) {
    console.warn('Failed to decompress cached EIA data:', error);
    // Remove corrupted cache
    CacheManager.clearCache(EIA_DATA_CACHE_KEY);
    return null;
  }
}

/**
 * Caches EIA data with compression
 * @param data Array of PowerPlant objects to cache
 */
function cacheEIAData(data: PowerPlant[]): void {
  const success = CacheManager.setCachedData(EIA_DATA_CACHE_KEY, data);
  if (success) {
    console.log(`Cached ${data.length} power plants`);
  } else {
    console.warn('Failed to cache EIA data - may be too large for localStorage');
  }
}

/**
 * Maps EIA energy source descriptions to our standardized source types
 * @param source EIA energy source description
 * @returns Standardized source type
 */
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