import { NewbornEvent } from '@/types/newbornTracker';
import _ from 'lodash';

interface ExecutionResult {
  logs: string[];
  returnValue?: any;
  error?: string;
}

export async function executeCode(code: string, events: NewbornEvent[]): Promise<ExecutionResult> {
  try {
    const logs: string[] = [];
    const mockConsole = {
      log: (...args: any[]) => {
        logs.push(args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      }
    };

    // Execute the code with access to events and lodash
    const fn = new Function(
      'events', '_', 'console',
      `"use strict";
      try {
        const result = (function() {
          ${code}
        })();
        return result;
      } catch (err) {
        throw err;
      }`
    );

    const returnValue = await fn(events, _, mockConsole);
    return { logs, returnValue };
  } catch (err) {
    return { 
      logs: [],
      error: err instanceof Error ? err.message : 'An error occurred'
    };
  }
} 