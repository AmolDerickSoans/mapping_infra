import React from 'react';

interface StatusDropdownProps {
  allStatuses: string[];
  filteredStatuses: Set<string>;
  onToggleStatus: (status: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  isOpen: boolean;
}

const StatusDropdown: React.FC<StatusDropdownProps> = ({
  allStatuses,
  filteredStatuses,
  onToggleStatus,
  onSelectAll,
  onClearAll,
  isOpen
}) => {
  if (!isOpen) return null;

  return (
    <div className="status-dropdown">
      <div className="dropdown-header">
        <button
          className="dropdown-action"
          onClick={onSelectAll}
          disabled={filteredStatuses.size === allStatuses.length}
        >
          Select All
        </button>
        <button
          className="dropdown-action"
          onClick={onClearAll}
          disabled={filteredStatuses.size === 0}
        >
          Clear All
        </button>
      </div>
      <div className="dropdown-list">
        {allStatuses.map(status => (
          <label key={status} className="dropdown-item">
            <input
              type="checkbox"
              checked={filteredStatuses.has(status)}
              onChange={() => onToggleStatus(status)}
            />
            <span className="item-text">{status}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default StatusDropdown;