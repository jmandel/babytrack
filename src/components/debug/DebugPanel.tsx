import React, { useState, useEffect } from 'react';

interface DebugEvent {
    timestamp: string;
    type: string;
    data: any;
}

export const DebugPanel: React.FC = () => {
    const [events, setEvents] = useState<DebugEvent[]>([]);
    const [filter, setFilter] = useState<string>('');

    useEffect(() => {
        const originalDebug = console.debug;
        console.debug = (...args) => {
            const event: DebugEvent = {
                timestamp: new Date().toISOString(),
                type: args[0] || 'debug',
                data: args.slice(1),
            };
            setEvents(prev => [event, ...prev].slice(0, 100));
            originalDebug.apply(console, args);
        };

        return () => {
            console.debug = originalDebug;
        };
    }, []);

    const filteredEvents = events.filter(event =>
        filter ? JSON.stringify(event).toLowerCase().includes(filter.toLowerCase()) : true
    );

    return (
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Debug Panel</h3>
                <input
                    type="text"
                    placeholder="Filter events..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-3 py-1 text-sm border rounded"
                />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredEvents.map((event, index) => (
                    <div
                        key={index}
                        className="text-xs p-2 bg-gray-50 rounded font-mono whitespace-pre-wrap"
                    >
                        <div className="text-gray-500">
                            {new Date(event.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="font-semibold text-blue-600">{event.type}</div>
                        <div className="mt-1">
                            {JSON.stringify(event.data, null, 2)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}; 