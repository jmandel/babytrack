import { useState, useCallback, useRef, useEffect } from "react";
import { WakeWordListener } from "@/lib/WakeWordListener";
import { StructuredVoiceLogger } from "@/lib/StructuredVoiceLogger";
import { schema } from "@/generated/schema";
import { NewbornEvent } from '@/types/newbornTracker';

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
}

interface VoiceRecognitionConfig {
  apiKey: string;
  wakeWord: string;
  sleepWord: string;
  events: NewbornEvent[];
  onNewEvent: (event: NewbornEvent) => void;
}

export function useVoiceRecognition({
  apiKey,
  wakeWord,
  sleepWord,
  events,
  onNewEvent,
}: VoiceRecognitionConfig): VoiceRecognitionState {
  // Voice control state
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState({ isAwake: false, awakeningId: 0 });
  const [error, setError] = useState('');
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [utterances, setUtterances] = useState<Array<{ text: string; timestamp: string }>>(() => {
    const stored = localStorage.getItem('utteranceHistory');
    return stored ? JSON.parse(stored) : [];
  });

  // Refs for latest state
  const eventsRef = useRef<NewbornEvent[]>(events);
  const utterancesRef = useRef(utterances);

  // Keep refs up to date
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    utterancesRef.current = utterances;
  }, [utterances]);

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

  // Function to clear utterances
  const clearUtterances = useCallback(() => {
    console.log('Clearing utterances');
    setUtterances([]);
    localStorage.removeItem('utteranceHistory');
  }, []);

  // Refs for voice recognition
  const listenerRef = useRef<WakeWordListener | null>(null);
  const loggerRef = useRef<StructuredVoiceLogger | null>(null);

  // Initialize WakeWordListener once and only once
  useEffect(() => {
    if (!apiKey || listenerRef.current) return;

    console.log('Creating WakeWordListener instance');
    const listener = new WakeWordListener({
      wakeWord,
      sleepWord,
      onStateChange: (state) => {
        console.log('Voice state changed:', state);
        setVoiceStatus(state);
        // If we're awake (actively listening for commands), ensure recognition stays active
        if (state.isAwake && listenerRef.current) {
          console.log('Ensuring continuous listening');
          listenerRef.current.start();
        }
      },
      onError: (error) => {
        console.error('Voice recognition error:', error);
        setError(error.message);
        if (error.message.includes('Permission denied') || error.message.includes('not allowed')) {
          setMicPermissionDenied(true);
          setIsListening(false);
        } else {
          // For other errors, try to restart listening if we're supposed to be active
          if (isListening && listenerRef.current) {
            console.log('Restarting after error');
            listenerRef.current.start();
          }
        }
      },
      onUtterance: (utterance) => {
        console.log('New utterance:', utterance);
        const timestamp = new Date().toISOString();
        setUtterances(prev => [{
          text: utterance.text,
          timestamp
        }, ...prev.slice(0, 9)]);
        // Restart listening after processing the utterance
        if (listenerRef.current) {
          console.log('Restarting after utterance');
          listenerRef.current.start();
        }
      },
      onDebug: (event) => {
        console.log('Speech event:', event);
        // Restart listening after end events if we're supposed to be active
        if (event.event?.includes('end') && isListening && listenerRef.current) {
          console.log('Restarting after end event');
          listenerRef.current.start();
        }
      }
    });
    listenerRef.current = listener;

    // Request microphone permissions if not already granted
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      console.log('Requesting microphone permission...');
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          console.log('Microphone permission granted');
          setMicPermissionDenied(false);
          setError('');
          setIsListening(true);
        })
        .catch((err) => {
          console.error('Failed to get microphone permission:', err);
          setMicPermissionDenied(true);
          setError('Microphone permission denied. Please allow access to use voice features.');
          setIsListening(false);
        });
    } else {
      console.error('Voice recognition not supported');
      setError('Voice recognition is not supported in this browser.');
    }

    return () => {
      console.log('Cleaning up WakeWordListener');
      if (listenerRef.current) {
        listenerRef.current.stop();
        listenerRef.current = null;
      }
    };
  }, [apiKey]); // Only depend on apiKey for initial creation

  // Initialize/update StructuredVoiceLogger when config changes
  useEffect(() => {
    if (!apiKey || !listenerRef.current) return;

    console.log('Initializing/updating StructuredVoiceLogger');
    
    // Always create a new logger with fresh events
    if (loggerRef.current) {
      console.log('Cleaning up previous logger');
      loggerRef.current.stop();
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

        // If this is an update to an existing event
        if (data.id) {
          const existingEvent = events.find(e => e.id === data.id);
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

        // If this is a new event
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

    return () => {
      if (loggerRef.current) {
        console.log('Cleaning up StructuredVoiceLogger');
        loggerRef.current.stop();
      }
    };
  }, [apiKey, wakeWord, sleepWord]); // Remove events and utterances from deps

  // Update wake/sleep words when they change
  useEffect(() => {
    if (listenerRef.current) {
      console.log('Updating wake/sleep words:', { wakeWord, sleepWord });
      listenerRef.current.updateWakeWord(wakeWord);
      listenerRef.current.updateSleepWord(sleepWord);
    }
  }, [wakeWord, sleepWord]);

  // Persist utterances to localStorage
  useEffect(() => {
    localStorage.setItem('utteranceHistory', JSON.stringify(utterances));
  }, [utterances]);

  // Handle listening state changes
  useEffect(() => {
    const listener = listenerRef.current;
    if (!listener) return;

    if (isListening) {
      console.log('Starting voice recognition');
      listener.start();
    } else {
      console.log('Stopping voice recognition');
      listener.stop();
    }
  }, [isListening]);

  return {
    isListening,
    voiceStatus,
    error,
    micPermissionDenied,
    utterances,
    clearUtterances,
    debugSetWakeState: useCallback((isAwake: boolean) => {
      listenerRef.current?.debugSetWakeState(isAwake);
    }, []),
    debugSimulateUtterance: useCallback((text: string) => {
      listenerRef.current?.debugSimulateUtterance(text);
    }, []),
    listenerRef,
  };
} 