import type { PowerPlant } from '../models/PowerPlant';

// This single function will handle fetching and processing the CSV.
export async function loadAndProcessPowerPlants(): Promise<PowerPlant[]> {
  // 1. LOAD the raw text file from the public directory.
  const response = await fetch('/data/canada_power_plants_2025-09-10T06-37-39-198Z.csv');
  const csvText = await response.text();

  // 2. PARSE the text into rows and identify the columns we need.
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  // Find the index of each important column. This is more robust than assuming an order.
  const nameIndex = headers.indexOf('name');
  const outputIndex = headers.indexOf('output');
  const sourceIndex = headers.indexOf('source');
  const latIndex = headers.indexOf('latitude');
  const lngIndex = headers.indexOf('longitude');

  const plants: PowerPlant[] = [];

  // 3. TRANSFORM each row into a clean PowerPlant object.
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle CSV parsing with proper quote handling
    const row = parseCsvRow(line);
    
    // Skip rows with insufficient data
    if (row.length < Math.min(nameIndex, outputIndex, sourceIndex, latIndex, lngIndex) + 1) continue;
    
    // Extract and clean the data from each column.
    const name = row[nameIndex] || '';
    const outputStr = row[outputIndex] || '';
    const source = row[sourceIndex] || '';
    const latStr = row[latIndex] || '';
    const lngStr = row[lngIndex] || '';
    
    // Clean the values
    const cleanName = name.replace(/^"|"$/g, '').trim();
    const cleanSource = source.replace(/^"|"$/g, '').trim().toLowerCase();
    const cleanLat = parseFloat(latStr.replace(/^"|"$/g, '').trim());
    const cleanLng = parseFloat(lngStr.replace(/^"|"$/g, '').trim());
    
    // Extract numeric value from output (handle cases like "1,234 MW")
    const outputMatch = outputStr.match(/[\d,]+/);
    const output = outputMatch ? parseFloat(outputMatch[0].replace(/,/g, '')) : 0;
    
    // Data Validation: Only add the plant if it has a name, valid coordinates, and some power output.
    if (cleanName && !isNaN(cleanLat) && !isNaN(cleanLng) && output > 0) {
      plants.push({
        id: `plant-${i}`,
        name: cleanName,
        output: output,
        outputDisplay: outputStr.replace(/^"|"$/g, '').trim() || `${output} MW`,
        source: cleanSource || 'other',
        // This is the most important part for mapping: [longitude, latitude]
        coordinates: [cleanLng, cleanLat],
      });
    }
  }
  
  return plants;
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