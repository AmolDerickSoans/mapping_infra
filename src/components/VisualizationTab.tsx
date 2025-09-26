import React from 'react';

interface VisualizationTabProps {
  sizeMultiplier: number;
  setSizeMultiplier: (value: number) => void;
  capacityWeight: number;
  setCapacityWeight: (value: number) => void;
  sizeByOption: 'nameplate_capacity' | 'capacity_factor' | 'generation';
  setSizeByOption: (value: 'nameplate_capacity' | 'capacity_factor' | 'generation') => void;
  showSummerCapacity: boolean;
  setShowSummerCapacity: (value: boolean) => void;
}

// Data availability status
const DATA_AVAILABILITY = {
  nameplate_capacity: true,
  capacity_factor: false, // Not populated in current data
  generation: false, // Not populated in current data
};

const VisualizationTab: React.FC<VisualizationTabProps> = ({
  sizeMultiplier,
  setSizeMultiplier,
  capacityWeight,
  setCapacityWeight,
  sizeByOption,
  setSizeByOption,
  showSummerCapacity,
  setShowSummerCapacity,
}) => {
  return (
    <div className="visualization-tab">
      {/* Base Size Control */}
      <div className="control-group">
        <label htmlFor="sizeMultiplier" className="control-label">
          Base Size: {sizeMultiplier.toFixed(2)}
        </label>
        <input
          id="sizeMultiplier"
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={sizeMultiplier}
          onChange={(e) => setSizeMultiplier(Number(e.target.value))}
          className="slider"
        />
        <div className="slider-labels">
          <span>1</span>
          <span>3</span>
        </div>
      </div>

      {/* Data Emphasis Control */}
      <div className="control-group">
        <label htmlFor="capacityWeight" className="control-label">
          Data Emphasis: {capacityWeight.toFixed(1)}
        </label>
        <input
          id="capacityWeight"
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={capacityWeight}
          onChange={(e) => setCapacityWeight(Number(e.target.value))}
          className="slider"
        />
        <div className="slider-labels">
          <span>0</span>
          <span>3</span>
        </div>
        <p className="control-description">
          Raises plant's capacity effect on size (0 = uniform, 1 = normal, 3 = emphasized)
        </p>
      </div>

      {/* Size Circles By */}
      <div className="control-group">
        <label htmlFor="sizeByOption" className="control-label">
          Size Circles By
        </label>
        <select
          id="sizeByOption"
          value={sizeByOption}
          onChange={(e) => setSizeByOption(e.target.value as typeof sizeByOption)}
          className="select-control"
        >
          <option value="nameplate_capacity">Nameplate Capacity</option>
          <option value="capacity_factor" disabled={!DATA_AVAILABILITY.capacity_factor}>
            Capacity Factor {DATA_AVAILABILITY.capacity_factor ? '' : '(data unavailable)'}
          </option>
          <option value="generation" disabled={!DATA_AVAILABILITY.generation}>
            Generation {DATA_AVAILABILITY.generation ? '' : '(data unavailable)'}
          </option>
        </select>
        {sizeByOption !== 'nameplate_capacity' && !DATA_AVAILABILITY[sizeByOption] && (
          <p className="control-description warning">
            Selected metric data is not available. Circles sized by nameplate capacity.
          </p>
        )}
      </div>

      {/* Show Summer Capacity Toggle */}
      <div className="control-group">
        <label className="toggle-item">
          <input
            type="checkbox"
            checked={showSummerCapacity}
            onChange={(e) => setShowSummerCapacity(e.target.checked)}
            className="toggle-input"
          />
          <span className="toggle-slider"></span>
          <span className="toggle-label">Show Summer Capacity</span>
        </label>
      </div>
    </div>
  );
};

export default VisualizationTab;