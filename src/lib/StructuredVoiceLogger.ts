import OpenAI from 'openai';
import { format } from 'date-fns-tz';
import JSON5 from 'json5';
import { WakeWordListener } from './WakeWordListener';
import type { NewbornEvent } from '../types/newbornTracker';

type ChatRole = 'system' | 'user' | 'assistant';
type ChatMessage = {
    role: ChatRole;
    content: string;
};

interface CancellableError extends Error {
    cancelled?: boolean;
}

interface StructuredVoiceLoggerOptions {
    apiKey: string;
    schema: string;
    listener: WakeWordListener;
    maxContextEvents?: number;
    maxRecentRequests?: number;
    onStructuredData?: (data: NewbornEvent) => void;
    onError?: (error: Error) => void;
    onDebug?: (event: any) => void;
    getRecentEvents?: (n: number) => NewbornEvent[];
    getRecentUtterances?: () => Array<{ text: string; timestamp: string }>;
    addUtterance?: (text: string, timestamp: Date) => void;
}

export class StructuredVoiceLogger {
    private openai: OpenAI;
    private schema: string;
    private listener: WakeWordListener;
    private textBuffer: string[];
    private maxContextEvents: number;
    private activeRequest: { cancelled: boolean } | null;
    private processTimeout: ReturnType<typeof setTimeout> | null;

    private onStructuredData?: StructuredVoiceLoggerOptions['onStructuredData'];
    private onError?: StructuredVoiceLoggerOptions['onError'];
    private onDebug?: StructuredVoiceLoggerOptions['onDebug'];
    private getRecentEvents?: StructuredVoiceLoggerOptions['getRecentEvents'];
    private getRecentUtterances?: StructuredVoiceLoggerOptions['getRecentUtterances'];
    private addUtterance?: StructuredVoiceLoggerOptions['addUtterance'];

    constructor(options: StructuredVoiceLoggerOptions) {
        const configuration = {
            apiKey: options.apiKey,
            dangerouslyAllowBrowser: true
        };

        this.openai = new OpenAI(configuration);
        this.schema = options.schema;
        this.listener = options.listener;
        this.textBuffer = [];
        this.maxContextEvents = options.maxContextEvents || 10;
        
        this.onStructuredData = options.onStructuredData;
        this.onError = options.onError;
        this.onDebug = options.onDebug;
        this.getRecentEvents = options.getRecentEvents;
        this.getRecentUtterances = options.getRecentUtterances;
        this.addUtterance = options.addUtterance;

        this.activeRequest = null;
        this.processTimeout = null;

        // Set up the utterance handler
        if ('onUtterance' in this.listener) {
            (this.listener as any).onUtterance = (utterance: { text: string }) => {
                this.textBuffer.push(utterance.text);
                this.debouncedProcess();
            };
        }
    }

    private debouncedProcess() {
        if (this.processTimeout) {
            clearTimeout(this.processTimeout);
        }

        this.processTimeout = setTimeout(() => {
            this.tryProcessBuffer();
        }, 150);
    }

    private async tryProcessBuffer() {
        if (this.textBuffer.length === 0) return;

        try {
            // Cancel previous request if it exists
            if (this.activeRequest) {
                this.activeRequest.cancelled = true;
            }

            const text = this.textBuffer.join(' ');
            const result = await this.processUtterance(text, new Date());
            
            if (result) {
                this.textBuffer = [];
            }
        } catch (error) {
            if (error instanceof Error && !(error as CancellableError).cancelled) {
                this.onError?.(error);
            }
        }
    }

    private async processUtterance(text: string, timestamp: Date) {
        const request = { cancelled: false };
        this.activeRequest = request;

        try {
            // Get fresh recent events right before generating the prompt
            const messages: ChatMessage[] = [
                { role: 'system', content: this.generateSystemPrompt() }
            ];

            // Get fresh events again for the context
            const recentEvents = this.getRecentEvents?.(this.maxContextEvents) || [];
            if (recentEvents.length > 0) {
                messages.push({
                    role: 'user',
                    content: `Recent events (most recent first):\n${JSON.stringify(recentEvents, null, 2)}`
                });
            }

            // Get recent utterances
            const recentUtterances = this.getRecentUtterances?.() || [];
            
            // Format the final user message with both history and current utterance
            const userMessage = [
                recentUtterances.length > 0 ? '## Recent Messages\n' + 
                    recentUtterances.map(u => 
                        `[${new Date(u.timestamp).toLocaleTimeString()}] ${u.text}`
                    ).join('\n') : '',
                '\n## Current Message\n' +
                `Time: ${this.formatDate(timestamp)}\n` +
                `Utterance: ${text}`
            ].filter(Boolean).join('\n');

            messages.push({ 
                role: 'user',
                content: userMessage
            });

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages,
                temperature: 0.1,
                max_tokens: 1000
            });

