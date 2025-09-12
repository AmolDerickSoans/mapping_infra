import { useState, useEffect } from 'react';
import Map, { NavigationControl } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import './App.css';
import type { PowerPlant } from './models/PowerPlant';
import type { Cable } from './models/Cable';
import type { TerrestrialLink } from './models/TerrestrialLink';
import { loadInfrastructureData } from './utils/dataLoader';
import { loadWfsCableData } from './utils/wfsDataLoader';
import { loadAndProcessPowerPlants } from './utils/powerPlantProcessor';
import { loadAndProcessAmericanPowerPlants } from './utils/americanPowerPlantProcessor';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Header from './components/Header';
import Footer from './components/Footer';

// Mapbox token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN_HERE';

// Define color mapping for power plant sources
const POWER_PLANT_COLORS: Record<string, [number, number, number]> = {
  'hydro': [31, 119, 180],
  'gas': [255, 127, 14],
  'wind': [44, 160, 44],
  'nuclear': [214, 39, 40],
  'coal': [100, 100, 100],
  'solar': [255, 215, 0],
  'oil': [80, 80, 80],
  'biomass': [150, 150, 50],
  'battery': [70, 130, 180],
  'diesel': [120, 120, 120],
  'geothermal': [200, 100, 50],
  'tidal': [0, 100, 200],
  'waste': [120, 90, 40],
  'biofuel': [160, 130, 50],
  'other': [148, 103, 189]
};

// Orange color for cables
const CABLE_COLOR: [number, number, number] = [255, 165, 0]; // Orange color

