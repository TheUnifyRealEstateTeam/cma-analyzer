// api/fetch-comps.js
// Vercel Serverless Function for fetching comparables from IDX

import fetch from 'node-fetch';

async function fetchFromMatrix(config, searchCriteria) {
  const query = new URLSearchParams({
    ApiKey: config.apiKey,
    Query: JSON.stringify({
      City: searchCriteria.city,
      State: searchCriteria.state,
      Beds: searchCriteria.beds ? parseInt(searchCriteria.beds) : undefined,
      Baths: searchCriteria.baths ? parseInt(searchCriteria.baths) : undefined,
      Status: 'Sold',
      DaysOnMarket: 365,
      Limit: 10
    })
  });

  const response = await fetch(`https://api.matrixmls.com/matrix/v2/search?${query}`, {
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  return mapMatrixResults(data.Results || []);
}

async function fetchFromIDXBroker(config, searchCriteria) {
  const response = await fetch('https://api.idxbroker.com/listings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      city: searchCriteria.city,
      state: searchCriteria.state,
      bedrooms: searchCriteria.beds ? [parseInt(searchCriteria.beds)] : undefined,
      bathrooms: searchCriteria.baths ? [parseInt(searchCriteria.baths)] : undefined,
      status: ['sold'],
      daysOnMarketRange: [0, 365],
      limit: 10
    })
  });

  const data = await response.json();
  return mapIDXBrokerResults(data.listings || []);
}

function mapMatrixResults(results) {
  return results.map(r => ({
    id: r.ListNumber,
    address: `${r.StreetNumber} ${r.StreetName}`,
    city: r.City,
    state: r.State,
    zip: r.ZipCode,
    beds: r.BedroomsTotal?.toString() || '',
    baths: (r.BathroomsFull + (r.BathroomsHalf * 0.5))?.toString() || '',
    sqft: r.LivingArea?.toString() || '',
    yearBuilt: r.YearBuilt?.toString() || '',
    salePrice: r.ListPrice?.toString() || '',
    saleDate: r.ListDate || '',
    daysOnMarket: r.DaysOnMarket?.toString() || '',
    photos: r.Photos?.map(p => p.Url) || [],
    notes: r.Remarks || '',
    mlsUrl: `https://matrix.mls.com/listing/${r.ListNumber}`
  }));
}

function mapIDXBrokerResults(results) {
  return results.map(r => ({
    id: r.id,
    address: r.address?.street || '',
    city: r.address?.city || '',
    state: r.address?.state || '',
    zip: r.address?.zip || '',
    beds: r.details?.bedrooms?.toString() || '',
    baths: r.details?.bathrooms?.toString() || '',
    sqft: r.details?.sqft?.toString() || '',
    yearBuilt: r.details?.yearBuilt?.toString() || '',
    salePrice: r.price?.toString() || '',
    saleDate: r.soldDate || '',
    daysOnMarket: r.daysOnMarket?.toString() || '',
    photos: r.photos?.map(p => p.url) || [],
    notes: r.description || '',
    mlsUrl: r.url || ''
  }));
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { idxConfig, searchCriteria } = req.body;

    if (!idxConfig || !searchCriteria) {
      return res.status(400).json({ error: 'Missing config or search criteria' });
    }

    let comparables = [];

    if (idxConfig.provider === 'matrix') {
      comparables = await fetchFromMatrix(idxConfig, searchCriteria);
    } else if (idxConfig.provider === 'idxbroker') {
      comparables = await fetchFromIDXBroker(idxConfig, searchCriteria);
    } else {
      return res.status(400).json({ error: 'Unsupported IDX provider' });
    }

    return res.status(200).json({ comparables });
  } catch (error) {
    console.error('Fetch comps error:', error);
    return res.status(500).json({ error: error.message });
  }
}