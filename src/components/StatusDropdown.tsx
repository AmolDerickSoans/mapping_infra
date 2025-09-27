import React from 'react';

interface StatusDropdownProps {
  allStatuses: string[];
  filteredStatuses: Set<string>;
  onToggleStatus: (status: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  isOpen: boolean;
}

// Map long status names to short codes
const getShortStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'Operating': 'OP',
    'Planned': 'PL',
    'Retired': 'RT',
    'Under Construction': 'UC',
    'Cancelled': 'CN',
    'Suspended': 'SP',
    'Standby': 'SB',
    'Out of Service': 'OOS',
    'Mothballed': 'MB',
    'Decommissioned': 'DC',
    'N/A': 'N/A'
  };

  return statusMap[status] || status.substring(0, 4).toUpperCase(); // Fallback to first 4 chars uppercase
};

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
            <span className="item-text" title={status}>{getShortStatus(status)}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default StatusDropdown;