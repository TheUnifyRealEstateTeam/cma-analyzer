import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, AlertCircle, FileText, Zap, MapPin, DollarSign, TrendingUp, Settings, Loader, CheckCircle, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export default function CMAAnalyzerApp() {
  // Subject Property State
  const [subjectProperty, setSubjectProperty] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
    beds: '',
    baths: '',
    sqft: '',
    yearBuilt: '',
    lotSize: '',
    propertyType: 'Residential',
    condition: 'Average',
    notes: '',
    photos: []
  });

  // IDX Configuration State
  const [idxConfig, setIdxConfig] = useState({
    provider: 'matrix',
    apiKey: '',
    clientId: '',
    clientSecret: '',
    saved: false
  });
  const [showIDXConfig, setShowIDXConfig] = useState(false);

  // Comparables State
  const [comparables, setComparables] = useState([]);
  const [selectedComp, setSelectedComp] = useState(null);
  const [compPhotos, setCompPhotos] = useState({});
  const [photoAnalysis, setPhotoAnalysis] = useState({});

  // Analysis State
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [showValueEstimate, setShowValueEstimate] = useState(true);
  const [error, setError] = useState('');

  // Load IDX config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('idxConfig');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setIdxConfig({ ...config, saved: true });
      } catch (e) {
        console.error('Failed to load IDX config:', e);
      }
    }
  }, []);

  // Subject Property Handlers
  const handleSubjectChange = (e) => {
    const { name, value } = e.target;
    setSubjectProperty(prev => ({ ...prev, [name]: value }));
  };

  const handleSubjectPhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = [];

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (event) => {
        newPhotos.push({
          id: Date.now() + Math.random(),
          file: file,
          preview: event.target.result,
          description: ''
        });
        if (newPhotos.length === files.length) {
          setSubjectProperty(prev => ({
            ...prev,
            photos: [...prev.photos, ...newPhotos]
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSubjectPhoto = (id) => {
    setSubjectProperty(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== id)
    }));
  };

  // PDF Upload Handler
  const handlePDFUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target.result.split(',')[1];
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: base64 }
                },
                {
                  type: 'text',
                  text: `Extract property details from this public record. Return ONLY valid JSON:
{
  "address": "",
  "city": "",
  "state": "",
  "zip": "",
  "beds": "",
  "baths": "",
  "sqft": "",
  "yearBuilt": "",
  "lotSize": "",
  "propertyType": "Residential",
  "condition": "Average",
  "notes": ""
}`
                }
              ]
            }]
          })
        });

        const data = await response.json();
        const textContent = data.content.find(c => c.type === 'text')?.text || '';
        const cleanJson = textContent.replace(/```json|```/g, '').trim();
        const extracted = JSON.parse(cleanJson);
        
        setSubjectProperty(prev => ({ ...prev, ...extracted }));
        setError('✓ PDF extracted successfully');
      } catch (err) {
        setError(`✗ PDF extraction failed: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  };

  // IDX Configuration Handler
  const saveIDXConfig = () => {
    localStorage.setItem('idxConfig', JSON.stringify(idxConfig));
    setIdxConfig(prev => ({ ...prev, saved: true }));
    setError('✓ IDX configuration saved');
    setTimeout(() => setError(''), 3000);
  };

  // Fetch Comparables from IDX
  const fetchFromIDX = async () => {
    if (!idxConfig.saved) {
      setError('✗ Please configure IDX first');
      return;
    }

    if (!subjectProperty.address || !subjectProperty.city) {
      setError('✗ Enter subject property address and city first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/fetch-comps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idxConfig,
          searchCriteria: {
            city: subjectProperty.city,
            state: subjectProperty.state,
            beds: subjectProperty.beds,
            baths: subjectProperty.baths,
            radius: 1
          }
        })
      });

      if (!response.ok) throw new Error('Failed to fetch comparables');
      
      const data = await response.json();
      setComparables(data.comparables || []);
      setError(`✓ Fetched ${data.comparables?.length || 0} comparables from IDX`);
    } catch (err) {
      setError(`✗ IDX fetch failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Add Manual Comparable
  const addComparable = () => {
    setComparables(prev => [...prev, {
      id: Date.now(),
      address: '',
      city: '',
      state: '',
      zip: '',
      beds: '',
      baths: '',
      sqft: '',
      yearBuilt: '',
      salePrice: '',
      saleDate: '',
      daysOnMarket: '',
      notes: '',
      photos: [],
      mlsUrl: ''
    }]);
  };

  // Update Comparable
  const updateComparable = (id, field, value) => {
    setComparables(prev => 
      prev.map(c => c.id === id ? { ...c, [field]: value } : c)
    );
  };

  // Delete Comparable
  const deleteComparable = (id) => {
    setComparables(prev => prev.filter(c => c.id !== id));
    setPhotoAnalysis(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  // Upload Comparable Photos
  const handleCompPhotoUpload = async (compId, e) => {
    const files = Array.from(e.target.files || []);
    const photos = [];

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (event) => {
        photos.push({
          id: Date.now() + Math.random(),
          file: file,
          preview: event.target.result
        });
        if (photos.length === files.length) {
          setCompPhotos(prev => ({
            ...prev,
            [compId]: [...(prev[compId] || []), ...photos]
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Analyze Comp Photos for Upgrades
  const analyzeCompPhotos = async (compId) => {
    const photos = compPhotos[compId];
    if (!photos || photos.length === 0) {
      setError('✗ Upload photos first');
      return;
    }

    setPhotoAnalyzing(true);
    setError('');

    try {
      const photoData = await Promise.all(
        photos.map(async (photo) => ({
          id: photo.id,
          base64: photo.preview.split(',')[1]
        }))
      );

      const response = await fetch(`${API_URL}/api/analyze-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compId,
          photos: photoData,
          subjectProperty: {
            condition: subjectProperty.condition,
            yearBuilt: subjectProperty.yearBuilt
          }
        })
      });

      if (!response.ok) throw new Error('Photo analysis failed');
      
      const result = await response.json();
      setPhotoAnalysis(prev => ({
        ...prev,
        [compId]: result.analysis
      }));
      setError('✓ Photo analysis complete');
    } catch (err) {
      setError(`✗ Photo analysis failed: ${err.message}`);
    } finally {
      setPhotoAnalyzing(false);
    }
  };

  // Generate CMA Analysis
  const generateCMAAnalysis = async () => {
    if (!subjectProperty.address) {
      setError('✗ Enter subject property address');
      return;
    }
    if (comparables.length < 2) {
      setError('✗ Add at least 2 comparable properties');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/analyze-cma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectProperty,
          comparables,
          photoAnalysis
        })
      });

      if (!response.ok) throw new Error('CMA analysis failed');
      
      const result = await response.json();
      setAnalysis(result);
      setError('');
    } catch (err) {
      setError(`✗ Analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-blue-400" />
              <h1 className="text-4xl font-bold text-white">CMA Analyzer</h1>
            </div>
            <p className="text-slate-400">AI-powered comparative market analysis with photo-based upgrade detection</p>
          </div>
          <button
            onClick={() => setShowIDXConfig(!showIDXConfig)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
          >
            <Settings className="w-5 h-5" />
            IDX Config
          </button>
        </div>

        {/* Error/Success Display */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg border flex gap-3 ${error.includes('✓') ? 'bg-green-900/30 border-green-500 text-green-300' : 'bg-red-900/30 border-red-500 text-red-300'}`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error.replace('✓ ', '').replace('✗ ', '')}</p>
          </div>
        )}

        {/* IDX Configuration Panel */}
        {showIDXConfig && (
          <div className="mb-6 bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              IDX API Configuration
            </h3>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">IDX Provider</label>
                <select
                  value={idxConfig.provider}
                  onChange={(e) => setIdxConfig(prev => ({ ...prev, provider: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg"
                >
                  <option value="matrix">Matrix (Established/NRT)</option>
                  <option value="idxbroker">IDX Broker</option>
                  <option value="mlscom">MLS.com</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
                <input
                  type="password"
                  value={idxConfig.apiKey}
                  onChange={(e) => setIdxConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Your API key"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Client ID (if required)</label>
                <input
                  type="text"
                  value={idxConfig.clientId}
                  onChange={(e) => setIdxConfig(prev => ({ ...prev, clientId: e.target.value }))}
                  placeholder="Client ID"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Client Secret (if required)</label>
                <input
                  type="password"
                  value={idxConfig.clientSecret}
                  onChange={(e) => setIdxConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
                  placeholder="Client secret"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveIDXConfig}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                <CheckCircle className="w-4 h-4" />
                Save Configuration
              </button>
              {idxConfig.saved && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-900/30 border border-green-500 text-green-300 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  Saved
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Input */}
          <div className="lg:col-span-2 space-y-6">
            {/* Subject Property Section */}
            <div className="bg-slate-800 rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">Subject Property</h2>
              </div>

              {/* PDF Upload */}
              <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border-2 border-dashed border-slate-600 hover:border-blue-400 transition cursor-pointer">
                <label className="cursor-pointer flex items-center gap-3">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-300 font-medium">Upload Public Record PDF</span>
                  <input type="file" accept=".pdf" onChange={handlePDFUpload} className="hidden" />
                </label>
              </div>

              {/* Property Form */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <input type="text" name="address" placeholder="Street Address" value={subjectProperty.address} onChange={handleSubjectChange} className="col-span-2 px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg placeholder-slate-500" />
                <input type="text" name="city" placeholder="City" value={subjectProperty.city} onChange={handleSubjectChange} className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg placeholder-slate-500" />
                <input type="text" name="state" placeholder="State" value={subjectProperty.state} onChange={handleSubjectChange} className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg placeholder-slate-500" />
                <input type="text" name="beds" placeholder="Bedrooms" value={subjectProperty.beds} onChange={handleSubjectChange} className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg placeholder-slate-500" />
                <input type="text" name="baths" placeholder="Bathrooms" value={subjectProperty.baths} onChange={handleSubjectChange} className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg placeholder-slate-500" />
                <input type="text" name="sqft" placeholder="Square Feet" value={subjectProperty.sqft} onChange={handleSubjectChange} className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg placeholder-slate-500" />
                <input type="text" name="yearBuilt" placeholder="Year Built" value={subjectProperty.yearBuilt} onChange={handleSubjectChange} className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg placeholder-slate-500" />
                <input type="text" name="lotSize" placeholder="Lot Size" value={subjectProperty.lotSize} onChange={handleSubjectChange} className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg placeholder-slate-500" />
                <select name="condition" value={subjectProperty.condition} onChange={handleSubjectChange} className="col-span-2 px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg">
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Average">Average</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
                <textarea name="notes" placeholder="Additional notes..." value={subjectProperty.notes} onChange={handleSubjectChange} className="col-span-2 px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg placeholder-slate-500 h-20 resize-none" />
              </div>

              {/* Subject Property Photos */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">Subject Property Photos</label>
                <div className="p-4 bg-slate-700/50 rounded-lg border-2 border-dashed border-slate-600 hover:border-blue-400 transition cursor-pointer mb-3">
                  <label className="cursor-pointer flex items-center gap-3">
                    <ImageIcon className="w-5 h-5 text-slate-400" />
                    <span className="text-slate-300 font-medium">Upload property photos</span>
                    <input type="file" multiple accept="image/*" onChange={handleSubjectPhotoUpload} className="hidden" />
                  </label>
                </div>

                {subjectProperty.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {subjectProperty.photos.map(photo => (
                      <div key={photo.id} className="relative group">
                        <img src={photo.preview} alt="Subject" className="w-full h-24 object-cover rounded-lg" />
                        <button
                          onClick={() => removeSubjectPhoto(photo.id)}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comparables Section */}
            <div className="bg-slate-800 rounded-lg shadow-lg p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-400" />
                  <h2 className="text-xl font-semibold text-white">Comparable Properties ({comparables.length})</h2>
                </div>
              </div>

              {/* IDX Fetch Button */}
              <button
                onClick={fetchFromIDX}
                disabled={loading || !idxConfig.saved}
                className="w-full mb-4 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {loading ? 'Fetching from IDX...' : 'Fetch Comparables from IDX'}
              </button>

              {/* Comparables List */}
              <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {comparables.map((comp) => (
                  <div key={comp.id} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-medium text-white">{comp.address || 'Comparable'}</span>
                      <button
                        onClick={() => deleteComparable(comp.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Comp Photos */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-slate-400 mb-2">Photos</label>
                      {(compPhotos[comp.id] || []).length > 0 ? (
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          {compPhotos[comp.id].map(photo => (
                            <div key={photo.id} className="relative group">
                              <img src={photo.preview} alt="Comp" className="w-full h-16 object-cover rounded" />
                              <button
                                onClick={() => setCompPhotos(prev => ({
                                  ...prev,
                                  [comp.id]: prev[comp.id]?.filter(p => p.id !== photo.id) || []
                                }))}
                                className="absolute top-0.5 right-0.5 bg-red-600 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <label className="cursor-pointer text-xs px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded inline-block">
                        <input type="file" multiple accept="image/*" onChange={(e) => handleCompPhotoUpload(comp.id, e)} className="hidden" />
                        Add Photos
                      </label>
                    </div>

                    {/* Photo Analysis */}
                    {(compPhotos[comp.id] || []).length > 0 && (
                      <button
                        onClick={() => analyzeCompPhotos(comp.id)}
                        disabled={photoAnalyzing}
                        className="mb-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-xs rounded font-medium transition flex items-center gap-2"
                      >
                        {photoAnalyzing ? <Loader className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        {photoAnalyzing ? 'Analyzing...' : 'Analyze Upgrades'}
                      </button>
                    )}

                    {/* Analysis Results */}
                    {photoAnalysis[comp.id] && (
                      <div className="mb-3 p-2 bg-blue-900/30 border border-blue-500/50 rounded text-xs text-slate-300">
                        <p className="font-medium text-blue-300 mb-1">Detected Upgrades:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {photoAnalysis[comp.id].upgrades?.map((upgrade, i) => (
                            <li key={i}>{upgrade}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Comp Form */}
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Address" value={comp.address} onChange={(e) => updateComparable(comp.id, 'address', e.target.value)} className="col-span-2 px-2 py-1 bg-slate-600 border border-slate-500 text-white text-xs rounded placeholder-slate-500" />
                      <input type="text" placeholder="Beds" value={comp.beds} onChange={(e) => updateComparable(comp.id, 'beds', e.target.value)} className="px-2 py-1 bg-slate-600 border border-slate-500 text-white text-xs rounded placeholder-slate-500" />
                      <input type="text" placeholder="Baths" value={comp.baths} onChange={(e) => updateComparable(comp.id, 'baths', e.target.value)} className="px-2 py-1 bg-slate-600 border border-slate-500 text-white text-xs rounded placeholder-slate-500" />
                      <input type="text" placeholder="Sale Price" value={comp.salePrice} onChange={(e) => updateComparable(comp.id, 'salePrice', e.target.value)} className="px-2 py-1 bg-slate-600 border border-slate-500 text-white text-xs rounded placeholder-slate-500" />
                      <input type="text" placeholder="Sale Date" value={comp.saleDate} onChange={(e) => updateComparable(comp.id, 'saleDate', e.target.value)} className="px-2 py-1 bg-slate-600 border border-slate-500 text-white text-xs rounded placeholder-slate-500" />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addComparable}
                className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Comparable
              </button>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateCMAAnalysis}
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              {loading ? <Loader className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
              {loading ? 'Generating Analysis...' : 'Generate CMA Analysis'}
            </button>
          </div>

          {/* Right Column - Output */}
          <div className="lg:col-span-1">
            {analysis ? (
              <div className="bg-slate-800 rounded-lg shadow-lg p-6 sticky top-6 space-y-6 max-h-[calc(100vh-60px)] overflow-y-auto border border-slate-700">
                <div className="border-b border-slate-700 pb-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Market Analysis Report</h3>
                  <p className="text-xs text-slate-500">{new Date().toLocaleDateString()}</p>
                </div>

                {/* Market Analysis */}
                <div>
                  <h4 className="font-semibold text-slate-300 text-sm mb-2">Market Conditions</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{analysis.marketAnalysis}</p>
                </div>

                {/* Subject Summary */}
                <div>
                  <h4 className="font-semibold text-slate-300 text-sm mb-2">Subject Summary</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{analysis.subjectSummary}</p>
                </div>

                {/* Comparable Analysis */}
                <div>
                  <h4 className="font-semibold text-slate-300 text-sm mb-2">Comparable Analysis</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{analysis.comparableAnalysis}</p>
                </div>

                {/* Photo-Based Adjustments */}
                {analysis.photoAdjustments && (
                  <div className="bg-blue-900/30 p-3 rounded border border-blue-500/50">
                    <h4 className="font-semibold text-blue-300 text-sm mb-2">Photo Analysis Adjustments</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{analysis.photoAdjustments}</p>
                  </div>
                )}

                {/* Value Estimate */}
                {showValueEstimate && (
                  <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 p-4 rounded-lg border-2 border-green-500/50">
                    <h4 className="font-semibold text-slate-100 text-sm mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      Estimated Market Value
                    </h4>
                    <p className="text-sm text-slate-300 leading-relaxed mb-3">{analysis.valueConclusion}</p>
                    <div className="bg-slate-700/50 px-3 py-2 rounded border border-slate-600">
                      <p className="text-xs text-slate-400 mb-1 font-medium">DISCLAIMER</p>
                      <p className="text-xs text-slate-500 leading-tight">
                        This analysis is AI-generated and for informational purposes only. It does not constitute a professional appraisal. Consult a licensed appraiser for official valuations.
                      </p>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <div>
                  <h4 className="font-semibold text-slate-300 text-sm mb-2">Recommendations</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{analysis.recommendations}</p>
                </div>

                {/* Controls */}
                <div className="pt-4 border-t border-slate-700 space-y-2">
                  <button
                    onClick={() => setShowValueEstimate(!showValueEstimate)}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition ${showValueEstimate ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                  >
                    {showValueEstimate ? '✓ Show' : '✗ Hide'} Value Estimate
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition"
                  >
                    📄 Print Report
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-6 text-center sticky top-6 border border-slate-700">
                <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">
                  Complete subject property and comparables, then click "Generate CMA Analysis" to view results here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}