// Type declarations for Web Speech API
declare class SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    lang: string;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
    onstart: () => void;
    onaudiostart: () => void;
    onaudioend: () => void;
    onsoundstart: () => void;
    onsoundend: () => void;
    onspeechstart: () => void;
    onspeechend: () => void;
    start(): void;
    stop(): void;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}

interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

declare global {
    interface Window {
        SpeechRecognition: typeof SpeechRecognition;
        webkitSpeechRecognition: typeof SpeechRecognition;
    }
}

export interface WakeWordListenerConfig {
    wakeWord: string;
    sleepWord: string;
    onStateChange: (state: { isAwake: boolean; awakeningId: number }) => void;
    onError: (error: Error) => void;
    onUtterance?: (utterance: { text: string }) => void;
    onDebug?: (event: any) => void;
    onListeningChange?: (isListening: boolean) => void;
}

import { MicStateMachine, MicState, MicContext } from './MicStateMachine';

export class WakeWordListener {
    private recognition: SpeechRecognition;
    private wakeWord: string;
    private sleepWord: string;
    private onStateChange: (state: { isAwake: boolean; awakeningId: number }) => void;
    private onError: (error: Error) => void;
    private onUtterance?: (utterance: { text: string }) => void;
    private onDebug?: (event: any) => void;
    private onListeningChange?: (isListening: boolean) => void;
    private restartTimeout: number | null = null;
    private stateMachine: MicStateMachine;
    private recognitionActive: boolean = false;
    private mediaStream: MediaStream | null = null;
    private desiredListeningState: boolean = false;

