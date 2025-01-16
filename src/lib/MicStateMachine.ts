// Define the possible states for the microphone
export type MicState = 'DISABLED' | 'REQUESTING_PERMISSION' | 'SLEEPING' | 'AWAKE';

// Define the possible events that can trigger state transitions
export type MicEvent = 
  | { type: 'ENABLE' }
  | { type: 'REQUEST_PERMISSION' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'DISABLE' }
  | { type: 'WAKE' }
  | { type: 'SLEEP' };

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

    console.log(`[MicStateMachine] Processing event: ${event.type} in state: ${this.state}`, {
      currentState: this.state,
      currentContext: this.context,
      event
    });

    // Handle state transitions based on current state and event
    switch (this.state) {
      case 'DISABLED':
        if (event.type === 'ENABLE') {
          console.log('[MicStateMachine] Transitioning from DISABLED to REQUESTING_PERMISSION');
          this.state = 'REQUESTING_PERMISSION';
          this.context.error = undefined;
        }
        break;

      case 'REQUESTING_PERMISSION':
        switch (event.type) {
          case 'PERMISSION_GRANTED':
            console.log('[MicStateMachine] Permission granted, transitioning to SLEEPING');
            this.state = 'SLEEPING';
            this.context.hasPermission = true;
            this.context.error = undefined;
            break;
          case 'PERMISSION_DENIED':
            console.log('[MicStateMachine] Permission denied, transitioning to DISABLED');
            this.state = 'DISABLED';
            this.context.hasPermission = false;
            this.context.error = 'Microphone permission denied';
            break;
          case 'DISABLE':
            console.log('[MicStateMachine] Received DISABLE while requesting permission');
            this.state = 'DISABLED';
            break;
        }
        break;

      case 'SLEEPING':
        switch (event.type) {
          case 'DISABLE':
            console.log('[MicStateMachine] Transitioning from SLEEPING to DISABLED');
            this.state = 'DISABLED';
            break;
          case 'WAKE':
            if (this.context.hasPermission) {
              console.log('[MicStateMachine] Transitioning from SLEEPING to AWAKE');
              this.state = 'AWAKE';
              this.context.awakeningId++;
              this.context.error = undefined;
            } else {
              console.log('[MicStateMachine] Cannot wake without permission, transitioning to DISABLED');
              this.context.error = 'Cannot wake without microphone permission';
              this.state = 'DISABLED';
            }
            break;
          case 'PERMISSION_DENIED':
            console.log('[MicStateMachine] Permission denied while SLEEPING, transitioning to DISABLED');
            this.state = 'DISABLED';
            this.context.hasPermission = false;
            this.context.error = 'Microphone permission denied';
            break;
        }
        break;

      case 'AWAKE':
        switch (event.type) {
          case 'DISABLE':
            console.log('[MicStateMachine] Transitioning from AWAKE to DISABLED');
            this.state = 'DISABLED';
            break;
          case 'SLEEP':
            console.log('[MicStateMachine] Transitioning from AWAKE to SLEEPING');
            this.state = 'SLEEPING';
            break;
          case 'PERMISSION_DENIED':
            console.log('[MicStateMachine] Permission denied while AWAKE, transitioning to DISABLED');
            this.state = 'DISABLED';
            this.context.hasPermission = false;
            this.context.error = 'Microphone permission denied';
            break;
        }
        break;
    }

    // Log state transitions for debugging
    if (this.state !== prevState) {
      console.log(`[MicStateMachine] State transition complete: ${prevState} -> ${this.state}`, {
        event,
        prevContext,
        newContext: this.context,
        hasPermission: this.context.hasPermission,
        error: this.context.error
      });
    } else {
      console.log(`[MicStateMachine] No state change after event: ${event.type}`, {
        state: this.state,
        context: this.context
      });
    }

    // Notify if state or context changed
    if (this.state !== prevState || JSON.stringify(this.context) !== JSON.stringify(prevContext)) {
      console.log('[MicStateMachine] Notifying state change listeners', {
        state: this.state,
        context: this.context
      });
      this.onStateChange?.(this.state, this.getContext());
    }

    // Notify if there's an error
    if (this.context.error && this.context.error !== prevContext.error) {
      console.log('[MicStateMachine] Notifying error listeners:', this.context.error);
      this.onError?.(this.context.error);
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

  permissionGranted(): void {
    this.transition({ type: 'PERMISSION_GRANTED' });
  }

  permissionDenied(): void {
    this.transition({ type: 'PERMISSION_DENIED' });
  }

  // Helper methods to check state
  isDisabled(): boolean {
    return this.state === 'DISABLED';
  }

  isRequestingPermission(): boolean {
    return this.state === 'REQUESTING_PERMISSION';
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