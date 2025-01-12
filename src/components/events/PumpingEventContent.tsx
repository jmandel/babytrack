import React from 'react';
import { PumpingEvent } from '@/types/newbornTracker';

interface PumpingEventContentProps {
    event: PumpingEvent;
}

export const PumpingEventContent: React.FC<PumpingEventContentProps> = ({ event }) => {
    const { details, notes, occurredAt, endedAt } = event;
    if (!details) return null;

    const { side, durationMinutes, amountMl, letdown, method } = details;
    const duration = endedAt
        ? Math.round((new Date(endedAt).getTime() - new Date(occurredAt).getTime()) / (1000 * 60))
        : durationMinutes;

    const rate = duration && duration > 0 ? Math.round((amountMl / duration) * 10) / 10 : undefined;

    return (
        <div className="mt-1 space-y-1">
            {/* Quick Overview */}
            <div className="text-sm font-medium text-gray-900">
                {amountMl}ml • {side.toLowerCase()} side • {duration}min
                {rate && ` • ${rate}ml/min`}
            </div>

            {/* Main Details */}
            <div className="border border-purple-200 rounded overflow-hidden">
                <div className="bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800 flex justify-between">
                    <span>Pumping Details</span>
                    <span>{amountMl}ml total</span>
                </div>
                <div className="px-2 py-0.5">
                    <div className="flex flex-wrap gap-1">
                        {method && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                                {method.toLowerCase().replace(/_/g, ' ')}
                            </span>
                        )}
                        {letdown && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full">
                                letdown
                            </span>
                        )}
                        <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                            {side.toLowerCase()} side
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="border border-purple-200 rounded overflow-hidden">
                <div className="bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800">
                    {duration}min • {rate}ml/min average
                </div>
            </div>

            {notes && <div className="text-xs italic text-gray-500">{notes}</div>}
        </div>
    );
}; 