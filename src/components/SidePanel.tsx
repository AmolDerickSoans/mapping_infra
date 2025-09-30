import React, { useState, useMemo } from 'react';
import TabNavigation, { type TabItem } from './TabNavigation';
import LayersFiltersTab from './LayersFiltersTab';
import LegendTab from './LegendTab';
import VisualizationTab from './VisualizationTab';
import DataVisualizations from './DataVisualizations';
import type { PowerRange } from '../utils/powerRangeCalculator';
import type { PowerPlant } from '../models/PowerPlant';
import { getCableCacheStats, clearCableCache } from '../utils/wfsDataLoader';
import './SidePanel.css';

interface SidePanelProps {
  // Layer visibility
  showPowerPlants: boolean;
  showWfsCables: boolean;
  onTogglePowerPlants: () => void;
  onToggleWfsCables: () => void;

  // Filtering state
  filteredSources: Set<string>;
  onToggleSourceFilter: (source: string) => void;
  allStatuses: string[];
  filteredStatuses: Set<string>;
  onToggleStatusFilter: (status: string) => void;
  showCanadianPlants: boolean;
  showAmericanPlants: boolean;
  onToggleCanadianPlants: () => void;
  onToggleAmericanPlants: () => void;
  minPowerOutput: number;
  maxPowerOutput: number;
  onMinPowerOutputChange: (value: number) => void;
  onMaxPowerOutputChange: (value: number) => void;

  // Power range limits
  powerRange: PowerRange;

  // Capacity factor filtering
  minCapacityFactor: number;
  maxCapacityFactor: number;
  onMinCapacityFactorChange: (value: number) => void;
  onMaxCapacityFactorChange: (value: number) => void;

    // Proximity filtering
    showOnlyNearbyPlants: boolean;
    proximityDistance: number;
    onToggleNearbyPlants: () => void;
    onProximityDistanceChange: (value: number) => void;
    proximityPlantCount: number;
    onOpenProximityDialog: () => void;

   // Visualization controls
   sizeMultiplier: number;
   setSizeMultiplier: (value: number) => void;
   capacityWeight: number;
   setCapacityWeight: (value: number) => void;
    sizeByOption: 'nameplate_capacity' | 'capacity_factor' | 'generation' | 'net_summer_capacity' | 'net_winter_capacity';
    setSizeByOption: (value: 'nameplate_capacity' | 'capacity_factor' | 'generation' | 'net_summer_capacity' | 'net_winter_capacity') => void;
   showSummerCapacity: boolean;
   setShowSummerCapacity: (value: boolean) => void;

  // Data
  powerPlants: PowerPlant[];
  allSourcesInData: string[];
  powerPlantCounts?: Record<string, number>;

  // UI state
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;

  // Search functionality
  selectedPlantIds: Set<string>;
  onPlantSelect: (plantId: string) => void;
  onPlantDeselect: (plantId: string) => void;
  onApplySelection: () => void;
}

