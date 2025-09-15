import { useState, useEffect } from 'react';
import Map, { NavigationControl } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import './App.css';
import type { PowerPlant } from './models/PowerPlant';
import type { Cable } from './models/Cable';
import type { TerrestrialLink } from './models/TerrestrialLink';
import { loadWfsCableData } from './utils/wfsDataLoader';
import { loadAndProcessAllPowerPlants } from './utils/unifiedPowerPlantProcessor';
import { loadInfrastructureData } from './utils/dataLoader';
import { isPointNearLine } from './utils/geoUtils';
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
  const [wfsCables, setWfsCables] = useState<Cable[]>([]);
  const [terrestrialLinks, setTerrestrialLinks] = useState<TerrestrialLink[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPowerPlants, setShowPowerPlants] = useState<boolean>(true);
  const [showWfsCables, setShowWfsCables] = useState<boolean>(true);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  // State for filtering power plants by source
  const [filteredSources, setFilteredSources] = useState<Set<string>>(new Set());
  // State for power output range filtering (0 MW to 10000 MW)
  const [minPowerOutput, setMinPowerOutput] = useState<number>(0);
  const [maxPowerOutput, setMaxPowerOutput] = useState<number>(10000);
  // State for country filtering
  const [showCanadianPlants, setShowCanadianPlants] = useState<boolean>(true);
  const [showAmericanPlants, setShowAmericanPlants] = useState<boolean>(true);
  // State for proximity filtering
  const [showOnlyNearbyPlants, setShowOnlyNearbyPlants] = useState<boolean>(false);
  // State for proximity distance
  const [proximityDistance, setProximityDistance] = useState<number>(0); // Changed from 10 to 0 miles
  // State for accordion sections - all minimized by default
  const [isLayersSectionOpen, setIsLayersSectionOpen] = useState<boolean>(false);
  const [isCountriesSectionOpen, setIsCountriesSectionOpen] = useState<boolean>(false);
  const [isPowerOutputSectionOpen, setIsPowerOutputSectionOpen] = useState<boolean>(false);
  const [isNearbyPlantsSectionOpen, setIsNearbyPlantsSectionOpen] = useState<boolean>(false);

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
        // Load all power plant data using the new unified processor
        const powerPlantData = await loadAndProcessAllPowerPlants();

        // Load WFS submarine cable data (unchanged)
        const wfsCableData = await loadWfsCableData();

        // Load terrestrial link data
        const { terrestrialLinks: terrestrialLinkData } = await loadInfrastructureData('data/infrastructure.geojson');

        setPowerPlants(powerPlantData);
        setWfsCables(wfsCableData);
        setTerrestrialLinks(terrestrialLinkData);
        
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

  // Filter power plants based on selected sources, countries, power output range, and proximity
  const filteredPowerPlants = powerPlants.filter(plant => {
    // Existing source filtering
    const passesSourceFilter = filteredSources.has(plant.source) || plant.source === 'other';
    
    // New country filtering
    const passesCountryFilter = 
      (showCanadianPlants && plant.country === 'CA') || 
      (showAmericanPlants && plant.country === 'US');
    
    // New power output range filtering
    const passesPowerOutputFilter = plant.output >= minPowerOutput && plant.output <= maxPowerOutput;

    // New "nearby plants" filtering - check against both terrestrial links and submarine cables
    let passesNearbyFilter = true;
    if (showOnlyNearbyPlants && (terrestrialLinks.length > 0 || wfsCables.length > 0)) {
      // Check if plant is within specified distance of any terrestrial link or submarine cable
      passesNearbyFilter = false;
      
      // Check terrestrial links
      for (const link of terrestrialLinks) {
        if (isPointNearLine(plant.coordinates, link.coordinates, proximityDistance)) {
          passesNearbyFilter = true;
          break;
        }
      }
      
      // If not near terrestrial links, check submarine cables
      if (!passesNearbyFilter) {
        for (const cable of wfsCables) {
          if (isPointNearLine(plant.coordinates, cable.coordinates, proximityDistance)) {
            passesNearbyFilter = true;
            break;
          }
        }
      }
    }

    return passesSourceFilter && passesCountryFilter && passesPowerOutputFilter && passesNearbyFilter;
  });
  
  // Get all unique sources from the data for the legend
  const allSourcesInData = Array.from(new Set(powerPlants.map(plant => plant.source))).sort();

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
      // Improved scaling algorithm that works better with the wide range of power outputs
      getRadius: (d: PowerPlant) => {
        // Logarithmic scaling to handle the wide range of outputs (1MW to 6000+ MW)
        // This will make the slider more effective across the entire range
        const logOutput = Math.log10(Math.max(d.output, 1)); // log10(1) = 0, log10(1000) = 3, etc.
        // Scale the log output to a reasonable range (0 to 10)
        const scaledOutput = (logOutput / 4) * 10; // 4 is roughly log10(10000), gives us a 0-10 range
        return Math.max(2, Math.min(40, scaledOutput));
      },
      getFillColor: (d: PowerPlant) => {
        const source = d.source;
        return POWER_PLANT_COLORS[source] || POWER_PLANT_COLORS.other;
      },
      onHover: (info: any) => setHoverInfo(info.object),
      onClick: (info: any) => console.log('Clicked:', info.object)
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
          <div className="accordion-header" onClick={() => setIsLayersSectionOpen(!isLayersSectionOpen)}>
            <h3>Layers</h3>
            <span className="accordion-icon">{isLayersSectionOpen ? '▲' : '▼'}</span>
          </div>
          {isLayersSectionOpen && (
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
                  checked={showWfsCables}
                  onChange={() => setShowWfsCables(!showWfsCables)}
                />
                <span className="checkmark"></span>
                Terrestrial Links (ITU)
              </label>
            </div>
          )}
        </div>
        
        <div className="control-section">
          <div className="accordion-header" onClick={() => setIsCountriesSectionOpen(!isCountriesSectionOpen)}>
            <h3>Countries</h3>
            <span className="accordion-icon">{isCountriesSectionOpen ? '▲' : '▼'}</span>
          </div>
          {isCountriesSectionOpen && (
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
          )}
        </div>
        
        <div className="control-section">
          <div className="accordion-header" onClick={() => setIsPowerOutputSectionOpen(!isPowerOutputSectionOpen)}>
            <h3>Power Output Range</h3>
            <span className="accordion-icon">{isPowerOutputSectionOpen ? '▲' : '▼'}</span>
          </div>
          {isPowerOutputSectionOpen && (
            <div className="power-range-container">
              <div className="range-values">
                <span className="range-value">{minPowerOutput} MW</span>
                <span className="range-value">{maxPowerOutput} MW</span>
              </div>
              <div className="range-slider-wrapper">
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="10"
                  value={minPowerOutput}
                  onChange={(e) => setMinPowerOutput(Number(e.target.value))}
                  className="range-slider"
                />
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="10"
                  value={maxPowerOutput}
                  onChange={(e) => setMaxPowerOutput(Number(e.target.value))}
                  className="range-slider"
                />
              </div>
              <div className="range-labels">
                <span className="range-label">0 MW</span>
                <span className="range-label">10,000 MW</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="control-section">
          <div className="accordion-header" onClick={() => setIsNearbyPlantsSectionOpen(!isNearbyPlantsSectionOpen)}>
            <h3>Nearby Plants</h3>
            <span className="accordion-icon">{isNearbyPlantsSectionOpen ? '▲' : '▼'}</span>
          </div>
          {isNearbyPlantsSectionOpen && (
            <>
              <div className="checkbox-group">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={showOnlyNearbyPlants}
                    onChange={() => setShowOnlyNearbyPlants(!showOnlyNearbyPlants)}
                  />
                  <span className="checkmark"></span>
                  Show only plants near terrestrial links
                </label>
              </div>
              
              {/* Proximity slider - visible when section is expanded */}
              <div className="proximity-control">
                <div className="slider-header">
                  <span className="slider-label">Distance Range</span>
                  <span className="slider-value">{proximityDistance} miles</span>
                </div>
                <div className="proximity-slider-container">
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={proximityDistance}
                    onChange={(e) => setProximityDistance(Number(e.target.value))}
                    className="proximity-slider"
                    disabled={!showOnlyNearbyPlants}
                  />
                  <div className="slider-labels">
                    <span>0 miles</span>
                    <span>50 miles</span>
                  </div>
                </div>
              </div>
            </>
          )}
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
          {/* Update legend labels */}
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: `rgb(${CABLE_COLOR.join(',')})` }}></div>
            <span className="legend-label">Terrestrial Links</span>
          </div>
        </div>
      </div>
      
      {/* Enhanced Info Panel */}
      {hoverInfo && (
        <div className="info-panel">
          <h3>{hoverInfo.name}</h3>
          <p>Output: {hoverInfo.outputDisplay}</p>
          <p>Source: {hoverInfo.source}</p>
          
          {/* Additional details from rawData */}
          {hoverInfo.rawData && (
            <>
              {hoverInfo.rawData['City (Site Name)'] && <p>City: {hoverInfo.rawData['City (Site Name)']}</p>}
              {hoverInfo.rawData['State / Province / Territory'] && <p>State/Province: {hoverInfo.rawData['State / Province / Territory']}</p>}
              {hoverInfo.rawData['County'] && <p>County: {hoverInfo.rawData['County']}</p>}
              {hoverInfo.rawData['Owner Name (Company)'] && <p>Owner: {hoverInfo.rawData['Owner Name (Company)']}</p>}
              {hoverInfo.rawData['Operator Name'] && <p>Operator: {hoverInfo.rawData['Operator Name']}</p>}
              {hoverInfo.rawData['Address'] && <p>Address: {hoverInfo.rawData['Address']}</p>}
              {hoverInfo.rawData['Zip Code / Postal Code'] && <p>Postal Code: {hoverInfo.rawData['Zip Code / Postal Code']}</p>}
              <p>Coordinates: {hoverInfo.coordinates[1].toFixed(4)}, {hoverInfo.coordinates[0].toFixed(4)}</p>
            </>
          )}
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