import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function LocationSelect({ value, onChange, className = '' }) {
  const { user, isAdmin } = useAuth();
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (isAdmin) {
      api.get('/locations').then((r) => setLocations(r.data)).catch(() => {});
    }
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`input ${className}`}
    >
      <option value="">All Locations</option>
      {locations.map((l) => (
        <option key={l.id} value={l.id}>{l.name}</option>
      ))}
    </select>
  );
}
