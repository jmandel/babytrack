// Define the possible states for the microphone
export type MicState = 'DISABLED' | 'SLEEPING' | 'AWAKE';

// Define the possible events that can trigger state transitions
export type MicEvent = 
  | { type: 'ENABLE'; hasPermission?: boolean }
  | { type: 'DISABLE' }
  | { type: 'WAKE' }
  | { type: 'SLEEP' }
  | { type: 'PERMISSION_DENIED' };

// Define the state machine context
export interface MicContext {
  hasPermission: boolean;
  error?: string;
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
    hasPermission: false,
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

    // Handle state transitions based on current state and event
    switch (this.state) {
      case 'DISABLED':
        if (event.type === 'ENABLE') {
          if (event.hasPermission) {
            this.state = 'SLEEPING';
            this.context.hasPermission = true;
            this.context.error = undefined;
          } else {
            this.context.error = 'Microphone permission required';
            this.context.hasPermission = false;
          }
        }
        break;

      case 'SLEEPING':
        switch (event.type) {
          case 'DISABLE':
            this.state = 'DISABLED';
            break;
          case 'WAKE':
            if (this.context.hasPermission) {
              this.state = 'AWAKE';
              this.context.awakeningId++;
              this.context.error = undefined;
            } else {
              this.context.error = 'Cannot wake without microphone permission';
            }
            break;
          case 'PERMISSION_DENIED':
            this.state = 'DISABLED';
            this.context.hasPermission = false;
            this.context.error = 'Microphone permission denied';
            break;
        }
        break;

      case 'AWAKE':
        switch (event.type) {
          case 'DISABLE':
            this.state = 'DISABLED';
            break;
          case 'SLEEP':
            this.state = 'SLEEPING';
            break;
          case 'PERMISSION_DENIED':
            this.state = 'DISABLED';
            this.context.hasPermission = false;
            this.context.error = 'Microphone permission denied';
            break;
          case 'ENABLE':
            // Update permission status but stay in current state
            if (event.hasPermission) {
              this.context.hasPermission = true;
              this.context.error = undefined;
            } else {
              this.state = 'DISABLED';
              this.context.hasPermission = false;
              this.context.error = 'Microphone permission required';
            }
            break;
        }
        break;
    }

    // Log state transitions for debugging
    if (this.state !== prevState) {
      console.log(`State transition: ${prevState} -> ${this.state}`, {
        event,
        context: this.context
      });
    }

    // Notify if state or context changed
    if (this.state !== prevState || JSON.stringify(this.context) !== JSON.stringify(prevContext)) {
      this.onStateChange?.(this.state, this.getContext());
    }

    // Notify if there's an error
    if (this.context.error && this.context.error !== prevContext.error) {
      this.onError?.(this.context.error);
    }
  }

  // Public methods to send events
  enable(hasPermission: boolean = false): void {
    this.transition({ type: 'ENABLE', hasPermission });
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

  permissionDenied(): void {
    this.transition({ type: 'PERMISSION_DENIED' });
  }

  // Helper methods to check state
  isDisabled(): boolean {
    return this.state === 'DISABLED';
  }

  isSleeping(): boolean {
    return this.state === 'SLEEPING';
  }

  isAwake(): boolean {
    return this.state === 'AWAKE';
  }

  hasError(): boolean {
    return !!this.context.error;
  }

  getError(): string | undefined {
    return this.context.error;
  }

  hasPermission(): boolean {
    return this.context.hasPermission;
  }
} 