import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NewbornEvent } from '@/types/newbornTracker';
import { Box, Button, Typography } from '@mui/material';
import { 
  Chart as ChartJS, 
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartType
} from 'chart.js';

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

declare global {
  interface Window {
    _: typeof _;
    Chart: typeof ChartJS;
  }
}

// Initialize global dependencies
window._ = _;
window.Chart = ChartJS;

interface ComponentBlockProps {
  code: string;
  events: NewbornEvent[];
  onExecutionComplete?: (result: { logs: string[] }) => void;
}

interface ExecutionResult {
  logs: string[];
  element?: HTMLElement;
  error?: string;
}

export function ComponentBlock({ code, events, onExecutionComplete }: ComponentBlockProps) {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const executeCode = useCallback(async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const logs: string[] = [];
      const mockConsole = {
        log: (...args: any[]) => {
          logs.push(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        }
      };

      // Create a container for any DOM elements created by the code
      const container = document.createElement('div');
      const mockDocument = {
        createElement: (tag: string) => document.createElement(tag),
        body: container,
        createElementNS: (ns: string, tag: string) => document.createElementNS(ns, tag)
      };

      // Execute the code with access to events, lodash, and Chart.js
      const fn = new Function(
        'events', '_', 'Chart', 'console', 'document',
        `"use strict";
        try {
          const result = (function() {
            ${code}
          })();
          return { returnValue: result, element: document.body.lastChild };
        } catch (err) {
          throw err;
        }`
      );

      const { returnValue, element } = await fn(events, window._, window.Chart, mockConsole, mockDocument);
      
      // Format all outputs into a single structured block
      const resultParts = [];
      if (logs.length > 0) {
        resultParts.push('// Console Output:', ...logs);
      }
      if (returnValue !== undefined) {
        resultParts.push(
          '// Return Value:',
          typeof returnValue === 'object' ? JSON.stringify(returnValue, null, 2) : String(returnValue)
        );
      }

      const executionResult = { 
        logs: resultParts,
        element: element instanceof HTMLElement ? element : undefined
      };
      
      setResult(executionResult);
      onExecutionComplete?.(executionResult);
    } catch (err) {
      const errorResult = { 
        logs: [
          '// Errors:',
          err instanceof Error ? err.message : 'An error occurred'
        ],
        error: err instanceof Error ? err.message : 'An error occurred'
      };
      setResult(errorResult);
      onExecutionComplete?.(errorResult);
    } finally {
      setIsRunning(false);
    }
  }, [code, events, onExecutionComplete]);

  // Auto-execute on mount or when code/events change
  useEffect(() => {
    executeCode();
  }, [executeCode]);

  // Update output element when result changes
  useEffect(() => {
    if (outputRef.current && result?.element) {
      outputRef.current.innerHTML = '';
      outputRef.current.appendChild(result.element);
    }
  }, [result]);

  return (
    <Box sx={{ 
      border: 1, 
      borderColor: 'divider',
      borderRadius: 1,
      overflow: 'hidden',
      mb: 2
    }}>
      {/* Code Section */}
      <Box sx={{ 
        p: 1.5,
        bgcolor: 'grey.50',
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <pre style={{ 
          margin: 0,
          fontSize: '0.875rem',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          {code}
        </pre>
      </Box>

      {/* Output Section */}
      <Box sx={{ p: 1.5 }}>
        {isRunning ? (
          <Typography variant="body2" color="text.secondary">
            Running...
          </Typography>
        ) : result?.error ? (
          <Typography variant="body2" color="error" sx={{ whiteSpace: 'pre-wrap' }}>
            {result.error}
          </Typography>
        ) : (
          <>
            {/* Console Logs */}
            {result?.logs.length ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Console Output:
                </Typography>
                <pre style={{ 
                  margin: 0,
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  color: 'rgba(0,0,0,0.7)'
                }}>
                  {result.logs.join('\n')}
                </pre>
              </Box>
            ) : null}

            {/* Rendered Output */}
            <div ref={outputRef} />
          </>
        )}

        {/* Run Button */}
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={executeCode}
            disabled={isRunning}
          >
            {isRunning ? 'Running...' : 'Run Again'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
} 