// Define the possible states for the microphone
export type MicState = 'DISABLED' | 'LISTENING_ASLEEP' | 'LISTENING_AWAKE';

// Define the possible events that can trigger state transitions
export type MicEvent = 
  | { type: 'ENABLE' }
  | { type: 'DISABLE' }
  | { type: 'WAKE' }
  | { type: 'SLEEP' };

// Define the state machine context
export interface MicContext {
  awakeningId: number;
}

// Define the state machine configuration
interface MicStateConfig {
  onStateChange?: (state: MicState, context: MicContext) => void;
  onError?: (error: string) => void;
}

export class MicStateMachine {
  private state: MicState = 'DISABLED';
  private context: MicContext = {
    awakeningId: 0
  };
  private onStateChange?: (state: MicState, context: MicContext) => void;
  private onError?: (error: string) => void;

  constructor(config?: MicStateConfig) {
    this.onStateChange = config?.onStateChange;
    this.onError = config?.onError;
  }

  // Get the current state
  getState(): MicState {
    return this.state;
  }

  // Get the current context
  getContext(): MicContext {
    return { ...this.context };
  }

  // Handle state transitions
  private transition(event: MicEvent): void {
    const prevState = this.state;
    const prevContext = { ...this.context };

    console.log(`[MicStateMachine] Processing event: ${event.type} in state: ${this.state}`, {
      currentState: this.state,
      currentContext: this.context,
      event
    });

    // Handle state transitions based on current state and event
    switch (this.state) {
      case 'DISABLED':
        if (event.type === 'ENABLE') {
          this.state = 'LISTENING_ASLEEP';
        }
        break;

      case 'LISTENING_ASLEEP':
        switch (event.type) {
          case 'DISABLE':
            this.state = 'DISABLED';
            break;
          case 'WAKE':
            this.state = 'LISTENING_AWAKE';
            this.context.awakeningId++;
            break;
        }
        break;

      case 'LISTENING_AWAKE':
        switch (event.type) {
          case 'DISABLE':
            this.state = 'DISABLED';
            break;
          case 'SLEEP':
            this.state = 'LISTENING_ASLEEP';
            break;
        }
        break;
    }

    // Log state transitions for debugging
    if (this.state !== prevState) {
      console.log(`[MicStateMachine] State transition complete: ${prevState} -> ${this.state}`, {
        event,
        prevContext,
        newContext: this.context
      });
    }

    // Notify if state or context changed
    if (this.state !== prevState || JSON.stringify(this.context) !== JSON.stringify(prevContext)) {
      this.onStateChange?.(this.state, this.getContext());
    }
  }

  // Public methods to send events
  enable(): void {
    this.transition({ type: 'ENABLE' });
  }

  disable(): void {
    this.transition({ type: 'DISABLE' });
  }

  wake(): void {
    this.transition({ type: 'WAKE' });
  }

  sleep(): void {
    this.transition({ type: 'SLEEP' });
  }

  // Helper methods to check state
  isDisabled(): boolean {
    return this.state === 'DISABLED';
  }

  isListening(): boolean {
    return this.state === 'LISTENING_ASLEEP' || this.state === 'LISTENING_AWAKE';
  }

  isAwake(): boolean {
    return this.state === 'LISTENING_AWAKE';
  }
} 