import React from 'react';
import { DiaperEvent } from '@/types/newbornTracker';

interface DiaperEventContentProps {
    event: DiaperEvent;
}

export const DiaperEventContent: React.FC<DiaperEventContentProps> = ({ event }) => {
    const { details, notes } = event;
    if (!details) return null;

    const { urine, stool, condition } = details;

    // Generate a quick overview
    const summary = [
        urine && `Wet (${urine.volume})`,
        stool && `BM (${stool.volume || 'undefined'})`,
        condition?.rash && `Rash (${condition.rash.severity})`,
        condition?.leakage && 'Leak'
    ].filter(Boolean).join(' + ');

    return (
        <div className="mt-1 space-y-1">
            {/* Quick Overview */}
            <div className="text-sm font-medium text-gray-900">
                {summary}
            </div>

            {/* Urine */}
            {urine && (
                <div className="border border-yellow-200 rounded overflow-hidden">
                    <div className="bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-800 flex justify-between">
                        <span>Urine</span>
                        <span>{urine.volume} volume</span>
                    </div>
                </div>
            )}

            {/* Stool */}
            {stool && (
                <div className="border border-amber-200 rounded overflow-hidden">
                    <div className="bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 flex justify-between">
                        <span>Stool</span>
                        {stool.volume && <span>{stool.volume} volume</span>}
                    </div>
                </div>
            )}

            {/* Condition */}
            {condition && (
                <>
                    {condition.rash && (
                        <div className="border border-red-200 rounded overflow-hidden">
                            <div className="bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 flex justify-between">
                                <span>Diaper Rash</span>
                                <span>{condition.rash.severity} severity</span>
                            </div>
                            {condition.rash.location.length > 0 && (
                                <div className="px-2 py-0.5 text-xs">
                                    <div className="flex flex-wrap gap-1">
                                        {condition.rash.location.map((loc: string, i: number) => (
                                            <span
                                                key={i}
                                                className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded-full"
                                            >
                                                {loc}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {condition.leakage && (
                        <div className="border border-red-200 rounded overflow-hidden">
                            <div className="bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                                Leakage occurred
                            </div>
                        </div>
                    )}
                </>
            )}

            {notes && <div className="text-xs italic text-gray-500">{notes}</div>}
        </div>
    );
}; 