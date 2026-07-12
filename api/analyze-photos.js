// api/analyze-photos.js
// Vercel Serverless Function for analyzing property photos with Claude

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function analyzePhotosForUpgrades(photos, subjectProperty) {
  const photoAnalysisPrompt = `Analyze these comparable property photos and identify upgrades/features.
  
Subject property condition: ${subjectProperty.condition}
Subject property year built: ${subjectProperty.yearBuilt}

For each photo, identify:
1. Kitchen upgrades (granite counters, new appliances, updated cabinets)
2. Bathroom upgrades (new fixtures, tile, vanity)
3. Flooring (hardwood, tile, carpeting - condition)
4. Roof condition
5. HVAC condition
6. Windows (new/old)
7. Exterior condition (paint, siding, deck)
8. Pool, hot tub, or other features
9. General condition assessment

Return ONLY a JSON object with no markdown:
{
  "upgrades": ["list of detected upgrades"],
  "downgrades": ["list of issues/older features"],
  "overallCondition": "Excellent/Good/Average/Fair/Poor",
  "summary": "brief summary of property condition"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          ...photos.map(photo => ({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: photo.base64
            }
          })),
          {
            type: 'text',
            text: photoAnalysisPrompt
          }
        ]
      }]
    });

    const textContent = response.content.find(c => c.type === 'text')?.text || '{}';
    const cleanJson = textContent.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Photo analysis error:', error);
    return {
      upgrades: [],
      downgrades: [],
      overallCondition: 'Average',
      summary: 'Photo analysis failed'
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
    const { compId, photos, subjectProperty } = req.body;

    if (!photos || photos.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }

    const analysis = await analyzePhotosForUpgrades(photos, subjectProperty);

    return res.status(200).json({
      compId,
      analysis
    });
  } catch (error) {
    console.error('Photo analysis error:', error);
    return res.status(500).json({ error: error.message });
  }
}