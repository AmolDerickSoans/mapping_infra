import { VercelRequest, VercelResponse } from '@vercel/node';
import { parseJsonArrayStream } from '../src/utils/streamingJsonParser';

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
    // Fetch data from S3 (replace with your S3 URL)
    const s3Url = process.env.EIA_DATA_S3_URL || 'https://your-s3-bucket.s3.amazonaws.com/eia_aggregated_plant_capacity.json';
    const response = await fetch(s3Url);

    if (!response.ok) {
      throw new Error(`Failed to fetch data from S3: ${response.statusText}`);
    }

    const processedPlants: any[] = [];

    // Use streaming parser to process the data
    await new Promise<void>((resolve, reject) => {
      parseJsonArrayStream(
        response,
        (item: any) => {
          if (item.status === 'OP') { // Only operating plants
            processedPlants.push({
              plantid: item.plantid,
              generatorid: item.generatorid,
              plantName: item.plantName,
              latitude: parseFloat(item.latitude),
              longitude: parseFloat(item.longitude),
              'nameplate-capacity-mw': parseFloat(item['nameplate-capacity-mw']),
              'net-summer-capacity-mw': parseFloat(item['net-summer-capacity-mw']),
              'net-winter-capacity-mw': parseFloat(item['net-winter-capacity-mw']),
              'energy-source-desc': item['energy-source-desc'],
              technology: item.technology,
              statusDescription: item.statusDescription,
              county: item.county
            });
          }
        },
        () => resolve(),
        reject
      );
    });

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