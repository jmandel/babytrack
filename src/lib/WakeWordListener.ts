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
    private stateMachine: MicStateMachine;
    private recognizing: boolean = false;
    private ignoreOnEnd: boolean = false;
    private desiredListeningState: boolean = false;

    constructor(config: WakeWordListenerConfig) {
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
                    isAwake: state === 'LISTENING_AWAKE',
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

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();

            // Configure recognition
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            this.recognition.lang = 'en-US';

            // Set up event handlers
            this.recognition.onstart = () => {
                this.recognizing = true;
                this.onDebug?.({ event: 'start' });
                this.onListeningChange?.(true);
            };

            this.recognition.onend = () => {
                this.recognizing = false;
                if (this.ignoreOnEnd) {
                    this.ignoreOnEnd = false;
                    return;
                }
                this.onListeningChange?.(false);
                
                // Only restart if we're supposed to be listening
                if (this.desiredListeningState && !this.stateMachine.isDisabled()) {
                    setTimeout(() => {
                        this.startRecognition();
                    }, 1000);
                }
            };

            this.recognition.onerror = (event) => {
                if (event.error === 'not-allowed') {
                    this.ignoreOnEnd = true;
                    this.recognizing = false;
                    this.onError(new Error('Microphone permission denied'));
                    this.stop();
                    return;
                }
                
                if (event.error === 'no-speech') {
                    this.ignoreOnEnd = true;
                    this.onDebug?.({ event: 'no-speech' });
                    return;
                }

                this.onError(new Error(`Speech recognition error: ${event.error}`));
            };

            this.recognition.onresult = this.handleResult.bind(this);

            // Handle visibility changes
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.ignoreOnEnd = true;
                    if (this.recognizing) {
                        this.recognition.stop();
                    }
                } else if (document.visibilityState === 'visible' && this.desiredListeningState) {
                    setTimeout(() => {
                        this.startRecognition();
                    }, 1000);
                }
            });

        } catch (error) {
            this.onError(error instanceof Error ? error : new Error('Failed to initialize speech recognition'));
            throw error;
        }
    }

    private async startRecognition() {
        if (this.recognizing) {
            return;
        }

        try {
            // First try to get microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Stop the stream right away - we don't need to keep it
            stream.getTracks().forEach(track => track.stop());

            // Now that we have permission, start recognition
            this.ignoreOnEnd = false;
            await this.recognition.start();
            this.onDebug?.({ event: 'recognition-started' });
            // Only now enable the state machine
            this.stateMachine.enable();
        } catch (error) {
            if (error instanceof Error) {
                if ((error as any).name === 'NotAllowedError' || (error as any).name === 'PermissionDeniedError') {
                    this.onError(new Error('Microphone permission denied'));
                } else {
                    this.onError(error);
                }
            } else {
                this.onError(new Error('Failed to start recognition'));
            }
            this.ignoreOnEnd = true;
            this.stop();
        }
    }

    async setListening(shouldListen: boolean) {
        this.desiredListeningState = shouldListen;
        
        if (shouldListen) {
            await this.startRecognition();
        } else {
            await this.stop();
        }
    }

    async stop() {
        this.desiredListeningState = false;
        if (this.recognizing) {
            this.ignoreOnEnd = true;
            try {
                await this.recognition.stop();
            } catch (error) {
                console.error('Error stopping recognition:', error);
            }
        }
        // Only disable state machine after stopping recognition
        this.stateMachine.disable();
    }

    get listening(): boolean {
        return !this.stateMachine.isDisabled();
    }

    // Debug methods
    debugSetWakeState(isAwake: boolean) {
        if (isAwake) {
            this.stateMachine.wake();
        } else {
            this.stateMachine.sleep();
        }
    }

    debugSimulateUtterance(text: string) {
        if (this.onUtterance) {
            this.onUtterance({ text });
        }
    }

    updateWakeWord(word: string) {
        this.wakeWord = word.toLowerCase();
    }

    updateSleepWord(word: string) {
        this.sleepWord = word.toLowerCase();
    }

    private handleResult(event: SpeechRecognitionEvent) {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript.toLowerCase().trim();
        const isFinal = event.results[current].isFinal;

        // Log all utterances (both partial and final)
        console.log(`[Speech] ${isFinal ? 'Final' : 'Partial'}: "${transcript}"`);

        // Only process commands on final results
        if (!isFinal) return;

        // Wake word detection
        if (!this.stateMachine.isAwake() && transcript.includes(this.wakeWord)) {
            this.stateMachine.wake();
            
            // Process content after wake word, excluding the wake word itself
            const parts = transcript.split(this.wakeWord);
            const afterWake = parts[parts.length - 1]?.trim();
            if (afterWake && !afterWake.includes(this.sleepWord)) {
                this.onUtterance?.({ text: afterWake });
            }
            return;
        }

        // Sleep word detection
        if (this.stateMachine.isAwake() && transcript.includes(this.sleepWord)) {
            // Process content before sleep word, excluding the sleep word itself
            const parts = transcript.split(this.sleepWord);
            const beforeSleep = parts[0]?.trim();
            if (beforeSleep && !beforeSleep.includes(this.wakeWord)) {
                this.onUtterance?.({ text: beforeSleep });
            }
            
            this.stateMachine.sleep();
            return;
        }

        // Normal utterance when awake - only send if not a wake/sleep command
        if (this.stateMachine.isAwake() && 
            !transcript.includes(this.wakeWord) && 
            !transcript.includes(this.sleepWord)) {
            this.onUtterance?.({ text: transcript });
        }
    }
} 