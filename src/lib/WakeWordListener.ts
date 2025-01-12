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

export class WakeWordListener {
    private recognition: SpeechRecognition;
    private wakeWord: string;
    private sleepWord: string;
    private isAwake: boolean = false;
    private awakeningId: number = 0;
    private onStateChange: (state: { isAwake: boolean; awakeningId: number }) => void;
    private onError: (error: Error) => void;
    private onUtterance?: (utterance: { text: string }) => void;
    private onDebug?: (event: any) => void;
    private isListening: boolean = false;
    private isPaused: boolean = false;
    private restartTimeout: number | null = null;

    constructor(config: WakeWordListenerConfig) {
        console.log('Initializing WakeWordListener with config:', config);
        this.wakeWord = config.wakeWord.toLowerCase();
        this.sleepWord = config.sleepWord.toLowerCase();
        this.onStateChange = config.onStateChange;
        this.onError = config.onError;
        this.onUtterance = config.onUtterance;
        this.onDebug = config.onDebug;

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
        const transcript = event.results[current][0].transcript.toLowerCase();
        const confidence = event.results[current][0].confidence;
        const isFinal = event.results[current].isFinal;

        console.log('Recognition result:', {
            transcript,
            confidence,
            isFinal,
            isAwake: this.isAwake
        });

        this.onDebug?.({
            event: 'result',
            transcript,
            confidence,
            isFinal,
            isAwake: this.isAwake
        });

        if (!isFinal) return;

        // Wake word detection
        if (!this.isAwake && transcript.includes(this.wakeWord)) {
            console.log('Wake word detected:', this.wakeWord);
            this.isAwake = true;
            this.awakeningId++;
            this.onStateChange({ isAwake: true, awakeningId: this.awakeningId });
            
            // Emit content after wake word if any
            const afterWake = transcript.split(this.wakeWord)[1]?.trim();
            if (afterWake && !afterWake.includes(this.sleepWord)) {
                console.log('Processing content after wake word:', afterWake);
                this.onUtterance?.({ text: afterWake });
            }
            return;
        }

        // Sleep word detection
        if (this.isAwake && transcript.includes(this.sleepWord)) {
            console.log('Sleep word detected:', this.sleepWord);
            const beforeSleep = transcript.split(this.sleepWord)[0]?.trim();
            if (beforeSleep && !beforeSleep.includes(this.wakeWord)) {
                console.log('Processing content before sleep word:', beforeSleep);
                this.onUtterance?.({ text: beforeSleep });
            }
            
            this.isAwake = false;
            this.onStateChange({ isAwake: false, awakeningId: this.awakeningId });
            return;
        }

        // Normal utterance when awake
        if (this.isAwake) {
            console.log('Processing normal utterance:', transcript);
            this.onUtterance?.({ text: transcript });
        }
    }

    private handleError(event: SpeechRecognitionErrorEvent) {
        console.error('Speech recognition error:', event.error);
        this.onError(new Error(`Speech recognition error: ${event.error}`));
        
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            this.setListening(false, `error: ${event.error}`);
            return;
        }
        
        // If we get an error while listening, try to restart
        if (this.isListening && !this.isPaused) {
            console.log('Attempting to restart after error');
            this.restartRecognition();
        }
    }

    private handleEnd() {
        console.log('Recognition ended, isListening:', this.isListening, 'isPaused:', this.isPaused);
        
        // If we should be listening, restart recognition
        if (this.isListening && !this.isPaused) {
            console.log('Recognition ended but should be listening - scheduling restart');
            this.restartRecognition();
        } else if (!this.isListening) {
            // Only update wake state if we're intentionally stopping
            console.log('Recognition ended - stopping (was explicitly stopped)');
            this.isAwake = false;
            this.onStateChange({ isAwake: false, awakeningId: this.awakeningId });
        } else {
            console.log('Recognition ended in unexpected state:', { isListening: this.isListening, isPaused: this.isPaused });
        }
    }

    private restartRecognition() {
        // Use a timeout to prevent rapid restarts
        if (this.restartTimeout !== null) {
            window.clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }

        this.restartTimeout = window.setTimeout(() => {
            if (!this.isListening || this.isPaused) {
                console.log('Not restarting recognition - no longer listening or paused');
                return;
            }

            console.log('Restarting recognition after end event');
            try {
                this.recognition.start();
            } catch (error) {
                console.error('Error restarting recognition:', error);
                // If we fail to restart, try again after a longer delay
                if (this.restartTimeout !== null) {
                    window.clearTimeout(this.restartTimeout);
                    this.restartTimeout = null;
                }
                this.restartTimeout = window.setTimeout(() => {
                    if (this.isListening && !this.isPaused) {
                        this.restartRecognition();
                    }
                }, 1000);
            }
        }, 100);
    }

    start() {
        console.log('Starting WakeWordListener');
        try {
            if (!this.recognition) {
                throw new Error('Speech recognition not initialized');
            }
            if (this.isListening) {
                console.log('Already listening, ignoring start request');
                return;
            }
            this.setListening(true, 'start() called');
            this.isPaused = false;
            
            // Clear any existing restart timeout
            if (this.restartTimeout !== null) {
                window.clearTimeout(this.restartTimeout);
                this.restartTimeout = null;
            }

            this.recognition.start();
            console.log('Started speech recognition');
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            this.onError(error instanceof Error ? error : new Error('Failed to start speech recognition'));
            // Try to restart if we hit an error
            if (this.isListening && !this.isPaused) {
                this.restartRecognition();
            }
        }
    }

    stop() {
        console.log('Stopping WakeWordListener');
        try {
            if (!this.recognition) {
                throw new Error('Speech recognition not initialized');
            }
            if (!this.isListening) {
                console.log('Already stopped, ignoring stop request');
                return;
            }
            this.setListening(false, 'stop() called');
            this.isPaused = false;
            this.isAwake = false;
            
            // Clear any pending restart
            if (this.restartTimeout !== null) {
                window.clearTimeout(this.restartTimeout);
                this.restartTimeout = null;
            }
            
            this.recognition.stop();
            console.log('Stopped speech recognition');
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
            this.onError(error instanceof Error ? error : new Error('Failed to stop speech recognition'));
        }
    }

    updateWakeWord(word: string) {
        console.log('Updating wake word:', word);
        this.wakeWord = word.toLowerCase();
    }

    updateSleepWord(word: string) {
        console.log('Updating sleep word:', word);
        this.sleepWord = word.toLowerCase();
    }

    private setListening(value: boolean, reason: string) {
        const oldValue = this.isListening;
        this.isListening = value;
        console.log(`isListening ${oldValue} -> ${value} (${reason})`);
    }

    get listening() {
        return this.isListening;
    }

    // Debug methods
    debugSetWakeState(isAwake: boolean) {
        console.log('Debug: Manually setting wake state:', isAwake);
        this.isAwake = isAwake;
        if (isAwake) {
            this.awakeningId++;
        }
        this.onStateChange({ isAwake, awakeningId: this.awakeningId });
    }

    debugSimulateUtterance(text: string) {
        console.log('Debug: Simulating utterance:', text);
        if (this.onUtterance) {
            this.onUtterance({ text });
        }
    }
} 