            if (request.cancelled) {
                const error = new Error('Request cancelled') as CancellableError;
                error.cancelled = true;
                throw error;
            }

            this.onDebug?.({
                type: 'completion',
                timestamp: new Date(),
                request: {
                    messages,
                    model: "gpt-4o",
                    temperature: 0.1,
                    max_tokens: 1000
                },
                response: completion
            });

            const result = this.parseResponse(completion.choices[0].message?.content || '');
            
            // If we got a valid JSON response, add this to utterance history
            if (result && this.addUtterance) {
                this.addUtterance(text, timestamp);
            }
            
            this.onStructuredData?.(result);
            return result;

        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Unknown error occurred');
        } finally {
            if (this.activeRequest === request) {
                this.activeRequest = null;
            }
        }
    }

    private generateSystemPrompt(): string {
        return `You are a structured data parser that converts transcribed speech into JSON objects.
        
        The data should conform to this TypeScript interface:
        ${this.schema}

        Important Context:
        - You are receiving transcribed speech, not direct text input
        - Speech recognition may introduce transcription errors
        - Interpret utterances flexibly, accounting for common speech-to-text mistakes
        - Look for key information even if the exact wording is imperfect
        - Numbers and proper nouns are especially prone to transcription errors

        Instructions:
        1. Listen to the utterance and determine if it's:
           a) Creating a new event (NEVER include an 'id' field)
           b) Modifying a specific existing event (MUST include the existing event's 'id')
           c) Adjusting event timing

        2. Timestamp handling:
           - 'occurredAt': When the event actually happened (required)
           - 'endedAt': When the event ended (optional, for duration-based events)
           - Default to current timestamp if no time is specified
           - **You can update 'occurredAt' and 'endedAt' if the user specifies a change**
           - When modifying times, you can reference recent events for context

        3. Notes field handling:
           - Only include notes when the user explicitly provides additional information
           - Notes should contain user observations, not system actions
           - Don't repeat information that's already captured in other fields

        4. For new events (NEVER include an 'id' field):
           - Create a complete object with all required fields
           - Set 'occurredAt' based on context or current time

        5. For modifications (MUST include the existing event's 'id'):
           - Only include an 'id' when explicitly modifying an existing event
           - Reference events by their temporal position ("the last feeding", "previous diaper change")
           - ALWAYS emit complete snapshots with ALL fields, even when only changing one field

        6. Important rules:
           - NEVER include an 'id' field for new events
           - ALWAYS include an 'id' field when modifying existing events
           - ALWAYS emit complete objects with ALL fields
           - NEVER emit partial updates or diffs
           - Only generate data that is explicitly mentioned or can be confidently inferred
           - Don't reuse IDs from recent events unless explicitly modifying them
           - Consider the context from recent requests when interpreting the current request
           - Be flexible with transcription errors, focus on intent over exact wording
           - If the user's request appear to be truncated, respond with a plain text message stating "truncated"`;
    }

    private parseResponse(response: string): NewbornEvent {
        try {
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                            response.match(/```([\s\S]*?)```/);
            
            const jsonStr = jsonMatch ? jsonMatch[1] ?? response : response;
            return JSON5.parse(jsonStr);

        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to parse LLM response: ${error.message}\nResponse was: ${response}`);
            }
            throw new Error('Failed to parse LLM response');
        }
    }

    private formatDate(date: Date): string {
        return format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", { 
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
        });
    }

    start() {
        this.listener.setListening(true);
    }

    stop() {
        this.listener.setListening(false);
    }

    get isListening() {
        return this.listener.listening;
    }
} 