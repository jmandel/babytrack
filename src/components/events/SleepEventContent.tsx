import React from 'react';
import { SleepEvent } from '@/types/newbornTracker';

interface SleepEventContentProps {
    event: SleepEvent;
}

export const SleepEventContent: React.FC<SleepEventContentProps> = ({ event }) => {
    const { details, notes, occurredAt, endedAt } = event;
    if (!details) return null;

    const { sleepLocation } = details;

    const duration = endedAt
        ? Math.round((new Date(endedAt).getTime() - new Date(occurredAt).getTime()) / (1000 * 60))
        : undefined;

    return (
        <div className="mt-1 space-y-1">
            {duration && (
                <div className="text-sm font-medium">
                    Duration: {duration} minutes
                </div>
            )}
            {sleepLocation && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {sleepLocation}
                </span>
            )}
            {notes && <div className="text-xs italic text-gray-500">{notes}</div>}
        </div>
    );
}; 