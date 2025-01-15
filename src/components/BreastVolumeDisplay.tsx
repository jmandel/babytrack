import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import { NewbornEvent } from '@/types/newbornTracker';
import { calculateCurrentVolume } from '@/lib/breastVolumeCalculator';

interface BreastVolumeDisplayProps {
  events: NewbornEvent[];
}

export function BreastVolumeDisplay({ events }: BreastVolumeDisplayProps) {
  const [volume, setVolume] = useState(0);

  // Update breast volume every minute
  useEffect(() => {
    const updateVolume = () => {
      const newVolume = calculateCurrentVolume(events);
      setVolume(newVolume);
    };

    // Initial update
    updateVolume();

    // Update every minute
    const interval = setInterval(updateVolume, 60000);
    return () => clearInterval(interval);
  }, [events]);

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center',
      gap: 2,
      mr: 2,
      color: 'text.secondary',
      fontSize: '0.875rem'
    }}>
      <span title="Predicted breast milk volume">
        🍼 {volume.toFixed(1)} ml
      </span>
    </Box>
  );
} 