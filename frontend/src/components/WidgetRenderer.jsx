import { useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Pie, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, ChartDataLabels);

const COLOR_SCHEMES = {
  default: ['#00457e', '#0066b2', '#3399cc', '#66c2e0', '#99d6eb', '#cceaf5'],
  warm: ['#dc2626', '#ea580c', '#f59e0b', '#eab308', '#84cc16', '#22c55e'],
  cool: ['#7c3aed', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6'],
  earth: ['#78350f', '#92400e', '#a16207', '#4d7c0f', '#166534', '#0f766e'],
  pastel: ['#fca5a5', '#fdba74', '#fde047', '#86efac', '#7dd3fc', '#c4b5fd'],
};


function DropdownWidget({ widget, data, colors, total, selected, onSelectionChange }) {
  const toggleOption = (name) => {
    if (selected.includes(name)) {
      onSelectionChange(selected.filter(s => s !== name));
    } else {
      onSelectionChange([...selected, name]);
    }
  };

  const selectedTotal = data
    .filter(d => selected.includes(d.name))
    .reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="widget-card">
      <h3 className="widget-title">{widget.title}</h3>
      <div className="dropdown-widget">
        <div className="dropdown-options">
          {data.map((item, idx) => {
            const isSelected = selected.includes(item.name);
            return (
              <button
                key={item.name}
                className={`dropdown-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleOption(item.name)}
                style={{
                  '--chip-color': colors[idx % colors.length],
                  borderColor: isSelected ? colors[idx % colors.length] : undefined,
                  backgroundColor: isSelected ? `${colors[idx % colors.length]}15` : undefined,
                }}
              >
                <span className="chip-dot" style={{ backgroundColor: colors[idx % colors.length] }} />
                <span className="chip-label">{item.name}</span>
                <span className="chip-count">{item.value}</span>
              </button>
            );
          })}
        </div>
        <div className="dropdown-summary">
          {selected.length === 0 ? (
            <span className="summary-hint">Select items to filter charts</span>
          ) : (
            <>
              <span className="summary-count">{selectedTotal}</span>
              <span className="summary-label">
                of {total} ({((selectedTotal / total) * 100).toFixed(0)}%)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function aggregateData(apps, dataField, doiStages = []) {
  const counts = {};

  const getDoiLabel = (stage) => {
    const doi = doiStages.find(d => d.id === stage);
    return doi ? doi.label : `DOI ${stage}`;
  };

  apps.forEach(app => {
    let value = app[dataField];

    if (dataField === 'doi_stage') {
      value = getDoiLabel(value);
    }

    if (value === null || value === undefined || value === '') {
      value = 'Unspecified';
    }

    counts[value] = (counts[value] || 0) + 1;
  });

  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function getAppFieldValue(app, dataField, doiStages = []) {
  let value = app[dataField];
  if (dataField === 'doi_stage') {
    const doi = doiStages.find(d => d.id === value);
    value = doi ? doi.label : `DOI ${value}`;
  }
  if (value === null || value === undefined || value === '') {
    value = 'Unspecified';
  }
  return value;
}

function WidgetRenderer({ widget, apps, widgetFilters = {}, setWidgetFilters, doiStages = [] }) {
  const colors = COLOR_SCHEMES[widget.color_scheme] || COLOR_SCHEMES.default;

  const filteredApps = useMemo(() => {
    let result = apps;
    Object.entries(widgetFilters).forEach(([field, selectedValues]) => {
      if (selectedValues && selectedValues.length > 0) {
        result = result.filter(app => {
          const appValue = getAppFieldValue(app, field, doiStages);
          return selectedValues.includes(appValue);
        });
      }
    });
    return result;
  }, [apps, widgetFilters, doiStages]);

  const allData = useMemo(() => {
    return aggregateData(apps, widget.data_field, doiStages);
  }, [apps, widget.data_field, doiStages]);

  const data = useMemo(() => {
    return aggregateData(filteredApps, widget.data_field, doiStages);
  }, [filteredApps, widget.data_field, doiStages]);

  const total = filteredApps.length;
  const allTotal = apps.length;

  if (allTotal === 0) {
    return (
      <div className="widget-card">
        <h3 className="widget-title">{widget.title}</h3>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No data available</p>
      </div>
    );
  }

  const chartData = {
    labels: data.map(d => d.name),
    datasets: [{
      data: data.map(d => d.value),
      backgroundColor: colors.slice(0, data.length),
      borderWidth: 0,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 16,
          usePointStyle: true,
          font: { size: 12 },
          generateLabels: (chart) => {
            const data = chart.data;
            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
            return data.labels.map((label, i) => {
              const value = data.datasets[0].data[i];
              const percent = ((value / total) * 100).toFixed(0);
              return {
                text: `${label} (${percent}%)`,
                fillStyle: data.datasets[0].backgroundColor[i],
                hidden: false,
                index: i
              };
            });
          }
        }
      },
      datalabels: {
        color: '#fff',
        font: { weight: 'bold', size: 12 },
        formatter: (value, context) => {
          const total = context.dataset.data.reduce((a, b) => a + b, 0);
          const percent = ((value / total) * 100).toFixed(0);
          return percent > 5 ? `${percent}%` : '';
        }
      }
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: 'end',
        align: 'end',
        color: '#64748b',
        font: { weight: 'bold', size: 11 },
        formatter: (value) => value
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { display: false } }
    }
  };

  if (widget.chart_type === 'stat') {
    return (
      <div className="widget-card">
        <h3 className="widget-title">{widget.title}</h3>
        <div className="widget-stats-grid">
          {data.slice(0, 4).map((item, idx) => (
            <div key={idx} className="widget-stat-card" style={{ borderLeftColor: colors[idx % colors.length] }}>
              <div className="stat-value" style={{ color: colors[idx % colors.length] }}>{item.value}</div>
              <div className="stat-title">{item.name}</div>
              <div className="stat-subtitle">{((item.value / total) * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (widget.chart_type === 'progress') {
    return (
      <div className="widget-card">
        <h3 className="widget-title">{widget.title}</h3>
        <div className="widget-progress-list">
          {data.map((item, idx) => {
            const percent = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div key={idx} className="progress-item">
                <div className="progress-header">
                  <span className="progress-label">{item.name}</span>
                  <span className="progress-value">{item.value} ({percent.toFixed(0)}%)</span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: colors[idx % colors.length]
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (widget.chart_type === 'dropdown') {
    const currentSelection = widgetFilters[widget.data_field] || [];
    const handleSelectionChange = (newSelection) => {
      setWidgetFilters(prev => ({
        ...prev,
        [widget.data_field]: newSelection
      }));
    };
    return (
      <DropdownWidget
        widget={widget}
        data={allData}
        colors={colors}
        total={allTotal}
        selected={currentSelection}
        onSelectionChange={handleSelectionChange}
      />
    );
  }

  return (
    <div className="widget-card">
      <h3 className="widget-title">{widget.title}</h3>
      <div style={{ height: '220px', position: 'relative' }}>
        {total === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '80px' }}>No matching data</p>
        ) : (
          <>
            {widget.chart_type === 'pie' && <Pie data={chartData} options={chartOptions} />}
            {widget.chart_type === 'donut' && <Doughnut data={chartData} options={chartOptions} />}
            {widget.chart_type === 'bar' && <Bar data={chartData} options={barOptions} />}
          </>
        )}
      </div>
    </div>
  );
}

export default WidgetRenderer;
