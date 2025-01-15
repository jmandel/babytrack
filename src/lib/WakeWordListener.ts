// Type declarations for Web Speech API
declare class SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
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
    private restartTimeout: number | null = null;
    private stateMachine: MicStateMachine;
    private recognitionActive: boolean = false;

    constructor(config: WakeWordListenerConfig) {
        console.log('Initializing WakeWordListener with config:', config);
        this.wakeWord = config.wakeWord.toLowerCase();
        this.sleepWord = config.sleepWord.toLowerCase();
        this.onStateChange = config.onStateChange;
        this.onError = config.onError;
        this.onUtterance = config.onUtterance;
        this.onDebug = config.onDebug;

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

            // Configure recognition
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            console.log('Configured recognition settings:', {
                continuous: this.recognition.continuous,
                interimResults: this.recognition.interimResults,
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
            return;
        }

        this.onError(new Error(`Speech recognition error: ${event.error}`));
        
        // If we get an error while listening and we're not disabled, try to restart
        if (!this.stateMachine.isDisabled()) {
            console.log('Attempting to restart after error');
            this.restartRecognition();
        }
    }

    private handleEnd() {
        console.log('Recognition ended, state:', this.stateMachine.getState());
        this.recognitionActive = false;
        
        // If we should be listening (not disabled), restart recognition
        if (!this.stateMachine.isDisabled()) {
            console.log('Recognition ended but should be listening - scheduling restart');
            this.restartRecognition();
        }
    }

    private restartRecognition() {
        // Use a timeout to prevent rapid restarts
        if (this.restartTimeout !== null) {
            window.clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }

        this.restartTimeout = window.setTimeout(() => {
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

    private async startRecognition() {
        if (this.recognitionActive) {
            console.log('Recognition already active, skipping start');
            return;
        }

        try {
            await this.recognition.start();
            this.recognitionActive = true;
            console.log('Started speech recognition');
        } catch (error) {
            console.error('Failed to start recognition:', error);
            this.recognitionActive = false;
            throw error;
        }
    }

    private async stopRecognition() {
        if (!this.recognitionActive) {
            console.log('Recognition not active, skipping stop');
            return;
        }

        try {
            await this.recognition.stop();
            this.recognitionActive = false;
            console.log('Stopped speech recognition');
        } catch (error) {
            console.error('Failed to stop recognition:', error);
            this.recognitionActive = false;
            throw error;
        }
    }

    start() {
        console.log('Starting WakeWordListener');
        try {
            if (!this.recognition) {
                throw new Error('Speech recognition not initialized');
            }

            // Request microphone permissions
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(() => {
                        this.stateMachine.enable(true);
                        this.startRecognition();
                    })
                    .catch((err) => {
                        console.error('Failed to get microphone permission:', err);
                        this.stateMachine.permissionDenied();
                    });
            } else {
                throw new Error('Media devices not supported');
            }
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            this.onError(error instanceof Error ? error : new Error('Failed to start speech recognition'));
        }
    }

    stop() {
        console.log('Stopping WakeWordListener');
        try {
            if (!this.recognition) {
                throw new Error('Speech recognition not initialized');
            }
            
            this.stateMachine.disable();
            
            // Clear any pending restart
            if (this.restartTimeout !== null) {
                window.clearTimeout(this.restartTimeout);
                this.restartTimeout = null;
            }
            
            this.stopRecognition();
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
            this.onError(error instanceof Error ? error : new Error('Failed to stop speech recognition'));
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
} 