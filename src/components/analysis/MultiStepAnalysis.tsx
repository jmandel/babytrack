import React, { useState, useCallback } from 'react';
import { NewbornEvent } from '@/types/newbornTracker';
import { Box, TextField, Button, Typography, Alert, CircularProgress } from '@mui/material';
import OpenAI from 'openai';
import { executeCode } from '@/lib/codeExecutor';
import { schema } from '@/generated/schema';
import ReactMarkdown from 'react-markdown';
import { VizBlock } from './VizBlock';
import _ from 'lodash';
import { VisualizationLibrary } from './VisualizationLibrary';

export interface MultiStepAnalysisProps {
    events: NewbornEvent[];
  apiKey: string;
  model: string;
}

type MessageRole = 'system' | 'user' | 'assistant';

interface Message {
  role: MessageRole;
  content: string;
}

interface Visualization {
  id: string;
  code: string;
}

const systemPrompt = `You are a specialized newborn-tracking data analyst. 

Available Tools:
- A JavaScript array \`events\` containing NewbornEvent objects
- Lodash available globally as \`_\` for data manipulation
- Vega-Lite for creating visualizations

Your jsViz code blocks should return a Vega-Lite specification object that will be rendered automatically.
Focus on creating clear, informative visualizations that help parents understand their baby's patterns.

Schema:
${schema}

You can write responses that mix text with two types of code blocks:
1. Analysis blocks wrapped in <jsAnalysis>...</jsAnalysis> for data processing and logging
2. Visualization blocks wrapped in <jsViz>...</jsViz> for creating Vega-Lite specifications

IMPORTANT: 
- Always derive data dynamically from the events array. Never hardcode values.
- Each code block is executed in isolation. Variables defined in one block are not available in other blocks.
- Visualization blocks must return a complete Vega-Lite specification object.
- Keep visualizations simple and clear, with good titles and labels.

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
    })
  }))
  .value();

console.log('Hourly feeding statistics:', feedingStats);
</jsAnalysis>

<jsViz>
// Transform events into a format suitable for Vega-Lite
const data = _.chain(events)
  .filter(e => e.eventType === 'FEEDING')
  .map(e => ({
    hour: new Date(e.occurredAt).getHours(),
    type: e.subType,
    volume: e.subType === 'BOTTLE' ? 
      (e.details?.amountMlConsumed || e.details?.amountMlOffered || 0) : null
  }))
  .value();

// Return a Vega-Lite spec for a layered chart
return {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  data: { values: data },
  width: 'container',
  height: 300,
  layer: [
    {
      mark: { type: 'bar', color: 'steelblue' },
      encoding: {
        x: { 
          field: 'hour', 
          type: 'ordinal', 
          title: 'Hour of Day',
          axis: { labelAngle: 0 }
        },
        y: { 
          aggregate: 'count',
          title: 'Number of Feedings'
        },
        tooltip: [
          { field: 'hour', title: 'Hour' },
          { aggregate: 'count', title: 'Feedings' }
        ]
      }
    },
    {
      mark: { 
        type: 'line',
        color: 'red',
        strokeWidth: 2
      },
      transform: [
        { filter: "datum.type === 'BOTTLE'" }
      ],
      encoding: {
        x: { 
          field: 'hour',
          type: 'ordinal'
        },
        y: {
          aggregate: 'mean',
          field: 'volume',
          title: 'Average Volume (ml)',
          axis: { titleColor: 'red' }
        },
        tooltip: [
          { field: 'hour', title: 'Hour' },
          { aggregate: 'mean', field: 'volume', title: 'Avg Volume (ml)', format: '.1f' }
        ]
      }
    }
  ],
  title: 'Feeding Patterns Throughout the Day',
  config: {
    view: { stroke: null }
  }
};
</jsViz>

Based on the analysis above, we can see the feeding patterns across different hours of the day. The blue bars show the total number of feedings (both bottle and nursing), while the red line shows the average volume of bottle feedings. This helps identify when your baby tends to eat more frequently and when they typically take larger bottle feeds.`;