const SidePanel: React.FC<SidePanelProps> = ({
  // Layer visibility
  showPowerPlants,
  showWfsCables,
  onTogglePowerPlants,
  onToggleWfsCables,

  // Filtering
  filteredSources,
  onToggleSourceFilter,
  allStatuses,
  filteredStatuses,
  onToggleStatusFilter,
  showCanadianPlants,
  showAmericanPlants,
  onToggleCanadianPlants,
  onToggleAmericanPlants,
  minPowerOutput,
  maxPowerOutput,
    onMinPowerOutputChange,
    onMaxPowerOutputChange,
    powerRange,
    minCapacityFactor,
    maxCapacityFactor,
    onMinCapacityFactorChange,
    onMaxCapacityFactorChange,

    // Proximity
   showOnlyNearbyPlants,
   proximityDistance,
   onToggleNearbyPlants,
   onProximityDistanceChange,
   proximityPlantCount,
   onOpenProximityDialog,

   // Visualization controls
   sizeMultiplier,
   setSizeMultiplier,
   capacityWeight,
   setCapacityWeight,
   sizeByOption,
   setSizeByOption,
   showSummerCapacity,
   setShowSummerCapacity,

  // Data
  powerPlants,
  allSourcesInData,
  powerPlantCounts,

  // Search functionality
  selectedPlantIds,
  onPlantSelect,
  onPlantDeselect,
  onApplySelection,

  // UI
  isCollapsed = false,
  onToggleCollapsed,
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'legend' | 'visualization' | 'data'>('layers');

  // Define tabs
  const tabs: TabItem[] = useMemo(() => [
    {
      id: 'layers',
      label: 'Layers & Filters',
      icon: 'layers',
    },
    {
      id: 'legend',
      label: 'Legend',
      icon: 'legend',
    },
    {
      id: 'visualization',
      label: 'Visualization',
      icon: 'palette',
    },
    {
      id: 'data',
      label: 'Data & Export',
      icon: 'database',
    },
  ], []);

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'layers':
        return (
              <LayersFiltersTab
                showPowerPlants={showPowerPlants}
                showWfsCables={showWfsCables}
                onTogglePowerPlants={onTogglePowerPlants}
                onToggleWfsCables={onToggleWfsCables}
                showCanadianPlants={showCanadianPlants}
                showAmericanPlants={showAmericanPlants}
                onToggleCanadianPlants={onToggleCanadianPlants}
                onToggleAmericanPlants={onToggleAmericanPlants}
                allStatuses={allStatuses}
                filteredStatuses={filteredStatuses}
                onToggleStatusFilter={onToggleStatusFilter}
                minPowerOutput={minPowerOutput}
                maxPowerOutput={maxPowerOutput}
                onMinPowerOutputChange={onMinPowerOutputChange}
                onMaxPowerOutputChange={onMaxPowerOutputChange}
                powerRange={powerRange}
                minCapacityFactor={minCapacityFactor}
                maxCapacityFactor={maxCapacityFactor}
                onMinCapacityFactorChange={onMinCapacityFactorChange}
                onMaxCapacityFactorChange={onMaxCapacityFactorChange}
                showOnlyNearbyPlants={showOnlyNearbyPlants}
                proximityDistance={proximityDistance}
                onToggleNearbyPlants={onToggleNearbyPlants}
                onProximityDistanceChange={onProximityDistanceChange}
                proximityPlantCount={proximityPlantCount}
                onOpenProximityDialog={onOpenProximityDialog}
              />
        );

       case 'legend':
        return (
           <LegendTab
             allSourcesInData={allSourcesInData}
             filteredSources={filteredSources}
             onToggleSourceFilter={onToggleSourceFilter}
             showWfsCables={showWfsCables}
             onToggleWfsCables={onToggleWfsCables}
             powerPlantCounts={powerPlantCounts}
             powerPlants={powerPlants}
             selectedPlantIds={selectedPlantIds}
             onPlantSelect={onPlantSelect}
             onPlantDeselect={onPlantDeselect}
             onApplySelection={onApplySelection}
           />
        );

      case 'visualization':
        return (
              <VisualizationTab
                sizeMultiplier={sizeMultiplier}
                setSizeMultiplier={setSizeMultiplier}
                capacityWeight={capacityWeight}
                setCapacityWeight={setCapacityWeight}
                sizeByOption={sizeByOption}
                setSizeByOption={setSizeByOption}
                showSummerCapacity={showSummerCapacity}
                setShowSummerCapacity={setShowSummerCapacity}
              />
        );

      case 'data': {
        const cacheStats = getCableCacheStats();
        return (
          <div className="tab-content-placeholder">
            <h3>Data & Export</h3>
            <DataVisualizations />
            <div className="placeholder-content">
              <h4>Cache Management</h4>
              <div className="cache-info">
                <p>Cache Entries: {cacheStats.entries}</p>
                <p>Cache Size: {(cacheStats.totalSize / 1024).toFixed(1)} KB</p>
                <p>Storage Usage: {cacheStats.usagePercent.toFixed(1)}%</p>
                <button
                  onClick={() => {
                    clearCableCache();
                    window.location.reload(); // Reload to fetch fresh data
                  }}
                  className="clear-cache-btn"
                >
                  Clear Cable Cache
                </button>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (isCollapsed) {
    return (
      <div className="side-panel collapsed">
        <button
          className="collapse-toggle"
          onClick={onToggleCollapsed}
          aria-label="Expand side panel"
          title="Expand side panel"
        >
          ▶
        </button>
      </div>
    );
  }

  return (
    <div className="side-panel">
      {/* Header with collapse button */}
      <div className="panel-header">
        <h2 className="panel-title">Map Controls</h2>
        {onToggleCollapsed && (
          <button
            className="collapse-toggle"
            onClick={onToggleCollapsed}
            aria-label="Collapse side panel"
            title="Collapse side panel"
          >
            ◀
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <TabNavigation
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
        tabs={tabs}
      />

      {/* Tab Content */}
      <div className="tab-content" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {renderTabContent()}
      </div>


    </div>
  );
};

export default SidePanel;