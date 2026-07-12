// api/analyze-cma.js
// Vercel Serverless Function for generating CMA reports

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function generateCMAAnalysis(subjectProperty, comparables, photoAnalysis) {
  const photoAdjustmentsText = Object.entries(photoAnalysis)
    .map(([compId, analysis]) => {
      const comp = comparables.find(c => c.id === parseInt(compId) || c.id === compId);
      return `${comp?.address || 'Unknown'}: Upgrades detected: ${analysis.upgrades?.join(', ') || 'None'}`;
    })
    .join('\n');

  const cmaPrompt = `You are a professional real estate appraiser. Generate a comprehensive Comparative Market Analysis.

SUBJECT PROPERTY:
Address: ${subjectProperty.address}, ${subjectProperty.city}, ${subjectProperty.state} ${subjectProperty.zip}
Beds: ${subjectProperty.beds} | Baths: ${subjectProperty.baths}
Sqft: ${subjectProperty.sqft} | Year Built: ${subjectProperty.yearBuilt}
Lot Size: ${subjectProperty.lotSize}
Condition: ${subjectProperty.condition}
Notes: ${subjectProperty.notes}

COMPARABLE PROPERTIES:
${comparables.map((c, i) => `
Comp #${i + 1}: ${c.address}, ${c.city}, ${c.state}
Beds/Baths: ${c.beds}/${c.baths} | Sqft: ${c.sqft} | Year: ${c.yearBuilt}
Sale Price: $${c.salePrice} | Sale Date: ${c.saleDate} | DOM: ${c.daysOnMarket}
${c.notes ? `Notes: ${c.notes}` : ''}
`).join('\n')}

PHOTO-BASED UPGRADE ANALYSIS:
${photoAdjustmentsText || 'No photo analysis available'}

Generate a professional CMA report with:
1. Market Analysis - current market trends, absorption rate, DOM trends
2. Subject Summary - key features, condition vs comps
3. Comparable Analysis - detailed comp-by-comp analysis with adjustments for upgrades/downgrades
4. Photo-Based Observations - note how photo analysis reveals upgrade differences
5. Value Conclusion - estimated market value range with detailed reasoning
6. Recommendations - pricing strategy, potential improvements

Return ONLY valid JSON with no markdown:
{
  "marketAnalysis": "paragraph",
  "subjectSummary": "paragraph",
  "comparableAnalysis": "paragraph with per-comp details",
  "photoAdjustments": "paragraph analyzing upgrade differences from photos",
  "valueConclusion": "paragraph with value range and reasoning",
  "recommendations": "paragraph"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content: cmaPrompt
      }]
    });

    const textContent = response.content.find(c => c.type === 'text')?.text || '{}';
    const cleanJson = textContent.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('CMA analysis error:', error);
    return {
      marketAnalysis: 'Analysis failed',
      subjectSummary: 'Unable to generate',
      comparableAnalysis: 'Unable to generate',
      photoAdjustments: 'Unable to generate',
      valueConclusion: 'Unable to generate',
      recommendations: 'Unable to generate'
    };
  }
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
    const { subjectProperty, comparables, photoAnalysis } = req.body;

    if (!subjectProperty.address || comparables.length < 2) {
      return res.status(400).json({ error: 'Insufficient data for analysis' });
    }

    const analysis = await generateCMAAnalysis(subjectProperty, comparables, photoAnalysis || {});

    return res.status(200).json(analysis);
  } catch (error) {
    console.error('CMA analysis error:', error);
    return res.status(500).json({ error: error.message });
  }
}