import React from 'react';
import { SEVERITY_COLORS, REPORT_STATUS_COLORS, INCIDENT_STATUS_COLORS } from '../../utils/helpers';

export function SeverityBadge({ severity }) {
  return <span className={SEVERITY_COLORS[severity] || 'badge-low'}>{severity}</span>;
}

export function ReportStatusBadge({ status }) {
  const display = status?.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${REPORT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>
      {display}
    </span>
  );
}

export function IncidentStatusBadge({ status }) {
  const display = status?.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${INCIDENT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>
      {display}
    </span>
  );
}

export function RiskBadge({ rating }) {
  const colors = {
    Low:      'bg-green-100 text-green-800',
    Medium:   'bg-yellow-100 text-yellow-800',
    High:     'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[rating] || 'bg-gray-100 text-gray-700'}`}>
      {rating}
    </span>
  );
}
