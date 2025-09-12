import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Get the path parameters
  const { path } = req.query;
  
  // Validate path
  if (!path || !Array.isArray(path)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  
  try {
    // Construct the ITU service URL
    const ituPath = path.join('/');
    const ituUrl = `https://bbmaps.itu.int/geoserver/itu-geocatalogue/ows${ituPath}${req.url?.split('?')[1] ? `?${req.url.split('?')[1]}` : ''}`;
    
    // Forward the request to ITU service
    const response = await fetch(ituUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mapping-Infra-App/1.0',
        'Accept': 'application/json,*/*',
      },
    });
    
    // Get the response data
    const data = await response.text();
    
    // Set CORS headers to allow requests from your frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
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