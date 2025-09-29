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
    // Read and process the JSON file efficiently
    const filePath = path.join(process.cwd(), 'public', 'data', 'eia_aggregated_plant_capacity.json');
    
    // Read file synchronously (blocking but simpler for this use case)
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse JSON
    const allPlants = JSON.parse(fileContent);
    
    // Process only operating plants to reduce data size
    const processedPlants = allPlants
      .filter((plant: any) => plant.status === 'OP') // Only operating plants
      .map((plant: any) => ({
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
      }));

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