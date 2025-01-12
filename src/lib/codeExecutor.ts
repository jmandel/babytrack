import { NewbornEvent } from '@/types/newbornTracker';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import _ from 'lodash';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Initialize global dependencies
window._ = _;
window.Chart = ChartJS;

interface ExecutionResult {
  logs: string[];
  element?: HTMLElement;
  error?: string;
}

export async function executeCode(code: string, events: NewbornEvent[]): Promise<ExecutionResult> {
  const logs: string[] = [];
  let element: HTMLElement | undefined;
  let error: string | undefined;

  // Capture console.log output
  const originalLog = console.log;
  console.log = (...args) => {
    logs.push(args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' '));
  };

  try {
    // Execute the code with access to events array and global utilities
    const result = await eval(`(async () => {
      try {
        ${code}
      } catch (e) {
        throw e;
      }
    })()`);

    // If code returned a DOM element, capture it
    if (result instanceof HTMLElement) {
      element = result;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'An error occurred during execution';
  } finally {
    // Restore original console.log
    console.log = originalLog;
  }

  return { logs, element, error };
} 