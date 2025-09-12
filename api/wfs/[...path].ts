import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    // Extract query parameters from the request
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'path') {
        query.append(key, value as string);
      }
    }
    
    // Construct the ITU service URL
    const ituUrl = `https://bbmaps.itu.int/geoserver/itu-geocatalogue/ows?${query.toString()}`;
    
    // Forward the request to ITU service
    const response = await fetch(ituUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mapping-Infra-App/1.0',
        'Accept': 'application/json,*/*',
      },
    });
    
    // Get the response data
    const data = await response.text();
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Set the appropriate content type based on the ITU response
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    } else {
      res.setHeader('Content-Type', 'application/json');
    }
    
    // Send the response
    return res.status(response.status).send(data);
  } catch (error) {
    console.error('WFS Proxy Error:', error);
    return res.status(500).json({ error: 'Failed to fetch data from ITU service' });
  }
}