function App() {
  const { theme } = useTheme();
  const [powerPlants, setPowerPlants] = useState<PowerPlant[]>([]);
  const [cables, setCables] = useState<Cable[]>([]);
  const [terrestrialLinks, setTerrestrialLinks] = useState<TerrestrialLink[]>([]);
  const [wfsCables, setWfsCables] = useState<Cable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPowerPlants, setShowPowerPlants] = useState<boolean>(true);
  const [showCables, setShowCables] = useState<boolean>(true);
  const [showTerrestrialLinks, setShowTerrestrialLinks] = useState<boolean>(true); // Add this line
  const [showWfsCables, setShowWfsCables] = useState<boolean>(true);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  // State for filtering power plants by source
  const [filteredSources, setFilteredSources] = useState<Set<string>>(new Set());
  // State for energy size scaling (adjusted for the data range)
  const [energySizeScale, setEnergySizeScale] = useState<number>(0.8);
  // State for country filtering
  const [showCanadianPlants, setShowCanadianPlants] = useState<boolean>(true);
  const [showAmericanPlants, setShowAmericanPlants] = useState<boolean>(true);

  // Toggle source filter
  const toggleSourceFilter = (source: string) => {
    setFilteredSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(source)) {
        newSet.delete(source);
      } else {
        newSet.add(source);
      }
      return newSet;
    });
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        // Load Canadian power plant data
        const canadianPowerPlantData = await loadAndProcessPowerPlants();
        
        // Load American power plant data
        const americanPowerPlantData = await loadAndProcessAmericanPowerPlants();
        
        // Combine both datasets
        const powerPlantData = [...canadianPowerPlantData, ...americanPowerPlantData];
        
        // Load infrastructure data
        const infrastructureData = await loadInfrastructureData('/data/infrastructure.geojson');
        
        // Load WFS submarine cable data
        const wfsCableData = await loadWfsCableData();
        
        setPowerPlants(powerPlantData);
        setCables(infrastructureData.cables);
        setTerrestrialLinks(infrastructureData.terrestrialLinks);
        setWfsCables(wfsCableData);
        
        // Initialize filtered sources with all unique sources from the data
        const uniqueSources = new Set(powerPlantData.map(plant => plant.source));
        console.log('Unique sources in data:', Array.from(uniqueSources));
        setFilteredSources(new Set(Array.from(uniqueSources).filter(source => source !== 'other')));
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Filter power plants based on selected sources and countries
  const filteredPowerPlants = powerPlants.filter(plant => {
    // Existing source filtering
    const passesSourceFilter = filteredSources.has(plant.source) || plant.source === 'other';
    
    // New country filtering
    const passesCountryFilter = 
      (showCanadianPlants && plant.country === 'CA') || 
      (showAmericanPlants && plant.country === 'US');
    
    return passesSourceFilter && passesCountryFilter;
  });
  
  // Get all unique sources from the data for the legend
  const allSourcesInData = Array.from(new Set(powerPlants.map(plant => plant.source))).sort();

  // Define a color for terrestrial links
  const TERRESTRIAL_LINK_COLOR: [number, number, number] = [0, 255, 0]; // Green color

  // Define layer visibility
  const layers = [
    showPowerPlants && new ScatterplotLayer({
      id: 'power-plants',
      data: filteredPowerPlants,
      pickable: true,
      opacity: 0.8,
      filled: true,
      radiusMinPixels: 2,
      radiusMaxPixels: 40,
      getPosition: (d: PowerPlant) => d.coordinates,
      getRadius: (d: PowerPlant) => Math.sqrt(d.output) * energySizeScale, // Use energy size scale
      getFillColor: (d: PowerPlant) => {
        const source = d.source;
        return POWER_PLANT_COLORS[source] || POWER_PLANT_COLORS.other;
      },
      onHover: (info: any) => setHoverInfo(info.object),
      onClick: (info: any) => console.log('Clicked:', info.object)
    }),
    showCables && new PathLayer({
      id: 'cables',
      data: cables,
      pickable: true,
      widthMinPixels: 1, // Thinner cables
      getPath: (d: Cable) => d.coordinates,
      getColor: CABLE_COLOR, // Orange color
      getWidth: 2, // Thinner cables
      onHover: (info: any) => setHoverInfo(info.object)
    }),
    // Add a layer for terrestrial links with visibility control
    showTerrestrialLinks && new PathLayer({
      id: 'terrestrial-links',
      data: terrestrialLinks,
      pickable: true,
      widthMinPixels: 1,
      getPath: (d: TerrestrialLink) => d.coordinates,
      getColor: TERRESTRIAL_LINK_COLOR, // Green color
      getWidth: 2,
      onHover: (info: any) => setHoverInfo(info.object)
    }),
    showWfsCables && new PathLayer({
      id: 'wfs-cables',
      data: wfsCables,
      pickable: true,
      widthMinPixels: 1, // Thinner cables
      getPath: (d: Cable) => d.coordinates,
      getColor: CABLE_COLOR, // Orange color
      getWidth: 2, // Thinner cables
      onHover: (info: any) => setHoverInfo(info.object)
    })
  ].filter(Boolean);

  return (
    <div className="app-container">
      <Header />
      {loading && (
        <div className="loading-indicator">
          Loading data...
        </div>
      )}

      <div className="map-container">
        <DeckGL
          initialViewState={{
            longitude: -95,
            latitude: 55,
            zoom: 3,
            pitch: 0,
            bearing: 0
          }}
          controller={true}
          layers={layers}
        >
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={theme === 'dark' ? "mapbox://styles/mapbox/dark-v10" : "mapbox://styles/mapbox/light-v10"}
          >
            <NavigationControl position="top-right" />
          </Map>
        </DeckGL>
      </div>
      <Footer />
      
      {/* Revamped Control Panel */}
      <div className="control-panel">
        <div className="control-section">
          <h3>Layers</h3>
          <div className="checkbox-group">
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={showPowerPlants}
                onChange={() => setShowPowerPlants(!showPowerPlants)}
              />
              <span className="checkmark"></span>
              Power Plants
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={showCables}
                onChange={() => setShowCables(!showCables)}
              />
              <span className="checkmark"></span>
              Cables
            </label>
            {/* Add checkbox for terrestrial links */}
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={showTerrestrialLinks}
                onChange={() => setShowTerrestrialLinks(!showTerrestrialLinks)}
              />
              <span className="checkmark"></span>
              Terrestrial Links
            </label>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={showWfsCables}
                onChange={() => setShowWfsCables(!showWfsCables)}
              />
              <span className="checkmark"></span>
              ITU Cable Systems
            </label>
          </div>
        </div>
        
        <div className="control-section">
          <h3>Countries</h3>
          <div className="country-filter">
            <button 
              className={`country-button ${showCanadianPlants ? 'active' : 'inactive'}`}
              onClick={() => setShowCanadianPlants(!showCanadianPlants)}
            >
              <div className="flag-icon">🇨🇦</div>
            </button>
            <button 
              className={`country-button ${showAmericanPlants ? 'active' : 'inactive'}`}
              onClick={() => setShowAmericanPlants(!showAmericanPlants)}
            >
              <div className="flag-icon">🇺🇸</div>
            </button>
          </div>
        </div>
        
        <div className="control-section">
          <h3>Energy Size</h3>
          <div className="slider-container">
            <span className="slider-label">Small</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={energySizeScale}
              onChange={(e) => setEnergySizeScale(Number(e.target.value))}
              className="energy-slider"
            />
            <span className="slider-label">Large</span>
            <span className="slider-value">{energySizeScale.toFixed(1)}</span>
          </div>
        </div>
      </div>
      
      {/* Revamped Legend */}
      <div className="legend-panel">
        <h3>Power Plant Types</h3>
        <div className="legend-grid">
          {allSourcesInData.map((source) => {
            // Skip 'other' for now, we'll add it at the end
            if (source === 'other') return null;
            
            const color = POWER_PLANT_COLORS[source] || POWER_PLANT_COLORS.other;
            return (
              <div 
                className={`legend-item ${filteredSources.has(source) ? 'active' : 'inactive'}`}
                key={source}
                onClick={() => toggleSourceFilter(source)}
              >
                <div 
                  className="legend-color" 
                  style={{ 
                    backgroundColor: `rgb(${color.join(',')})`
                  }}
                ></div>
                <span className="legend-label">
                  {source.charAt(0).toUpperCase() + source.slice(1)}
                </span>
              </div>
            );
          })}
          {/* Add 'Other' at the end */}
          <div 
            className={`legend-item ${filteredSources.has('other') ? 'active' : 'inactive'}`}
            key="other"
            onClick={() => toggleSourceFilter('other')}
          >
            <div 
              className="legend-color" 
              style={{ 
                backgroundColor: `rgb(${POWER_PLANT_COLORS.other.join(',')})`
              }}
            ></div>
            <span className="legend-label">Other</span>
          </div>
        </div>
        
        <div className="legend-section">
          <h4>Infrastructure</h4>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: `rgb(${CABLE_COLOR.join(',')})` }}></div>
            <span className="legend-label">Submarine Cables</span>
          </div>
          {/* Add legend item for terrestrial links */}
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: `rgb(${TERRESTRIAL_LINK_COLOR.join(',')})` }}></div>
            <span className="legend-label">Terrestrial Links</span>
          </div>
        </div>
      </div>
      
      {/* Info Panel */}
      {hoverInfo && (
        <div className="info-panel">
          <h3>{hoverInfo.name}</h3>
          {hoverInfo.outputDisplay && <p>Output: {hoverInfo.outputDisplay}</p>}
          {hoverInfo.source && <p>Source: {hoverInfo.source}</p>}
        </div>
      )}
    </div>
  );
}

const AppWrapper: React.FC = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

export default AppWrapper;