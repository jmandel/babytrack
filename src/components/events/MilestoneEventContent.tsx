import React from 'react';
import { MilestoneEvent } from '@/types/newbornTracker';

interface MilestoneEventContentProps {
    event: MilestoneEvent;
}

export const MilestoneEventContent: React.FC<MilestoneEventContentProps> = ({ event }) => {
    const { details, notes } = event;
    if (!details) return null;

    const { milestone, category } = details;

    return (
        <div className="mt-1 space-y-1">
            <div className="font-medium text-purple-600">{milestone}</div>
            {category && (
                <div className="text-xs text-purple-500">Category: {category}</div>
            )}
            {notes && <div className="text-xs italic text-gray-500">{notes}</div>}
        </div>
    );
}; 