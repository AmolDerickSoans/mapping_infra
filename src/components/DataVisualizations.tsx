
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { csvParse } from 'd3-dsv';
import './DataVisualizations.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919'];

const DataVisualizations: React.FC = () => {
  const [powerPlantsData, setPowerPlantsData] = useState<any[]>([]);
  const [capacityData, setCapacityData] = useState<any[]>([]);
  const [renewableVsNonRenewableData, setRenewableVsNonRenewableData] = useState<any[]>([]);

  useEffect(() => {
    // Load power plant count data
    fetch('/data/power_plants.csv')
      .then(response => response.text())
      .then(text => {
        const data = csvParse(text);
        const counts = data.reduce((acc, plant) => {
          const source = plant.source || 'Unknown';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const chartData = Object.keys(counts).map(key => ({ source: key, count: counts[key] }));
        setPowerPlantsData(chartData);
      });

    // Load capacity data
    fetch('/data/Power_Plants,_100_MW_or_more.csv')
      .then(response => response.text())
      .then(text => {
        const data = csvParse(text);
        const capacityBySource = data.reduce((acc, plant) => {
          const source = plant['Primary Energy Source'] || 'Unknown';
          const capacity = parseFloat(plant['Total Capacity (MW)'] || '0');
          acc[source] = (acc[source] || 0) + capacity;
          return acc;
        }, {} as Record<string, number>);
        const chartData = Object.keys(capacityBySource).map(key => ({ source: key, capacity: capacityBySource[key] }));
        setCapacityData(chartData);
      });

    // Load renewable vs non-renewable data
    Promise.all([
      fetch('/data/Renewable_Energy_Power_Plants,_1_MW_or_more.csv').then(res => res.text()),
      fetch('/data/Power_Plants,_100_MW_or_more.csv').then(res => res.text())
    ]).then(([renewableText, allText]) => {
      const renewableData = csvParse(renewableText);
      const allData = csvParse(allText);

      const renewableCapacity = renewableData.reduce((acc, plant) => {
        return acc + parseFloat(plant['Total Capacity (MW)'] || '0');
      }, 0);

      const totalCapacity = allData.reduce((acc, plant) => {
        return acc + parseFloat(plant['Total Capacity (MW)'] || '0');
      }, 0);

      const nonRenewableCapacity = totalCapacity - renewableCapacity;

      setRenewableVsNonRenewableData([
        { name: 'Renewable', value: renewableCapacity },
        { name: 'Non-Renewable', value: nonRenewableCapacity },
      ]);
    });
  }, []);

  return (
    <div className="data-visualizations">
      <h4>Power Plant Types</h4>
      <BarChart width={300} height={200} data={powerPlantsData}>
        <XAxis dataKey="source" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="count" fill="#8884d8" />
      </BarChart>

      <h4>Total Capacity by Source</h4>
      <PieChart width={300} height={200}>
        <Pie
          data={capacityData}
          cx={150}
          cy={100}
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="capacity"
        >
          {capacityData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>

      <h4>Renewable vs. Non-Renewable Capacity</h4>
      <BarChart width={300} height={200} data={renewableVsNonRenewableData}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="value" fill="#82ca9d" />
      </BarChart>
    </div>
  );
};

export default DataVisualizations;
