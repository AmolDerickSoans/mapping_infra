import { useState, useEffect, useMemo } from 'react';
import Map, { NavigationControl } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import './App.css';
import type { PowerPlant } from './models/PowerPlant';
import type { Cable } from './models/Cable';
import { loadWfsCableData } from './utils/wfsDataLoader';
import { loadAndProcessAllPowerPlants } from './utils/unifiedPowerPlantProcessor';
import { loadInfrastructureData } from './utils/dataLoader';
import { isPointNearLine } from './utils/geoUtils';
import { createLineIndex, queryLineIndex } from './utils/spatialIndex';
import { calculatePowerRange, type PowerRange } from './utils/powerRangeCalculator';
import RBush from 'rbush';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Header from './components/Header';
import Footer from './components/Footer';
import SidePanel from './components/SidePanel';
import { Search, MapPin, X } from 'lucide-react';

// SizeByOption type as per MAP_FEATURES_DOCUMENTATION.md
type SizeByOption = 'nameplate_capacity' | 'capacity_factor' | 'generation';

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
  const [lineIndex, setLineIndex] = useState<RBush<any> | null>(null);
   const [powerRange, setPowerRange] = useState<PowerRange>({ min: 0, max: 10000 });
   // Circle sizing state variables as per MAP_FEATURES_DOCUMENTATION.md
   const [sizeMultiplier, setSizeMultiplier] = useState<number>(2);
    const [capacityWeight, setCapacityWeight] = useState<number>(0.1);
    const [sizeByOption, setSizeByOption] = useState<SizeByOption>('nameplate_capacity');
    const [showSummerCapacity, setShowSummerCapacity] = useState<boolean>(false);
     // State for persistent tooltip
     const [isTooltipPersistent, setIsTooltipPersistent] = useState<boolean>(false);

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

   // CTA handler functions
   const handleGoogleSearch = (plantName: string, source?: string, owner?: string) => {
     // Build search query with context: name + source + owner + "powerplant"
     const searchTerms = [plantName];
     if (source) searchTerms.push(source);
     if (owner) searchTerms.push(owner);
     searchTerms.push('powerplant');

     const searchQuery = searchTerms.join(' ');
     const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
     window.open(searchUrl, '_blank', 'noopener,noreferrer');
   };

  const handleGoogleMaps = (coordinates: [number, number]) => {
    const [lng, lat] = coordinates;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
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

        // Calculate actual power range from data
        const calculatedRange = calculatePowerRange(powerPlantData);
        setPowerRange(calculatedRange);

        // Update current filter values to fit within new range if needed
        setMinPowerOutput(prev => Math.max(prev, calculatedRange.min));
        setMaxPowerOutput(prev => Math.min(prev, calculatedRange.max));

        // Create spatial index for both terrestrial links and submarine cables
        const allLines = [...terrestrialLinkData, ...wfsCableData];
        const index = createLineIndex(allLines);
        setLineIndex(index);

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
    if (showOnlyNearbyPlants && lineIndex) {
      const nearbySegments = queryLineIndex(lineIndex, plant.coordinates, proximityDistance);
      passesNearbyFilter = false;
      for (const segment of nearbySegments) {
        if (isPointNearLine(plant.coordinates, segment, proximityDistance)) {
          passesNearbyFilter = true;
          break;
        }
      }
    }

    return passesSourceFilter && passesCountryFilter && passesPowerOutputFilter && passesNearbyFilter;
  });
  
  // Get all unique sources from the data for the legend
  const allSourcesInData = Array.from(new Set(powerPlants.map(plant => plant.source))).sort();

  // Count power plants by source
  const powerPlantCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    powerPlants.forEach(plant => {
      counts[plant.source] = (counts[plant.source] || 0) + 1;
    });
    // Add cable count
    counts['cables'] = wfsCables.length;
    return counts;
  }, [powerPlants, wfsCables]);

  const layers = useMemo(() => {
    return [
      showPowerPlants && new ScatterplotLayer({
      id: 'power-plants',
      data: filteredPowerPlants,
      pickable: true,
      opacity: 0.8,
      filled: true,
      radiusUnits: 'pixels',           // ✅ keep in pixels
      radiusMinPixels: 2,
      radiusMaxPixels: 100,            // ✅ cap to avoid huge blobs
      getPosition: (d: PowerPlant) => d.coordinates,
      getRadius: (d: PowerPlant) => {
        let value;
        switch (sizeByOption) {
          case 'nameplate_capacity':
            value = d.output;
            break;
          case 'capacity_factor':
            value = d.capacityFactor || d.output;
            break;
          case 'generation':
            value = d.generation || d.output;
            break;
          default:
            value = d.output;
        }

        // Log-scale normalization
        const logValue = Math.log10(Math.max(value, 1));
        const logMin = Math.log10(Math.max(powerRange.min, 1));
        const logMax = Math.log10(Math.max(powerRange.max, 1));
        const normalized =
          logMax > logMin ? (logValue - logMin) / (logMax - logMin) : 0;

        // Final radius: base size + emphasis factor
        return sizeMultiplier + capacityWeight * normalized * 10;
      },
      updateTriggers: {
        getRadius: [sizeMultiplier, capacityWeight, sizeByOption, powerRange],
      },
      getFillColor: (d: PowerPlant) =>
        POWER_PLANT_COLORS[d.source] || POWER_PLANT_COLORS.other,
      onHover: (info: any) => setHoverInfo(info.object),
       onClick: (info: any) => {
         if (info.object) {
           setHoverInfo(info.object);
           setIsTooltipPersistent(true);
         }
       },
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
  }, [filteredPowerPlants, showPowerPlants, showWfsCables, wfsCables, sizeMultiplier, capacityWeight, sizeByOption, setHoverInfo, powerRange]);

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

      {/* Unified Side Panel */}
      <SidePanel
        showPowerPlants={showPowerPlants}
        showWfsCables={showWfsCables}
        onTogglePowerPlants={() => setShowPowerPlants(!showPowerPlants)}
        onToggleWfsCables={() => setShowWfsCables(!showWfsCables)}
        filteredSources={filteredSources}
        onToggleSourceFilter={toggleSourceFilter}
        showCanadianPlants={showCanadianPlants}
        showAmericanPlants={showAmericanPlants}
        onToggleCanadianPlants={() => setShowCanadianPlants(!showCanadianPlants)}
        onToggleAmericanPlants={() => setShowAmericanPlants(!showAmericanPlants)}
        minPowerOutput={minPowerOutput}
        maxPowerOutput={maxPowerOutput}
        onMinPowerOutputChange={setMinPowerOutput}
        onMaxPowerOutputChange={setMaxPowerOutput}
        powerRange={powerRange}
        showOnlyNearbyPlants={showOnlyNearbyPlants}
        proximityDistance={proximityDistance}
        onToggleNearbyPlants={() => setShowOnlyNearbyPlants(!showOnlyNearbyPlants)}
        onProximityDistanceChange={setProximityDistance}
        sizeMultiplier={sizeMultiplier}
        setSizeMultiplier={setSizeMultiplier}
        capacityWeight={capacityWeight}
        setCapacityWeight={setCapacityWeight}
        sizeByOption={sizeByOption}
        setSizeByOption={setSizeByOption}
        showSummerCapacity={showSummerCapacity}
        setShowSummerCapacity={setShowSummerCapacity}
        powerPlants={powerPlants}
        allSourcesInData={allSourcesInData}
        powerPlantCounts={powerPlantCounts}
      />
      
       {/* Unified Info Panel */}
       {hoverInfo && (
         <div className="info-panel">
           {/* Close button only when persistent */}
           {isTooltipPersistent && (
             <button
               className="close-button"
               onClick={() => {
                 setIsTooltipPersistent(false);
                 setHoverInfo(null);
               }}
               aria-label="Close tooltip"
             >
               <X size={16} />
             </button>
           )}

           <h3>{hoverInfo.name}</h3>
           <p>Output: {hoverInfo.outputDisplay}</p>
           <p>Source: {hoverInfo.source}</p>

           {/* Additional details from rawData - shown when persistent */}
           {isTooltipPersistent && hoverInfo.rawData && (
             <>
               {hoverInfo.rawData['City (Site Name)'] && <p>City: {hoverInfo.rawData['City (Site Name)']}</p>}
               {hoverInfo.rawData['State / Province / Territory'] && <p>State/Province: {hoverInfo.rawData['State / Province / Territory']}</p>}
               {hoverInfo.rawData['County'] && <p>County: {hoverInfo.rawData['County']}</p>}
               {hoverInfo.rawData['Owner Name (Company)'] && <p>Owner: {hoverInfo.rawData['Owner Name (Company)']}</p>}
               {hoverInfo.rawData['Operator Name'] && <p>Operator: {hoverInfo.rawData['Operator Name']}</p>}
               {hoverInfo.rawData['Address'] && <p>Address: {hoverInfo.rawData['Address']}</p>}
               {hoverInfo.rawData['Zip Code / Postal Code'] && <p>Postal Code: {hoverInfo.rawData['Zip Code / Postal Code']}</p>}
               <p>Coordinates: {hoverInfo.coordinates[1].toFixed(4)}, {hoverInfo.coordinates[0].toFixed(4)}</p>

               {/* CTA Buttons */}
               <div className="cta-buttons">
                 <button
                   onClick={() => handleGoogleSearch(
                     hoverInfo.name,
                     hoverInfo.source,
                     hoverInfo.rawData?.['Owner Name (Company)']
                   )}
                   aria-label={`Search for ${hoverInfo.name} powerplant on Google`}
                 >
                   <Search size={16} />
                   View on Google
                 </button>
                 <button
                   onClick={() => handleGoogleMaps(hoverInfo.coordinates)}
                   aria-label={`View ${hoverInfo.name} location on Google Maps`}
                 >
                   <MapPin size={16} />
                   View on Google Maps
                 </button>
               </div>
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