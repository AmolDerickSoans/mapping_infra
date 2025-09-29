import { VercelRequest, VercelResponse } from '@vercel/node';
import * as fs from 'fs';
import * as path from 'path';

// Simple in-memory cache
let cache: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Check if we have valid cached data
  const now = Date.now();
  if (cache && (now - cache.timestamp) < CACHE_TTL) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(cache.data);
  }

  try {
    // Read and process the JSON file using streaming to handle large files
    const filePath = path.join(process.cwd(), 'public', 'data', 'eia_aggregated_plant_capacity.json');

    // Use streaming to process large JSON file
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    let buffer = '';
    let inArray = false;
    let bracketCount = 0;
    let processedPlants: any[] = [];

    // Process the stream
    for await (const chunk of fileStream) {
      buffer += chunk;

      // Simple streaming parser for JSON array
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];

        if (char === '[' && !inArray) {
          inArray = true;
          bracketCount++;
        } else if (char === '{') {
          bracketCount++;
        } else if (char === '}') {
          bracketCount--;
          if (bracketCount === 1 && inArray) {
            // Found a complete object
            const objStr = buffer.substring(start, i + 1);
            try {
              const plant = JSON.parse(objStr);
              if (plant.status === 'OP') { // Only operating plants
                processedPlants.push({
                  plantid: plant.plantid,
                  generatorid: plant.generatorid,
                  plantName: plant.plantName,
                  latitude: parseFloat(plant.latitude),
                  longitude: parseFloat(plant.longitude),
                  'nameplate-capacity-mw': parseFloat(plant['nameplate-capacity-mw']),
                  'net-summer-capacity-mw': parseFloat(plant['net-summer-capacity-mw']),
                  'net-winter-capacity-mw': parseFloat(plant['net-winter-capacity-mw']),
                  'energy-source-desc': plant['energy-source-desc'],
                  technology: plant.technology,
                  statusDescription: plant.statusDescription,
                  county: plant.county
                });
              }
            } catch (e) {
              // Skip invalid JSON objects
            }
            start = i + 1;
          }
        } else if (char === ']') {
          bracketCount--;
          if (bracketCount === 0) {
            inArray = false;
          }
        }
      }

      // Keep only unprocessed part of buffer
      buffer = buffer.substring(start);
    }

    // Update cache
    cache = {
      data: processedPlants,
      timestamp: now
    };

    // Set response headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes

    // Send response
    return res.status(200).json(processedPlants);
  } catch (error) {
    console.error('Error processing power plant data:', error);
    return res.status(500).json({ error: 'Failed to process power plant data' });
  }
}