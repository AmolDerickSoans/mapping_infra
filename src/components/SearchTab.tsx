import React, { useState, useEffect, useMemo } from 'react';
import type { PowerPlant } from '../models/PowerPlant';
import { levenshtein, normalizeString } from '../utils/stringUtils';
import './SearchTab.css';

interface SearchTabProps {
  powerPlants: PowerPlant[];
  selectedPlantIds: Set<string>;
  onPlantSelect: (plantId: string) => void;
  onPlantDeselect: (plantId: string) => void;
  onClearSelection: () => void;
  onApplySelection: () => void;
}

interface SearchResult {
  plant: PowerPlant;
  distance: number;
}

const SearchTab: React.FC<SearchTabProps> = ({
  powerPlants,
  selectedPlantIds,
  onPlantSelect,
  onPlantDeselect,
  onClearSelection,
  onApplySelection
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set(selectedPlantIds));

  // Update pending selections when selectedPlantIds changes
  useEffect(() => {
    setPendingSelections(new Set(selectedPlantIds));
  }, [selectedPlantIds]);

  // Fuzzy search results
  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];

    const normalizedQuery = normalizeString(searchQuery);

    const results: SearchResult[] = powerPlants
      .map(plant => ({
        plant,
        distance: levenshtein(normalizedQuery, normalizeString(plant.name))
      }))
      .filter(result => result.distance <= 3) // Allow up to 3 edits
      .sort((a, b) => a.distance - b.distance || a.plant.name.localeCompare(b.plant.name))
      .slice(0, 10); // Top 10 results

    return results;
  }, [searchQuery, powerPlants]);

  const handlePendingToggle = (plantId: string) => {
    const newPending = new Set(pendingSelections);
    if (newPending.has(plantId)) {
      newPending.delete(plantId);
    } else {
      newPending.add(plantId);
    }
    setPendingSelections(newPending);
  };

  const handleApplySelection = () => {
    // Clear current selections and add pending ones
    selectedPlantIds.forEach(id => onPlantDeselect(id));
    pendingSelections.forEach(id => onPlantSelect(id));
    onApplySelection();
  };

  const selectedPlants = useMemo(() => {
    return powerPlants.filter(plant => selectedPlantIds.has(plant.id));
  }, [powerPlants, selectedPlantIds]);

  return (
    <div className="search-tab">
      <div className="search-input-group">
        <input
          type="text"
          placeholder="Search power plant names..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {searchResults.length > 0 && (
        <div className="search-results">
          <h4>Search Results ({searchResults.length})</h4>
          <div className="results-list">
            {searchResults.map(({ plant, distance }) => (
              <label key={plant.id} className="result-item">
                <input
                  type="checkbox"
                  checked={pendingSelections.has(plant.id)}
                  onChange={() => handlePendingToggle(plant.id)}
                />
                <span className="plant-name">{plant.name}</span>
                <span className="distance">(~{distance} edits)</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="search-controls">
        <button
          onClick={handleApplySelection}
          disabled={pendingSelections.size === 0}
          className="apply-button"
        >
          Show Selected ({pendingSelections.size})
        </button>
        <button
          onClick={onClearSelection}
          className="clear-button"
        >
          Clear All
        </button>
      </div>

      {selectedPlants.length > 0 && (
        <div className="selected-plants">
          <h4>Currently Showing ({selectedPlants.length})</h4>
          <div className="selected-list">
            {selectedPlants.map(plant => (
              <div key={plant.id} className="selected-item">
                <span>{plant.name}</span>
                <button
                  onClick={() => onPlantDeselect(plant.id)}
                  className="remove-button"
                  aria-label={`Remove ${plant.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchTab;