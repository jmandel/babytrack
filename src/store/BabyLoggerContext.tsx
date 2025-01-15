import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { NewbornEvent } from '@/types/newbornTracker';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { Snackbar } from '@mui/material';

interface SavedVisualization {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}

interface BabyLoggerState {
  events: NewbornEvent[];
  wakeWord: string;
  sleepWord: string;
  apiKey: string;
  isListening: boolean;
  voiceStatus: {
    isAwake: boolean;
    awakeningId: number;
  };
  error: string;
  micPermissionDenied: boolean;
  utterances: Array<{ text: string; timestamp: string }>;
  savedVisualizations: SavedVisualization[];
  addEvent: (event: NewbornEvent) => void;
  deleteEvent: (eventId: string) => void;
  clearEvents: () => void;
  clearUtterances: () => void;
  setWakeWord: (word: string) => void;
  setSleepWord: (word: string) => void;
  setApiKey: (key: string) => void;
  setIsListening: (isListening: boolean) => void;
  saveVisualization: (name: string, code: string) => void;
  deleteVisualization: (id: string) => void;
  // Debug methods
  debugSetWakeState: (isAwake: boolean) => void;
  debugSimulateUtterance: (text: string) => void;
  toastOpen: boolean;
  setToastOpen: (open: boolean) => void;
  currentUtterance: string;
}

const BabyLoggerContext = createContext<BabyLoggerState | null>(null);

export function BabyLoggerProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<NewbornEvent[]>(() => {
    const stored = localStorage.getItem('eventStore');
    return stored ? JSON.parse(stored) : [];
  });

  const [savedVisualizations, setSavedVisualizations] = useState<SavedVisualization[]>(() => {
    const stored = localStorage.getItem('visualizationLibrary');
    return stored ? JSON.parse(stored) : [];
  });

  const [wakeWord, setWakeWord] = useState(() => 
    localStorage.getItem('wakeWord') || 'start listening'
  );

  const [sleepWord, setSleepWord] = useState(() => 
    localStorage.getItem('sleepWord') || 'stop listening'
  );

  const [apiKey, setApiKey] = useState(() => 
    localStorage.getItem('openaiApiKey') || ''
  );

  const [manualListening, setManualListening] = useState(false);

  const addEvent = useCallback((event: NewbornEvent) => {
    console.log('Adding/updating event:', event.id);
    setEvents(prev => {
      let newEvents;
      
      // If event has an ID and already exists, update it
      if (event.id && prev.some(e => e.id === event.id)) {
        console.log('Updating existing event:', event.id);
        newEvents = prev.map(e => e.id === event.id ? { ...event } : e);
      } else {
        // If it's a new event, ensure it has a unique ID
        const newEvent = {
          ...event,
          id: event.id || crypto.randomUUID()
        };
        console.log('Adding new event:', newEvent.id);
        newEvents = [...prev, newEvent];
      }
      
      // Sort events by occurredAt timestamp, most recent first
      return newEvents.sort((a, b) => 
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );
    });
  }, []);

  const deleteEvent = (eventId: string) => {
    setEvents(prev => prev.filter(event => event.id !== eventId));
  };

  const clearEvents = () => {
    setEvents([]);
  };

  const saveVisualization = useCallback((name: string, code: string) => {
    setSavedVisualizations(prev => {
      const newViz: SavedVisualization = {
        id: crypto.randomUUID(),
        name,
        code,
        createdAt: new Date().toISOString()
      };
      return [...prev, newViz];
    });
  }, []);

  const deleteVisualization = useCallback((id: string) => {
    setSavedVisualizations(prev => prev.filter(viz => viz.id !== id));
  }, []);

  useEffect(() => {
    localStorage.setItem('eventStore', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('wakeWord', wakeWord);
  }, [wakeWord]);

  useEffect(() => {
    localStorage.setItem('sleepWord', sleepWord);
  }, [sleepWord]);

  useEffect(() => {
    localStorage.setItem('openaiApiKey', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('visualizationLibrary', JSON.stringify(savedVisualizations));
  }, [savedVisualizations]);

  const {
    isListening,
    voiceStatus,
    error,
    micPermissionDenied,
    utterances,
    clearUtterances,
    listenerRef,
    toastOpen,
    setToastOpen,
    currentUtterance,
  } = useVoiceRecognition({
    apiKey,
    wakeWord,
    sleepWord,
    events,
    onNewEvent: addEvent,
    isListening: manualListening,
    setIsListening: setManualListening,
  });

  const value: BabyLoggerState = {
    events,
    wakeWord,
    sleepWord,
    apiKey,
    isListening: manualListening,
    voiceStatus,
    error,
    micPermissionDenied,
    utterances,
    savedVisualizations,
    addEvent,
    deleteEvent,
    clearEvents,
    clearUtterances,
    setWakeWord,
    setSleepWord,
    setApiKey,
    setIsListening: setManualListening,
    saveVisualization,
    deleteVisualization,
    debugSetWakeState: useCallback((isAwake: boolean) => {
      listenerRef.current?.debugSetWakeState(isAwake);
    }, [listenerRef]),
    debugSimulateUtterance: useCallback((text: string) => {
      listenerRef.current?.debugSimulateUtterance(text);
    }, [listenerRef]),
    toastOpen,
    setToastOpen,
    currentUtterance,
  };

  return (
    <BabyLoggerContext.Provider value={value}>
      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={() => setToastOpen(false)}
        message={currentUtterance}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            bgcolor: 'primary.main',
            minWidth: '300px'
          }
        }}
      />
      {children}
    </BabyLoggerContext.Provider>
  );
}

export function useBabyLogger() {
  const context = useContext(BabyLoggerContext);
  if (!context) {
    throw new Error('useBabyLogger must be used within a BabyLoggerProvider');
  }
  return context;
} 