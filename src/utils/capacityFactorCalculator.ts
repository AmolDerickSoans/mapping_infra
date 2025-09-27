// Capacity Factor Calculator Agent
// Processes EIA power plant data from 3.json to calculate capacity factors
// Note: Current data lacks generation information, so capacity factors cannot be calculated

interface EIAData {
  response: {
    data: Array<{
      period: string;
      plantid: string;
      plantName: string;
      generatorid: string;
      'nameplate-capacity-mw': string;
      'net-summer-capacity-mw': string;
      'net-winter-capacity-mw': string;
      [key: string]: string;
    }>;
  };
}

interface CapacityFactorResult {
  plant_id: string;
  plant_name: string;
  capacity_mw: number;
  capacity_factor: number | null;
  calculation_period: string;
  data_quality: 'complete' | 'insufficient_data' | 'invalid_data';
  net_summer_capacity_mw?: number;
  net_winter_capacity_mw?: number;
  generators_count: number;
}

/**
 * Calculate capacity factor for a single generator
 * Formula: Capacity Factor = (Actual Generation) / (Nameplate Capacity × 720) × 100%
 * Since generation data is not available, returns null with insufficient_data status
 */
function calculateGeneratorCapacityFactor(
  nameplateCapacity: number,
  generation?: number
): { capacityFactor: number | null; dataQuality: 'complete' | 'insufficient_data' | 'invalid_data' } {
  if (nameplateCapacity <= 0) {
    return { capacityFactor: null, dataQuality: 'invalid_data' };
  }

  if (generation === undefined || generation === null) {
    return { capacityFactor: null, dataQuality: 'insufficient_data' };
  }

  // Standard capacity factor calculation
  const hoursInMonth = 720; // 24 hours/day × 30 days
  const maxPossibleGeneration = nameplateCapacity * hoursInMonth;
  const capacityFactor = (generation / maxPossibleGeneration) * 100;

  return { capacityFactor, dataQuality: 'complete' };
}

/**
 * Aggregate data by plant ID
 */
function aggregatePlantData(data: EIAData['response']['data']): Map<string, {
  plantName: string;
  period: string;
  generators: Array<{
    generatorid: string;
    nameplateCapacity: number;
    netSummerCapacity: number;
    netWinterCapacity: number;
  }>;
}> {
  const plantMap = new Map<string, {
    plantName: string;
    period: string;
    generators: Array<{
      generatorid: string;
      nameplateCapacity: number;
      netSummerCapacity: number;
      netWinterCapacity: number;
    }>;
  }>();

  for (const entry of data) {
    const plantId = entry.plantid;
    const nameplateCapacity = parseFloat(entry['nameplate-capacity-mw']) || 0;
    const netSummerCapacity = parseFloat(entry['net-summer-capacity-mw']) || 0;
    const netWinterCapacity = parseFloat(entry['net-winter-capacity-mw']) || 0;

    if (!plantMap.has(plantId)) {
      plantMap.set(plantId, {
        plantName: entry.plantName,
        period: entry.period,
        generators: []
      });
    }

    const plant = plantMap.get(plantId)!;
    plant.generators.push({
      generatorid: entry.generatorid,
      nameplateCapacity,
      netSummerCapacity,
      netWinterCapacity
    });
  }

  return plantMap;
}

/**
 * Calculate capacity factors for all plants
 */
export function calculateCapacityFactors(jsonData: EIAData): CapacityFactorResult[] {
  const results: CapacityFactorResult[] = [];
  const plantMap = aggregatePlantData(jsonData.response.data);

  for (const [plantId, plantData] of plantMap) {
    // Aggregate capacities across generators
    let totalNameplateCapacity = 0;
    let totalNetSummerCapacity = 0;
    let totalNetWinterCapacity = 0;

    for (const generator of plantData.generators) {
      totalNameplateCapacity += generator.nameplateCapacity;
      totalNetSummerCapacity += generator.netSummerCapacity;
      totalNetWinterCapacity += generator.netWinterCapacity;
    }

    // Calculate capacity factor (will be insufficient_data since no generation)
    const { capacityFactor, dataQuality } = calculateGeneratorCapacityFactor(totalNameplateCapacity);

    const result: CapacityFactorResult = {
      plant_id: plantId,
      plant_name: plantData.plantName,
      capacity_mw: totalNameplateCapacity,
      capacity_factor: capacityFactor,
      calculation_period: plantData.period,
      data_quality: dataQuality,
      net_summer_capacity_mw: totalNetSummerCapacity > 0 ? totalNetSummerCapacity : undefined,
      net_winter_capacity_mw: totalNetWinterCapacity > 0 ? totalNetWinterCapacity : undefined,
      generators_count: plantData.generators.length
    };

    results.push(result);
  }

  return results;
}

/**
 * Load and process 3.json file
 */
export async function processEIAData(): Promise<CapacityFactorResult[]> {
  try {
    const response = await fetch('/data/3.json');
    if (!response.ok) {
      throw new Error(`Failed to load EIA data: ${response.statusText}`);
    }
    const jsonData: EIAData = await response.json();
    return calculateCapacityFactors(jsonData);
  } catch (error) {
    console.error('Error processing EIA data:', error);
    return [];
  }
}

/**
 * Export results to JSON
 */
export function exportToJSON(results: CapacityFactorResult[]): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Export results to CSV
 */
export function exportToCSV(results: CapacityFactorResult[]): string {
  const headers = [
    'plant_id',
    'plant_name',
    'capacity_mw',
    'capacity_factor',
    'calculation_period',
    'data_quality',
    'net_summer_capacity_mw',
    'net_winter_capacity_mw',
    'generators_count'
  ];

  const rows = results.map(result => [
    result.plant_id,
    result.plant_name,
    result.capacity_mw,
    result.capacity_factor ?? 'N/A',
    result.calculation_period,
    result.data_quality,
    result.net_summer_capacity_mw ?? 'N/A',
    result.net_winter_capacity_mw ?? 'N/A',
    result.generators_count
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}