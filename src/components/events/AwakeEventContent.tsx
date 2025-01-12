import React from 'react';
import { AwakeEvent } from '@/types/newbornTracker';

interface AwakeEventContentProps {
    event: AwakeEvent;
}

export const AwakeEventContent: React.FC<AwakeEventContentProps> = ({ event }) => {
    const { details, notes, occurredAt, endedAt } = event;
    if (!details) return null;

    const { activity, mood } = details;

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
            {activity && (
                <div className="font-medium text-yellow-600">Activity: {activity}</div>
            )}
            {mood && (
                <div className="text-sm">
                    Mood: <span className="font-semibold">{mood}</span>
                </div>
            )}
            {notes && <div className="text-xs italic text-gray-500">{notes}</div>}
        </div>
    );
}; 