const InputBox = React.memo(({ 
  onSend, 
  disabled,
  initialValue = ''
}: { 
  onSend: (input: string) => void, 
  disabled: boolean,
  initialValue?: string 
}) => {
  const [input, setInput] = useState(initialValue);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Update input when initialValue changes
  React.useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
      // Use setTimeout to ensure the input value is set before focusing
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(initialValue.length, initialValue.length);
        }
      }, 0);
    }
  }, [initialValue]);

    return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          placeholder="Ask about patterns (e.g., 'Show feeding amounts by hour')"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
              e.preventDefault();
              onSend(input);
              setInput('');
            }
          }}
          disabled={disabled}
          multiline
          rows={2}
        />
        <Button
          variant="contained"
          onClick={() => {
            onSend(input);
            setInput('');
          }}
          disabled={disabled || !input.trim()}
        >
          Ask
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        Press Enter to send • Code blocks will execute automatically
        </Typography>
      </Box>
  );
});

const MessageList = React.memo(({ 
  messages, 
  events,
  isProcessing 
}: { 
  messages: Message[], 
  events: NewbornEvent[],
  isProcessing: boolean 
}) => (
  <>
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
            <MessageContent message={message} events={events} />
              </Box>
            )}
          </Box>
        ))}
        {isProcessing && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
  </>
));

