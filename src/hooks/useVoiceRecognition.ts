import { useState, useCallback, useRef, useEffect } from "react";
import { WakeWordListener } from "@/lib/WakeWordListener";
import { StructuredVoiceLogger } from "@/lib/StructuredVoiceLogger";
import { schema } from "@/generated/schema";
import { NewbornEvent } from '@/types/newbornTracker';
import { Snackbar } from '@mui/material';
import { MicState, MicContext } from "@/lib/MicStateMachine";

interface VoiceRecognitionState {
  isListening: boolean;
  voiceStatus: {
    isAwake: boolean;
    awakeningId: number;
  };
  error: string;
  micPermissionDenied: boolean;
  utterances: Array<{ text: string; timestamp: string }>;
  clearUtterances: () => void;
  debugSetWakeState: (isAwake: boolean) => void;
  debugSimulateUtterance: (text: string) => void;
  listenerRef: React.RefObject<WakeWordListener | null>;
  toastOpen: boolean;
  setToastOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentUtterance: string;
}

interface VoiceRecognitionConfig {
  apiKey: string;
  wakeWord: string;
  sleepWord: string;
  events: NewbornEvent[];
  onNewEvent: (event: NewbornEvent) => void;
  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
}

export function useVoiceRecognition({
  apiKey,
  wakeWord,
  sleepWord,
  events,
  onNewEvent,
  isListening,
  setIsListening,
}: VoiceRecognitionConfig): VoiceRecognitionState {
  // Voice control state
  const [voiceStatus, setVoiceStatus] = useState({ isAwake: false, awakeningId: 0 });
  const [error, setError] = useState('');
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [utterances, setUtterances] = useState<Array<{ text: string; timestamp: string }>>(() => {
    const stored = localStorage.getItem('utteranceHistory');
    return stored ? JSON.parse(stored) : [];
  });
  const [toastOpen, setToastOpen] = useState(false);
  const [currentUtterance, setCurrentUtterance] = useState('');

  // Refs for latest state
  const eventsRef = useRef<NewbornEvent[]>(events);
  const utterancesRef = useRef(utterances);
  const listenerRef = useRef<WakeWordListener | null>(null);
  const loggerRef = useRef<StructuredVoiceLogger | null>(null);
  const configRef = useRef({ apiKey, wakeWord, sleepWord });

  // Keep refs up to date
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    utterancesRef.current = utterances;
  }, [utterances]);

  useEffect(() => {
    configRef.current = { apiKey, wakeWord, sleepWord };
  }, [apiKey, wakeWord, sleepWord]);

  // Functions that read from refs
  const getRecentEventsFromRef = useCallback((n: number) => {
    console.log('Getting recent events from ref, total events:', eventsRef.current.length);
    return eventsRef.current
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, n);
  }, []);

  const getRecentUtterancesFromRef = useCallback(() => {
    return utterancesRef.current;
  }, []);

  // Initialize WakeWordListener once and only once
  useEffect(() => {
    if (!apiKey) return;

    // Only create the listener if we don't have one
    if (listenerRef.current) {
      console.log('WakeWordListener already exists, updating config');
      listenerRef.current.updateWakeWord(wakeWord);
      listenerRef.current.updateSleepWord(sleepWord);
      return;
    }

    console.log('Creating WakeWordListener instance');
    const listener = new WakeWordListener({
      wakeWord,
      sleepWord,
      onStateChange: (state) => {
        console.log('Voice state changed:', state);
        setVoiceStatus(state);
        if (state.isAwake === false && !state.awakeningId) {
          // Reset error state when returning to initial state
          setError('');
          setMicPermissionDenied(false);
        }
      },
      onError: (error) => {
        console.error('Voice recognition error:', error);
        setError(error.message);
        if (error.message.includes('Permission denied') || error.message.includes('not allowed')) {
          setMicPermissionDenied(true);
          setIsListening(false);
        }
      },
      onUtterance: (utterance) => {
        console.log('New utterance:', utterance);
        const timestamp = new Date().toISOString();
        setUtterances(prev => [{
          text: utterance.text,
          timestamp
        }, ...prev.slice(0, 9)]);
      },
      onDebug: (event) => {
        console.log('Speech event:', event);
      },
      onListeningChange: (isActive) => {
        console.log('Listening state changed:', isActive);
        if (!isActive && isListening) {
          // Only update if we think we're listening but we're actually not
          setIsListening(false);
        }
      }
    });

    listenerRef.current = listener;

    // Clean up on unmount only
    return () => {
      console.log('Cleaning up WakeWordListener');
      if (listenerRef.current) {
        listenerRef.current.setListening(false).catch(console.error);
        listenerRef.current = null;
      }
    };
  }, [apiKey]); // Only recreate when API key changes

  // Initialize/update StructuredVoiceLogger when config changes
  useEffect(() => {
    if (!apiKey || !listenerRef.current) return;

    // Only create a new logger if we don't have one
    if (loggerRef.current) {
      console.log('StructuredVoiceLogger already exists');
      return;
    }

    console.log('Creating new StructuredVoiceLogger');
    const logger = new StructuredVoiceLogger({
      apiKey,
      schema: schema,
      listener: listenerRef.current,
      maxContextEvents: 10,
      onStructuredData: (data) => {
        console.log('=== Received structured data from LLM ===');
        console.log(JSON.stringify(data, null, 2));
        console.log('=======================================');
        
        const now = new Date();
        const enrichedData = {
          ...data,
          id: data.id || crypto.randomUUID(),
          occurredAt: data.occurredAt || now.toISOString(),
          endedAt: data.endedAt ? new Date(data.endedAt).toISOString() : undefined,
        } as NewbornEvent;

        if (data.id) {
          const existingEvent = eventsRef.current.find(e => e.id === data.id);
          if (existingEvent) {
            console.log('=== Updating existing event ===');
            console.log('Original:', JSON.stringify(existingEvent, null, 2));
            console.log('Updated:', JSON.stringify(enrichedData, null, 2));
            console.log('==============================');
            onNewEvent(enrichedData);
            return;
          } else {
            console.warn('Warning: LLM provided ID but event not found:', data.id);
          }
        }

        console.log('=== Creating new event ===');
        console.log(JSON.stringify(enrichedData, null, 2));
        console.log('========================');
        onNewEvent(enrichedData);
      },
      onError: (error) => {
        console.error('LLM/Voice logger error:', error);
        setError(error.message);
      },
      onDebug: (event) => {
        if (event.type === 'non-json-response') {
          setCurrentUtterance(event.message);
          setToastOpen(true);
        }
        else if (event.event === 'utterance-to-llm') {
          setCurrentUtterance(event.utterance);
          setToastOpen(true);
        }
        console.log('=== LLM/Voice logger debug event ===');
        console.log(event);
        console.log('==================================');
      },
      getRecentEvents: getRecentEventsFromRef,
      getRecentUtterances: getRecentUtterancesFromRef,
      addUtterance: (text, timestamp) => {
        console.log('New utterance:', text, 'at', timestamp);
        setUtterances(prev => [{
          text,
          timestamp: timestamp.toISOString()
        }, ...prev.slice(0, 9)]);
      }
    });

    loggerRef.current = logger;

    // Clean up on unmount only
    return () => {
      if (loggerRef.current) {
        console.log('Cleaning up StructuredVoiceLogger');
        loggerRef.current.stop();
        loggerRef.current = null;
      }
    };
  }, [apiKey]); // Only recreate when API key changes

  // Handle listening state changes with debounce
  useEffect(() => {
    const listener = listenerRef.current;
    if (!listener) return;
    const updateListening = () => {
      console.log('Updating listening state:', isListening);
      listener.setListening(isListening).catch(error => {
        console.error('Error updating listening state:', error);
        setError(error instanceof Error ? error.message : String(error));
        if (error.message?.includes('Permission denied') || error.message?.includes('not allowed')) {
          setMicPermissionDenied(true);
          setIsListening(false);
        }
      });
    };
    updateListening();
  }, [isListening]);

  // Persist utterances to localStorage
  useEffect(() => {
    localStorage.setItem('utteranceHistory', JSON.stringify(utterances));
  }, [utterances]);

  return {
    isListening,
    voiceStatus,
    error,
    micPermissionDenied,
    utterances,
    clearUtterances: useCallback(() => {
      console.log('Clearing utterances');
      setUtterances([]);
      localStorage.removeItem('utteranceHistory');
    }, []),
    debugSetWakeState: useCallback((isAwake: boolean) => {
      listenerRef.current?.debugSetWakeState(isAwake);
    }, []),
    debugSimulateUtterance: useCallback((text: string) => {
      listenerRef.current?.debugSimulateUtterance(text);
    }, []),
    listenerRef,
    toastOpen,
    setToastOpen,
    currentUtterance,
  };
} 