    constructor(config: WakeWordListenerConfig) {
        console.log('Initializing WakeWordListener with config:', config);
        this.wakeWord = config.wakeWord.toLowerCase();
        this.sleepWord = config.sleepWord.toLowerCase();
        this.onStateChange = config.onStateChange;
        this.onError = config.onError;
        this.onUtterance = config.onUtterance;
        this.onDebug = config.onDebug;
        this.onListeningChange = config.onListeningChange;

        // Initialize state machine
        this.stateMachine = new MicStateMachine({
            onStateChange: (state: MicState, context: MicContext) => {
                this.onStateChange({
                    isAwake: state === 'AWAKE',
                    awakeningId: context.awakeningId
                });
            },
            onError: (error: string) => {
                this.onError(new Error(error));
            }
        });

        try {
            // Check for browser support
            if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
                throw new Error('Speech recognition is not supported in this browser');
            }

            console.log('Speech recognition is supported');
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            console.log('Created SpeechRecognition instance');

            // Configure recognition with mobile-optimized settings
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1; // Reduce processing overhead
            this.recognition.lang = 'en-US';
            console.log('Configured recognition settings:', {
                continuous: this.recognition.continuous,
                interimResults: this.recognition.interimResults,
                maxAlternatives: this.recognition.maxAlternatives,
                lang: this.recognition.lang
            });

            // Set up event handlers
            this.recognition.onstart = () => {
                console.log('Recognition started');
                this.onDebug?.({ event: 'start' });
            };

            this.recognition.onresult = this.handleResult.bind(this);
            this.recognition.onerror = this.handleError.bind(this);
            this.recognition.onend = this.handleEnd.bind(this);

            this.recognition.onaudiostart = () => {
                console.log('Audio started');
                this.onDebug?.({ event: 'audiostart' });
            };
            this.recognition.onaudioend = () => {
                console.log('Audio ended');
                this.onDebug?.({ event: 'audioend' });
            };
            this.recognition.onsoundstart = () => {
                console.log('Sound started');
                this.onDebug?.({ event: 'soundstart' });
            };
            this.recognition.onsoundend = () => {
                console.log('Sound ended');
                this.onDebug?.({ event: 'soundend' });
            };
            this.recognition.onspeechstart = () => {
                console.log('Speech started');
                this.onDebug?.({ event: 'speechstart' });
            };
            this.recognition.onspeechend = () => {
                console.log('Speech ended');
                this.onDebug?.({ event: 'speechend' });
            };

            // Add visibility change handling
            document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

        } catch (error) {
            console.error('Error initializing WakeWordListener:', error);
            this.onError(error instanceof Error ? error : new Error('Failed to initialize speech recognition'));
            throw error;
        }
    }

    private handleResult(event: SpeechRecognitionEvent) {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript.toLowerCase().trim();
        const confidence = event.results[current][0].confidence;
        const isFinal = event.results[current].isFinal;

        console.log('Recognition result:', {
            transcript,
            confidence,
            isFinal,
            isAwake: this.stateMachine.isAwake()
        });

        this.onDebug?.({
            event: 'result',
            transcript,
            confidence,
            isFinal,
            isAwake: this.stateMachine.isAwake()
        });

        if (!isFinal) return;

        // Wake word detection - check if wake word is anywhere in the transcript
        if (!this.stateMachine.isAwake() && transcript.includes(this.wakeWord)) {
            console.log('Wake word detected:', this.wakeWord);
            this.stateMachine.wake();
            
            // Split transcript around wake word and process any content after it
            const parts = transcript.split(this.wakeWord);
            const afterWake = parts[parts.length - 1]?.trim();
            if (afterWake && !afterWake.includes(this.sleepWord)) {
                console.log('Processing content after wake word:', afterWake);
                this.onUtterance?.({ text: afterWake });
            }
            return;
        }

        // Sleep word detection - check if sleep word is anywhere in the transcript
        if (this.stateMachine.isAwake() && transcript.includes(this.sleepWord)) {
            console.log('Sleep word detected:', this.sleepWord);
            
            // Split transcript around sleep word and process any content before it
            const parts = transcript.split(this.sleepWord);
            const beforeSleep = parts[0]?.trim();
            if (beforeSleep && !beforeSleep.includes(this.wakeWord)) {
                console.log('Processing content before sleep word:', beforeSleep);
                this.onUtterance?.({ text: beforeSleep });
            }
            
            this.stateMachine.sleep();
            return;
        }

        // Normal utterance when awake
        if (this.stateMachine.isAwake()) {
            console.log('Processing normal utterance:', transcript);
            this.onUtterance?.({ text: transcript });
        } else if (transcript === this.wakeWord) {
            // Handle exact wake word match
            console.log('Exact wake word match detected');
            this.stateMachine.wake();
        } else if (transcript === this.sleepWord) {
            // Handle exact sleep word match
            console.log('Exact sleep word match detected');
            this.stateMachine.sleep();
        }
    }

    private handleError(event: SpeechRecognitionErrorEvent) {
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            this.stateMachine.permissionDenied();
            this.setRecognitionActive(false);
            return;
        }

        this.onError(new Error(`Speech recognition error: ${event.error}`));
        
        // If we get an error while listening and we're not disabled and still want to listen,
        // try to restart
        if (!this.stateMachine.isDisabled() && this.desiredListeningState) {
            console.log('Attempting to restart after error');
            this.restartRecognition();
        }
    }

    private handleEnd() {
        console.log('Recognition ended, state:', this.stateMachine.getState());
        this.setRecognitionActive(false);
        
        // Only restart if we're not disabled and not already restarting
        // and if we still want to be listening
        if (!this.stateMachine.isDisabled() && !this.restartTimeout && this.desiredListeningState) {
            console.log('Recognition ended but should be listening - scheduling restart');
            this.restartRecognition();
        } else {
            console.log('Not restarting recognition - disabled, restart already scheduled, or not desired');
        }
    }

    private restartRecognition() {
        // Use a timeout to prevent rapid restarts
        if (this.restartTimeout !== null) {
            window.clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }

        this.restartTimeout = window.setTimeout(() => {
            // Don't restart if we're disabled or already active
            if (this.stateMachine.isDisabled() || this.recognitionActive) {
                console.log('Not restarting recognition - disabled or already active');
                return;
            }

            console.log('Restarting recognition after end event');
            try {
                this.startRecognition();
            } catch (error) {
                console.error('Error restarting recognition:', error);
                // If we fail to restart, try again after a longer delay
                if (this.restartTimeout !== null) {
                    window.clearTimeout(this.restartTimeout);
                    this.restartTimeout = null;
                }
                this.restartTimeout = window.setTimeout(() => {
                    if (!this.stateMachine.isDisabled() && !this.recognitionActive) {
                        this.restartRecognition();
                    }
                }, 1000);
            }
        }, 100);
    }

    private async requestPermissions(): Promise<MediaStream> {
        console.log('[WakeWordListener] Requesting microphone permissions');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('[WakeWordListener] Media devices not supported');
            throw new Error('Media devices not supported');
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('[WakeWordListener] Microphone permission granted');
            return stream;
        } catch (err) {
            console.error('[WakeWordListener] Failed to get microphone permission:', err);
            this.stateMachine.permissionDenied();
            throw err;
        }
    }

    async start() {
        console.log('[WakeWordListener] Starting WakeWordListener', {
            currentState: {
                recognitionActive: this.recognitionActive,
                micState: this.stateMachine.getState(),
                hasPermission: this.stateMachine.hasPermission(),
                desiredListeningState: this.desiredListeningState,
                hasMediaStream: !!this.mediaStream
            }
        });

        try {
            if (!this.recognition) {
                throw new Error('Speech recognition not initialized');
            }

            // First enable the state machine
            console.log('[WakeWordListener] Enabling state machine');
            this.stateMachine.enable();

            // Always request permissions first
            try {
                console.log('[WakeWordListener] Requesting permissions');
                const stream = await this.requestPermissions();
                this.mediaStream = stream;
                console.log('[WakeWordListener] Permission granted, notifying state machine');
                this.stateMachine.permissionGranted();
                console.log('[WakeWordListener] Starting recognition');
                await this.startRecognition();
            } catch (err) {
                console.error('[WakeWordListener] Permission request failed:', err);
                this.stateMachine.permissionDenied();
                throw err;
            }
        } catch (error) {
            console.error('[WakeWordListener] Error starting speech recognition:', error);
            this.onError(error instanceof Error ? error : new Error('Failed to start speech recognition'));
            throw error;
        }
    }

    private async startRecognition() {
        console.log('[WakeWordListener] Attempting to start recognition', {
            currentState: {
                recognitionActive: this.recognitionActive,
                micState: this.stateMachine.getState(),
                hasPermission: this.stateMachine.hasPermission(),
                desiredListeningState: this.desiredListeningState,
                hasMediaStream: !!this.mediaStream
            }
        });

        if (this.recognitionActive || this.stateMachine.isDisabled() || this.stateMachine.isRequestingPermission()) {
            console.log('[WakeWordListener] Cannot start recognition - invalid state', {
                recognitionActive: this.recognitionActive,
                isDisabled: this.stateMachine.isDisabled(),
                isRequestingPermission: this.stateMachine.isRequestingPermission()
            });
            return;
        }

        if (!this.mediaStream) {
            console.error('[WakeWordListener] No media stream available');
            throw new Error('No media stream available');
        }

        try {
            console.log('[WakeWordListener] Setting recognition active');
            this.setRecognitionActive(true);
            console.log('[WakeWordListener] Starting speech recognition');
            await this.recognition.start();
            console.log('[WakeWordListener] Successfully started speech recognition');
        } catch (error) {
            console.error('[WakeWordListener] Failed to start recognition:', error);
            this.setRecognitionActive(false);
            throw error;
        }
    }

    private async stopRecognition() {
        if (!this.recognitionActive) {
            console.log('Recognition not active, skipping stop');
            return;
        }

        try {
            this.setRecognitionActive(false);
            await this.recognition.stop();
            console.log('Stopped speech recognition');
        } catch (error) {
            console.error('Failed to stop recognition:', error);
            throw error;
        }
    }

    private async cleanupMediaStream() {
        if (this.mediaStream) {
            console.log('Cleaning up media stream');
            this.mediaStream.getTracks().forEach(track => {
                track.stop();
                this.mediaStream?.removeTrack(track);
            });
            this.mediaStream = null;
        }
    }

    async stop() {
        console.log('Stopping WakeWordListener');
        try {
            if (!this.recognition) {
                throw new Error('Speech recognition not initialized');
            }
            
            // First disable the state machine
            this.stateMachine.disable();
            
            // Clear any pending restart
            if (this.restartTimeout !== null) {
                window.clearTimeout(this.restartTimeout);
                this.restartTimeout = null;
            }
            
            // Force the recognition state to inactive before stopping
            this.recognitionActive = false;
            
            try {
                // Stop recognition
                await this.recognition.stop();
            } catch (error) {
                console.error('Error stopping recognition:', error);
                // Continue with cleanup even if stop fails
            }

            // Clean up media stream
            await this.cleanupMediaStream();
            
            console.log('Successfully stopped and cleaned up WakeWordListener');
        } catch (error) {
            console.error('Error in WakeWordListener stop sequence:', error);
            this.onError(error instanceof Error ? error : new Error('Failed to stop speech recognition'));
            
            // Force cleanup even on error
            this.recognitionActive = false;
            await this.cleanupMediaStream();
        }
    }

    get listening(): boolean {
        return !this.stateMachine.isDisabled();
    }

    // Debug methods
    debugSetWakeState(isAwake: boolean) {
        console.log('Debug: Manually setting wake state:', isAwake);
        if (isAwake) {
            this.stateMachine.wake();
        } else {
            this.stateMachine.sleep();
        }
    }

    debugSimulateUtterance(text: string) {
        console.log('Debug: Simulating utterance:', text);
        if (this.onUtterance) {
            this.onUtterance({ text });
        }
    }

    // Update wake/sleep words
    updateWakeWord(word: string) {
        console.log('Updating wake word:', word);
        this.wakeWord = word.toLowerCase();
    }

    updateSleepWord(word: string) {
        console.log('Updating sleep word:', word);
        this.sleepWord = word.toLowerCase();
    }

    private setRecognitionActive(active: boolean) {
        console.log('[WakeWordListener] Setting recognition active:', {
            newValue: active,
            currentValue: this.recognitionActive,
            micState: this.stateMachine.getState()
        });

        if (this.recognitionActive !== active) {
            this.recognitionActive = active;
            this.onListeningChange?.(active);
        }
    }

    async setListening(shouldListen: boolean) {
        console.log('[WakeWordListener] Setting listening state:', {
            shouldListen,
            currentState: {
                recognitionActive: this.recognitionActive,
                micState: this.stateMachine.getState(),
                hasPermission: this.stateMachine.hasPermission(),
                desiredListeningState: this.desiredListeningState,
                hasMediaStream: !!this.mediaStream
            }
        });

        this.desiredListeningState = shouldListen;

        if (shouldListen && !this.recognitionActive) {
            console.log('[WakeWordListener] Starting recognition because shouldListen=true');
            await this.start();
        } else if (!shouldListen && this.recognitionActive) {
            console.log('[WakeWordListener] Stopping recognition because shouldListen=false');
            await this.stop();
        } else {
            console.log('[WakeWordListener] No action needed for setListening', {
                shouldListen,
                recognitionActive: this.recognitionActive
            });
        }
    }

    private handleVisibilityChange() {
        console.log('[WakeWordListener] Visibility changed:', document.visibilityState);
        if (document.visibilityState === 'hidden') {
            // Stop recognition when app goes to background
            if (this.recognitionActive) {
                console.log('[WakeWordListener] App hidden, stopping recognition');
                this.stopRecognition();
            }
        } else if (document.visibilityState === 'visible' && this.desiredListeningState) {
            // Restart if we should be listening
            console.log('[WakeWordListener] App visible, restarting recognition');
            this.startRecognition().catch(error => {
                console.error('[WakeWordListener] Error restarting recognition on visibility change:', error);
                this.onError(error instanceof Error ? error : new Error('Failed to restart recognition'));
            });
        }
    }
} 