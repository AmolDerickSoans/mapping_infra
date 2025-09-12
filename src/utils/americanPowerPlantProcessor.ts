import type { PowerPlant } from '../models/PowerPlant';

// Mapping function for American energy sources to match existing source types
const mapEnergySource = (source: string): string => {
  const sourceMap: Record<string, string> = {
    'Natural Gas': 'gas',
    'Coal': 'coal',
    'Nuclear': 'nuclear',
    'Hydro': 'hydro',
    'Wind': 'wind',
    'Solar': 'solar',
    'Oil': 'oil',
    'Biomass': 'biomass',
    'Geothermal': 'geothermal'
  };
  
  return sourceMap[source] || 'other';
};

export async function loadAndProcessAmericanPowerPlants(): Promise<PowerPlant[]> {
  try {
    // Fetch and parse american_power_plants.json
    const response = await fetch('/data/american_power_plants.json');
    const jsonData = await response.json();
    
    // Process the data array
    const plants: PowerPlant[] = [];
    
    // The API data is in the 'data' field
    const apiDataArray = jsonData.response?.data || [];
    
    // Use a Map to group generators by plant to avoid duplicate plants
    const plantMap = new Map<string, any>();
    
    // Process each generator record
    for (const apiData of apiDataArray) {
      // Create a unique plant key based on plantid
      const plantKey = `us-${apiData.plantid}`;
      
      // If we haven't seen this plant yet, add it to our map
      if (!plantMap.has(plantKey)) {
        plantMap.set(plantKey, {
          ...apiData,
          totalCapacity: 0,
          generatorCount: 0
        });
      }
      
      // Get the existing plant data
      const plantData = plantMap.get(plantKey);
      
      // Add to the total capacity (we'll use the nameplate capacity)
      const capacity = parseFloat(apiData['nameplate-capacity-mw']) || 0;
      plantData.totalCapacity += capacity;
      plantData.generatorCount += 1;
    }
    
    // Now convert the aggregated plant data to PowerPlant objects
    for (const [plantKey, plantData] of plantMap.entries()) {
      const plant: PowerPlant = {
        id: plantKey,
        name: plantData.plantName,
        output: plantData.totalCapacity,
        outputDisplay: `${plantData.totalCapacity.toFixed(1)} MW`,
        source: mapEnergySource(plantData['energy-source-desc']),
        coordinates: [
          parseFloat(plantData.longitude) || 0,
          parseFloat(plantData.latitude) || 0
        ],
        country: 'US'
      };
      
      // Only add plants with valid coordinates and positive output
      if (!isNaN(plant.coordinates[0]) && !isNaN(plant.coordinates[1]) && plant.output > 0) {
        plants.push(plant);
      }
    }
    
    return plants;
  } catch (error) {
    console.error('Error loading American power plant data:', error);
    return [];
  }
}