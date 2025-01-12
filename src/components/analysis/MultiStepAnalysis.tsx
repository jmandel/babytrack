import React, { useState, useCallback } from 'react';
import { NewbornEvent } from '@/types/newbornTracker';
import { Box, TextField, Button, Typography, Alert, CircularProgress, Tabs, Tab } from '@mui/material';
import OpenAI from 'openai';
import { executeCode } from '@/lib/codeExecutor';
import { schema } from '@/generated/schema';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  Colors,
  BarController,
  LineController,
  PieController,
  DoughnutController,
  ScatterController,
  BubbleController,
  RadarController,
  PolarAreaController
} from 'chart.js';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  Colors,
  BarController,
  LineController,
  PieController,
  DoughnutController,
  ScatterController,
  BubbleController,
  RadarController,
  PolarAreaController
);

// Set default Chart.js options to disable animations
ChartJS.defaults.animation = false;
ChartJS.defaults.transitions.active.animation.duration = 0;

// Make Chart available globally
(window as any).Chart = ChartJS;

export interface MultiStepAnalysisProps {
    events: NewbornEvent[];
  apiKey: string;
}

type MessageRole = 'system' | 'user' | 'assistant';

interface Message {
  role: MessageRole;
  content: string;
}

const systemPrompt = `You are a specialized newborn-tracking data analyst. 

Available Tools:
- A JavaScript array \`events\` containing NewbornEvent objects
- Lodash available globally as \`_\` for data manipulation
- Chart.js available globally as \`Chart\` with the following chart types:
  * 'line' - for trends over time
  * 'bar' - for comparing quantities
  * 'pie' - for showing proportions
  * 'doughnut' - alternative to pie charts
  * 'scatter' - for plotting two variables
  * 'bubble' - like scatter with a third dimension
  * 'radar' - for comparing multiple variables
  * 'polarArea' - for cyclical data

Schema:
${schema}

You can write responses that mix text with two types of code blocks:
1. Analysis blocks wrapped in <jsAnalysis>...</jsAnalysis> for data processing and logging
2. Visualization blocks wrapped in <jsViz>...</jsViz> for creating and returning chart canvases

IMPORTANT: 
- Always derive data dynamically from the events array. Never hardcode values or transcribe from previous analysis.
- Each code block is executed in isolation. Variables defined in one block are not available in other blocks.
- Visualization blocks must recalculate any data they need - they cannot access variables from analysis blocks.
- In visualization blocks, create the canvas element but DO NOT append it to document.body. Instead, return the canvas element directly.

Example response showing dynamic data processing and visualization:

<jsAnalysis>
// Process events to analyze feeding patterns
const feedingStats = _.chain(events)
  .filter(e => e.eventType === 'FEEDING')
  .groupBy(e => new Date(e.occurredAt).getHours())
  .mapValues(hourEvents => ({
    count: hourEvents.length,
    avgVolume: _.meanBy(hourEvents, e => {
      if (e.subType === 'BOTTLE') {
        return e.details?.amountMlConsumed || e.details?.amountMlOffered || 0;
      }
      return 0;
    }),
    byType: _.countBy(hourEvents, 'subType')
  }))
  .value();

console.log('Hourly feeding statistics:', feedingStats);
</jsAnalysis>

<jsViz>
// Recalculate the stats since we can't access variables from the analysis block
const feedingStats = _.chain(events)
  .filter(e => e.eventType === 'FEEDING')
  .groupBy(e => new Date(e.occurredAt).getHours())
  .mapValues(hourEvents => ({
    count: hourEvents.length,
    avgVolume: _.meanBy(hourEvents, e => {
      if (e.subType === 'BOTTLE') {
        return e.details?.amountMlConsumed || e.details?.amountMlOffered || 0;
      }
      return 0;
    })
  }))
  .value();

// Create and return the chart canvas
const ctx = document.createElement('canvas');
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: Object.keys(feedingStats),
    datasets: [{
      label: 'Average Bottle Volume (ml)',
      data: Object.values(feedingStats).map(h => h.avgVolume),
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }, {
      label: 'Number of Feedings',
      data: Object.values(feedingStats).map(h => h.count),
      type: 'line',
      borderColor: 'rgba(255, 99, 132, 1)',
      fill: false
    }]
  },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Feeding Patterns by Hour'
      },
      legend: {
        display: true,
        position: 'top'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Volume (ml)'
        }
      }
    }
  }
});
// Return the canvas element
return ctx;
</jsViz>

Based on the analysis above, we can see the actual feeding patterns across different hours of the day. The chart combines both the average bottle volume and the frequency of feedings to show when your baby tends to eat more or more often.`;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box>{children}</Box>
      )}
    </div>
  );
}

