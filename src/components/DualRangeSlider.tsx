 import React, { useCallback, useEffect, useRef, useState } from 'react';
import './DualRangeSlider.css';

interface DualRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  step?: number;
  className?: string;
  disabled?: boolean;
}

const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  min,
  max,
  value,
  onChange,
  step = 1,
  className = '',
  disabled = false,
}) => {
  const [localValue, setLocalValue] = useState<[number, number]>(value);
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);

  // Sync local state with props when value changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const [minValue, maxValue] = localValue;

  // Improved constraint logic that properly handles min/max separation
  const constrainValues = useCallback((newMin: number, newMax: number): [number, number] => {
    // Ensure values are within bounds first
    const boundedMin = Math.max(min, Math.min(newMin, max - step));
    const boundedMax = Math.min(max, Math.max(newMax, min + step));

    // If min would exceed max, adjust max to maintain separation
    const constrainedMin = Math.min(boundedMin, boundedMax - step);
    const constrainedMax = Math.max(boundedMax, constrainedMin + step);

    return [constrainedMin, constrainedMax];
  }, [min, max, step]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = Number(e.target.value);
    const [constrainedMin, constrainedMax] = constrainValues(newMin, maxValue);
    setLocalValue([constrainedMin, constrainedMax]);
    isDraggingRef.current = true;
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = Number(e.target.value);
    const [constrainedMin, constrainedMax] = constrainValues(minValue, newMax);
    setLocalValue([constrainedMin, constrainedMax]);
    isDraggingRef.current = true;
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      onChange(localValue);
      isDraggingRef.current = false;
    }
  };

  // Calculate percentage positions for the track highlight
  const minPercent = ((minValue - min) / (max - min)) * 100;
  const maxPercent = ((maxValue - min) / (max - min)) * 100;

  return (
    <div className={`dual-range-slider ${className} ${disabled ? 'disabled' : ''}`}>
      <div className="slider-container">
        {/* Min input */}
        <input
          ref={minInputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={minValue}
          onChange={handleMinChange}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleMouseUp}
          className="slider-input slider-min"
          disabled={disabled}
          aria-label="Minimum value"
        />

        {/* Max input */}
        <input
          ref={maxInputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxValue}
          onChange={handleMaxChange}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleMouseUp}
          className="slider-input slider-max"
          disabled={disabled}
          aria-label="Maximum value"
        />

        {/* Track highlight */}
        <div className="slider-track">
          <div
            className="slider-track-highlight"
            style={{
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`,
            }}
          />
        </div>
      </div>

      {/* Value display */}
      <div className="slider-values">
        <span className="slider-value">
          {minValue.toLocaleString()}
        </span>
        <span className="slider-separator">–</span>
        <span className="slider-value">
          {maxValue.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default DualRangeSlider;