// Update MessageContent to include convertTagsToMarkdown
const MessageContent = React.memo(({ message, events }: { message: Message, events: NewbornEvent[] }) => {
  const convertTagsToMarkdown = (content: string): { markdown: string, visualizations: Visualization[] } => {
    const visualizations: Visualization[] = [];
    let currentIndex = 0;
    
    // Split content by jsViz blocks
    const parts = content.split(/(<jsViz>[\s\S]*?<\/jsViz>)/);
    
    const markdown = parts.map(part => {
      if (part.startsWith('<jsViz>')) {
        // Extract the code from the jsViz block
        const code = part.replace(/<jsViz>\s*([\s\S]*?)\s*<\/jsViz>/, '$1');
        const id = `viz-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        visualizations.push({ id, code });
        // Return empty string since we'll render the VizBlock separately
        return '';
      }
      
      // For other content, convert XML tags to markdown code blocks
      return part
        .replace(/<jsAnalysis>([\s\S]*?)<\/jsAnalysis>/g, '```javascript\n$1\n```')
        .replace(/<jsAnalysisResult>([\s\S]*?)<\/jsAnalysisResult>/g, '```output\n$1\n```');
    }).join('');

    return { markdown, visualizations };
  };

  const { markdown, visualizations } = React.useMemo(() => 
    convertTagsToMarkdown(message.content),
    [message.content]
  );
  
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
        <VizBlock key={viz.id} code={viz.code} events={events} />
      ))}
    </>
  );
});

// Add TestVizBox component
const TestVizBox = React.memo(({ events }: { events: NewbornEvent[] }) => {
  const [code, setCode] = React.useState('');
  const [showTest, setShowTest] = React.useState(false);

  return (
    <Box sx={{ mt: 2, borderTop: 1, borderColor: 'divider', p: 2 }}>
      <Button 
        size="small" 
        onClick={() => setShowTest(!showTest)}
        sx={{ mb: 1 }}
      >
        {showTest ? 'Hide' : 'Show'} Test Visualization Box
      </Button>
      
      {showTest && (
        <>
          <TextField
            multiline
            rows={4}
            fullWidth
            placeholder="Paste jsViz code here to test..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            sx={{ mb: 1, fontFamily: 'monospace', fontSize: '0.875rem' }}
          />
          {code && <VizBlock code={code} events={events} />}
        </>
      )}
        </Box>
  );
});

export function MultiStepAnalysis({ events, apiKey, model }: MultiStepAnalysisProps) {
  // Add window.events and window._ sync
  React.useEffect(() => {
    (window as any).events = events;
    (window as any)._ = _;
  }, [events]);

  const [messages, setMessages] = useState<Message[]>([
    { role: /o1/.test(model) ? 'user' : 'system', content: systemPrompt }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processCodeBlocks = useCallback(async (content: string): Promise<{
    processedContent: string,
    hasAnalysis: boolean
  }> => {
    // Extract code blocks, handling both complete and incomplete tags
    const parts = content.split(/(<jsAnalysis>[\s\S]*?(?:<\/jsAnalysis>|$)|<jsViz>[\s\S]*?(?:<\/jsViz>|$))/);
    
    let result = '';
    let hasAnalysis = false;
    for (const part of parts) {
      if (part.startsWith('<jsAnalysis>')) {
        hasAnalysis = true;
        const code = part
          .replace(/^<jsAnalysis>\s*/, '')
          .replace(/\s*<\/jsAnalysis>$/, '')
          .trim();
        const execResult = await executeCode(code, events);
        // Preserve the original analysis block and append the result
        result += `<jsAnalysis>${code}</jsAnalysis>\n<jsAnalysisResult>\n${execResult.logs.join('\n')}\n</jsAnalysisResult>\n`;
      } else if (part.startsWith('<jsViz>')) {
        const code = part
          .replace(/^<jsViz>\s*/, '')
          .replace(/\s*<\/jsViz>$/, '')
          .trim();
        // Add back the tags to ensure proper handling in MessageContent
        result += `<jsViz>${code}</jsViz>`;
      } else {
        result += part;
      }
    }
    return { processedContent: result, hasAnalysis };
  }, [events]);

  const getCompletion = useCallback(async (messages: Message[]) => {
    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });

    console.log('Sending messages to OpenAI:', messages.map(m => ({
      role: m.role,
      contentPreview: m.content.slice(0, 100) + (m.content.length > 100 ? '...' : '')
    })));

    const isO1Model = /o1/.test(model);
    const completion = await openai.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      })),
      ...(isO1Model ? {
        max_completion_tokens: 15000
      } : {
        temperature: 0.2,
        max_tokens: 15000
      }),
      stop: ['</jsAnalysis>', '</jsViz>']
    });

    return completion.choices[0].message.content;
  }, [apiKey, model]);

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

  // Add state for prefilled input
  const [prefilledInput, setPrefilledInput] = useState('');

  // Add handler for chat to adjust
  const handleChatToAdjust = useCallback((code: string) => {
    setPrefilledInput(`I'd like to adjust this visualization:\n\n\`\`\`javascript\n${code}\n\`\`\`\n\nSpecifically, I want to `);
  }, []);

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.paper',
      borderLeft: {
        xs: 'none',
        lg: 1
      },
      borderColor: 'divider',
      width: {
        xs: '100%',
        lg: '400px'
      },
      position: {
        xs: 'static',
        lg: 'relative'
      }
    }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Data Analysis</Typography>
        <Typography variant="body2" color="text.secondary">
          Ask questions about your baby's patterns and get visualizations
        </Typography>
      </Box>

      {/* Messages Area */}
      <Box sx={{ 
        p: 2,
        flexGrow: 1,
        overflowY: 'auto',
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
        
        <MessageList messages={messages} events={events} isProcessing={isProcessing} />
      </Box>

      {/* Input Area */}
      <InputBox 
        onSend={sendMessage} 
        disabled={isProcessing} 
        initialValue={prefilledInput}
      />

      {/* Test Visualization Box */}
      <TestVizBox events={events} />

      {/* Visualization Library */}
      <Box sx={{ 
        borderTop: 1, 
        borderColor: 'divider',
        p: 2
      }}>
        <Typography variant="subtitle2" gutterBottom>
          Visualization Library
        </Typography>
        <VisualizationLibrary onChatToAdjust={handleChatToAdjust} />
      </Box>
    </Box>
  );
} 