export function MultiStepAnalysis({ events, apiKey }: MultiStepAnalysisProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processCodeBlocks = useCallback(async (content: string): Promise<{
    processedContent: string,
    hasAnalysis: boolean
  }> => {
    // Extract code blocks
    const parts = content.split(/(<jsAnalysis>[\s\S]*?$|<jsViz>[\s\S]*?$)/);
    
    let result = '';
    let hasAnalysis = false;
    for (const part of parts) {
      if (part.startsWith('<jsAnalysis>')) {
        hasAnalysis = true;
        const code = part.replace(/^<jsAnalysis>\s*/, '').trim();
        const execResult = await executeCode(code, events);
        // Preserve the original analysis block and append the result
        result += part + '</jsAnalysis>\n<jsAnalysisResult>\n' + execResult.logs.join('\n') + '\n</jsAnalysisResult>\n';
      } else if (part.startsWith('<jsViz>')) {
        const code = part.replace(/^<jsViz>\s*/, '').trim();
        // Create a unique ID for this visualization
        const vizId = `viz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Store the code to be executed later
        result += `<div class="viz-placeholder" data-viz-id="${vizId}" data-code="${encodeURIComponent(code)}"></div>`;
      } else {
        result += part;
      }
    }
    return { processedContent: result, hasAnalysis };
  }, [events]);

  // Add a new function to execute visualization code
  const executeVisualization = useCallback(async (code: string, vizId: string) => {
    const execResult = await executeCode(code, events);
    if (execResult.element) {
      const container = document.getElementById(vizId);
      if (container) {
        container.innerHTML = '';
        container.appendChild(execResult.element);
      }
    }
  }, [events]);

  // Update MessageContent to be memoized
  const MessageContent = React.memo(({ message }: { message: Message }) => {
    const { markdown, visualizations } = React.useMemo(() => 
      convertTagsToMarkdown(message.content),
      [message.content]
    );
    
    React.useEffect(() => {
      // Execute visualizations after render
      visualizations.forEach(viz => {
        executeVisualization(viz.code, viz.id);
      });
    }, [visualizations]);

    return (
      <>
        <Box className="markdown-content">
          <ReactMarkdown components={{
            pre: ({ node, ...props }) => (
              <pre {...props} style={{ 
                margin: '1em 0',
                padding: '1em',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto'
              }} />
            )
          }}>{markdown}</ReactMarkdown>
        </Box>
        {visualizations.map(viz => (
          <div key={viz.id} className="analysis-visualization" id={viz.id} />
        ))}
      </>
    );
  }, (prevProps, nextProps) => prevProps.message.content === nextProps.message.content);

  const getCompletion = useCallback(async (messages: Message[]) => {
    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });

    console.log('Sending messages to OpenAI:', messages.map(m => ({
      role: m.role,
      contentPreview: m.content.slice(0, 100) + (m.content.length > 100 ? '...' : '')
    })));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      })),
      temperature: 0.2,
      max_tokens: 1500,
      stop: ['</jsAnalysis>', '</jsViz>']
    });

    return completion.choices[0].message.content;
  }, [apiKey]);

  const sendMessage = useCallback(async (input: string) => {
    if (!apiKey) {
      setError('Please set your OpenAI API key in settings first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Initialize conversation if empty
      const newMessages: Message[] = [
        ...messages,
        { role: 'user', content: input }
      ];
      if (messages.length === 0) {
        newMessages.unshift({ role: 'system', content: systemPrompt });
      }
      setMessages(newMessages);
      setUserInput('');

      // Analysis loop - continue until we get a response with no analysis blocks
      let currentMessages = newMessages;
      let hasMoreAnalysis = true;
      let iterationCount = 0;
      const MAX_ITERATIONS = 5;

      while (hasMoreAnalysis && iterationCount < MAX_ITERATIONS) {
        console.log(`Starting analysis iteration ${iterationCount + 1}`);
        
        // Get model response
        const responseContent = await getCompletion(currentMessages);
        if (!responseContent) break;

        // Process any code blocks in the response
        const { processedContent, hasAnalysis } = await processCodeBlocks(responseContent);
        
        // Add processed response to messages
        const assistantMessage = { 
          role: 'assistant' as const, 
          content: processedContent 
        };
        currentMessages = [...currentMessages, assistantMessage];
        setMessages(currentMessages);

        // Continue loop if we found analysis blocks
        hasMoreAnalysis = hasAnalysis;
        iterationCount++;

        if (iterationCount === MAX_ITERATIONS) {
          console.log('Reached maximum number of analysis iterations');
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get analysis');
    } finally {
      setIsProcessing(false);
    }
  }, [messages, apiKey, getCompletion, processCodeBlocks]);

  const convertTagsToMarkdown = (content: string): { markdown: string, visualizations: Array<{id: string, code: string}> } => {
    const visualizations: Array<{id: string, code: string}> = [];
    
    // First handle viz placeholders
    const parts = content.split(/(<div class="viz-placeholder".*?<\/div>)/s);
    
    const markdown = parts.map(part => {
      // If this is a viz placeholder, extract the code and store viz info
      if (part.startsWith('<div class="viz-placeholder"')) {
        const codeMatch = part.match(/data-code="([^"]*?)"/);
        const vizIdMatch = part.match(/data-viz-id="([^"]*?)"/);
        if (codeMatch && vizIdMatch) {
          const code = decodeURIComponent(codeMatch[1]);
          const vizId = vizIdMatch[1];
          visualizations.push({ id: vizId, code });
          return `\`\`\`javascript\n${code}\n\`\`\``;
        }
        return part;
      }
      
      // For other content, convert XML tags to markdown code blocks
      return part
        .replace(/<jsAnalysis>([\s\S]*?)<\/jsAnalysis>/g, '```javascript\n$1\n```')
        .replace(/<jsAnalysisResult>([\s\S]*?)<\/jsAnalysisResult>/g, '```output\n$1\n```')
        .replace(/<jsViz>([\s\S]*?)<\/jsViz>/g, '```javascript\n$1\n```');
    }).join('');

    return { markdown, visualizations };
  };

  return (
    <Box sx={{ 
      height: '100vh',
      width: {
        xs: '100%',
        lg: '400px'
      },
      position: {
        xs: 'static',
        lg: 'fixed'
      },
      right: {
        xs: 'auto',
        lg: 0
      },
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.paper',
      borderLeft: {
        xs: 'none',
        lg: 1
      },
      borderColor: 'divider'
    }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Data Analysis</Typography>
        <Typography variant="body2" color="text.secondary">
          Ask questions about your baby's patterns and get visualizations
        </Typography>
      </Box>

      {/* Messages Area */}
      <Box id="analysis-output" sx={{ 
        flex: 1, 
        overflow: 'auto', 
        p: 2,
        '& .analysis-visualization': {
          my: 2,
          '& canvas': {
            maxWidth: '100%',
            height: 'auto !important'
          }
        }
      }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}
        
        {messages.filter(m => m.role !== 'system').map((message) => (
          <Box key={`message-${message.role}-${message.content.slice(0, 20)}`} sx={{ mb: 2 }}>
            {message.role === 'user' ? (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ 
                  maxWidth: '80%',
                  p: 1.5,
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  borderRadius: 2
                }}>
                  <Typography variant="body2">{message.content}</Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ 
                maxWidth: '80%',
                p: 1.5,
                bgcolor: 'grey.100',
                borderRadius: 2,
                '& .markdown-content': {
                  '& p': { 
                    m: 0,
                    mb: 1,
                    '&:last-child': {
                      mb: 0
                    }
                  },
                  '& pre': { 
                    m: 0,
                    mt: 1,
                    mb: 1,
                    p: 1.5,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    '&:last-child': {
                      mb: 0
                    }
                  },
                  '& code': {
                    p: 0.5,
                    bgcolor: 'grey.50',
                    borderRadius: 0.5,
                    fontSize: '0.875rem',
                    fontFamily: 'monospace'
                  },
                  '& ul, & ol': {
                    m: 0,
                    mb: 1,
                    pl: 2,
                    '&:last-child': {
                      mb: 0
                    }
                  },
                  '& h1, & h2, & h3, & h4, & h5, & h6': {
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    m: 0,
                    mb: 1,
                    '&:last-child': {
                      mb: 0
                    }
                  }
                }
              }}>
                <MessageContent message={message} />
              </Box>
            )}
          </Box>
        ))}

        {isProcessing && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>

      {/* Input Area */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask about patterns (e.g., 'Show feeding amounts by hour')"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && userInput.trim()) {
                e.preventDefault();
                sendMessage(userInput);
              }
            }}
            disabled={isProcessing}
          />
          <Button
            variant="contained"
            onClick={() => sendMessage(userInput)}
            disabled={isProcessing || !userInput.trim()}
          >
            Ask
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Press Enter to send • Code blocks will execute automatically
        </Typography>
      </Box>
    </Box>
  );
} 