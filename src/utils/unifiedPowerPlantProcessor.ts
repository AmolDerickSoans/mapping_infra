import type { PowerPlant } from '../models/PowerPlant';

// Function to load and process both CSV files
export async function loadAndProcessAllPowerPlants(): Promise<PowerPlant[]> {
  try {
    // Load both CSV files
    const largePlantsResponse = await fetch('/data/Power_Plants,_100_MW_or_more.csv');
    const renewablePlantsResponse = await fetch('/data/Renewable_Energy_Power_Plants,_1_MW_or_more.csv');
    
    const largePlantsText = await largePlantsResponse.text();
    const renewablePlantsText = await renewablePlantsResponse.text();
    
    // Parse both CSV files
    const largePlants = parsePowerPlantCSV(largePlantsText, 'large');
    const renewablePlants = parsePowerPlantCSV(renewablePlantsText, 'renewable');
    
    // Combine and aggregate plants
    const allPlants = [...largePlants, ...renewablePlants];
    const aggregatedPlants = aggregatePowerPlants(allPlants);
    
    return aggregatedPlants;
  } catch (error) {
    console.error('Error loading power plant data:', error);
    return [];
  }
}

// Helper function for parsing and transforming CSV data
export function parsePowerPlantCSV(csvText: string, type: 'large' | 'renewable'): PowerPlant[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  const plants: PowerPlant[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const row = parseCsvRow(line);
    if (row.length < headers.length) continue;
    
    // Create a map of header to value
    const entry: Record<string, string> = {};
    headers.forEach((header, index) => {
      entry[header] = row[index] ? row[index].trim().replace(/^"|"$/g, '') : '';
    });
    
    // Extract coordinates
    const latitude = parseFloat(entry['Latitude'] || '0');
    const longitude = parseFloat(entry['Longitude'] || '0');
    
    // Extract capacity
    const capacityStr = entry['Total Capacity (MW)'] || '0';
    const capacity = parseFloat(capacityStr.replace(/,/g, '')) || 0;
    
    // Determine energy source based on CSV type
    const source = type === 'large' 
      ? mapEnergySource(entry['Primary Energy Source'] || 'Other')
      : mapEnergySource(entry['Primary Renewable Energy Source'] || 'Other');
    
    // Determine country
    const country = entry['Country'] === 'Canada' ? 'CA' : 'US';
    
    const plant: PowerPlant = {
      id: `plant-${type}-${i}`,
      name: entry['Facility Name'] || 'Unknown Facility',
      output: capacity,
      outputDisplay: `${capacity.toFixed(1)} MW`,
      source: source,
      coordinates: [longitude, latitude],
      country: country,
      rawData: entry
    };
    
    // Only add plants with valid coordinates and positive output
    if (!isNaN(latitude) && !isNaN(longitude) && capacity > 0) {
      plants.push(plant);
    }
  }
  
  return plants;
}

// Function to aggregate generators at same facility
export function aggregatePowerPlants(plants: PowerPlant[]): PowerPlant[] {
  // Use a Map to group plants by name and coordinates for aggregation
  const plantMap = new Map<string, PowerPlant>();
  
  for (const plant of plants) {
    // Create a unique key based on name, coordinates, and country
    const key = `${plant.name.toLowerCase()}-${plant.coordinates[0].toFixed(4)}-${plant.coordinates[1].toFixed(4)}-${plant.country}`;
    
    if (plantMap.has(key)) {
      // If we've seen this plant before, aggregate the capacity
      const existingPlant = plantMap.get(key)!;
      existingPlant.output += plant.output;
      existingPlant.outputDisplay = `${existingPlant.output.toFixed(1)} MW`;
      
      // Merge raw data, preserving the first entry's data but updating capacity
      if (existingPlant.rawData && plant.rawData) {
        existingPlant.rawData['Total Capacity (MW)'] = existingPlant.output.toString();
      }
    } else {
      // First time seeing this plant
      plantMap.set(key, plant);
    }
  }
  
  return Array.from(plantMap.values());
}

// Helper function to parse CSV rows with proper quote handling
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Double quotes inside quoted field
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      // Regular character
      current += char;
    }
  }
  
  // Push the last field
  result.push(current);
  return result;
}

// Mapping function for energy sources to match existing source types
function mapEnergySource(source: string): string {
  const sourceMap: Record<string, string> = {
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
    'Pumped-Storage Hydroelectric': 'hydro'
  };
  
  return sourceMap[source] || 'other';
}