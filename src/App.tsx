import React from 'react';
import { BabyLoggerProvider } from '@/store/BabyLoggerContext';
import { VoiceLoggerApp } from '@/components/VoiceLoggerApp';
import { CssBaseline } from '@mui/material';

export function App() {
  return (
    <BabyLoggerProvider>
      <CssBaseline />
      <VoiceLoggerApp />
    </BabyLoggerProvider>
  );
} 