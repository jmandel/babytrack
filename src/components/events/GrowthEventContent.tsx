import React from 'react';
import { GrowthEvent } from '@/types/newbornTracker';

interface GrowthEventContentProps {
    event: GrowthEvent;
}

export const GrowthEventContent: React.FC<GrowthEventContentProps> = ({ event }) => {
    const { details, notes } = event;
    if (!details) return null;

    const { measurements } = details;

    return (
        <div className="mt-1 space-y-1">
            {measurements?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {measurements.map((m: any, i: number) => (
                        <span key={i} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">
                            {m.type.toLowerCase().replace(/_/g, ' ')}: {m.value}{m.unit}
                        </span>
                    ))}
                </div>
            )}
            {notes && <div className="text-xs italic text-gray-500">{notes}</div>}
        </div>
    );
}; 