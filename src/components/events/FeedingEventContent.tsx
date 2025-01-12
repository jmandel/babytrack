import React from 'react';
import { FeedingEvent, FeedingType } from '@/types/newbornTracker';

interface FeedingEventContentProps {
    event: FeedingEvent;
}

export const FeedingEventContent: React.FC<FeedingEventContentProps> = ({ event }) => {
    const { subType, details, notes, occurredAt, endedAt } = event;
    if (!details) return null;

    const duration = endedAt
        ? Math.round((new Date(endedAt).getTime() - new Date(occurredAt).getTime()) / (1000 * 60))
        : undefined;

    const renderFeedingDetails = () => {
        if (!details) return null;

        switch (subType) {
            case FeedingType.Bottle: {
                const { contents = [], amountMlOffered, amountMlConsumed } = details;
                const totalOffered = contents.reduce((sum, c: any) => sum + c.amountMl, 0);
                const percentConsumed = amountMlConsumed !== undefined 
                    ? Math.round((amountMlConsumed / amountMlOffered) * 100)
                    : undefined;

                return (
                    <div className="space-y-1">
                        {/* Quick Overview */}
                        <div className="text-sm font-medium text-gray-900">
                            Bottle: {amountMlConsumed ?? amountMlOffered}ml 
                            {percentConsumed !== undefined && ` (${percentConsumed}% consumed)`}
                            {duration && ` • ${duration}min`}
                        </div>

                        <div className="border border-blue-200 rounded overflow-hidden">
                            <div className="bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 flex justify-between">
                                <span>Contents</span>
                                <span>{amountMlOffered}ml total</span>
                            </div>
                            {contents.length > 0 && (
                                <div className="px-2 py-0.5">
                                    {contents.map((content: any, i: number) => (
                                        <div key={i} className="flex items-baseline justify-between text-xs">
                                            <span>{content.type.toLowerCase().replace(/_/g, ' ')}</span>
                                            <span className="font-medium">{content.amountMl}ml</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {amountMlConsumed !== undefined && (
                            <div className="border border-green-200 rounded overflow-hidden">
                                <div className="bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
                                    Consumption: {amountMlConsumed}ml ({percentConsumed}%)
                                    {duration && ` • ${Math.round(amountMlConsumed / duration)}ml/min`}
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            case FeedingType.Nursing: {
                const { attempts = [] } = details;
                let totalNursingMinutes = 0;
                let totalLetdowns = 0;
                let totalGoodLatches = 0;
                
                attempts.forEach((a: any) => {
                    if (a.durationMinutes) totalNursingMinutes += a.durationMinutes;
                    if (a.letdown) totalLetdowns++;
                    if (a.goodLatch) totalGoodLatches++;
                });

                const leftAttempts = attempts.filter((a: any) => a.side === 'left');
                const rightAttempts = attempts.filter((a: any) => a.side === 'right');

                return (
                    <div className="space-y-1">
                        {/* Quick Overview */}
                        <div className="text-sm font-medium text-gray-900">
                            Nursed {attempts.length}x ({totalNursingMinutes}min total)
                            {totalLetdowns > 0 && ` • ${totalLetdowns} letdown${totalLetdowns > 1 ? 's' : ''}`}
                        </div>

                        {leftAttempts.length > 0 && (
                            <div className="border border-pink-200 rounded overflow-hidden">
                                <div className="bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-800">
                                    Left: {leftAttempts.length}x ({leftAttempts.reduce((sum, a: any) => sum + (a.durationMinutes || 0), 0)}min)
                                </div>
                            </div>
                        )}

                        {rightAttempts.length > 0 && (
                            <div className="border border-pink-200 rounded overflow-hidden">
                                <div className="bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-800">
                                    Right: {rightAttempts.length}x ({rightAttempts.reduce((sum, a: any) => sum + (a.durationMinutes || 0), 0)}min)
                                </div>
                            </div>
                        )}

                        <div className="border border-pink-200 rounded overflow-hidden">
                            <div className="bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-800">
                                {totalGoodLatches} good latch{totalGoodLatches !== 1 ? 'es' : ''} • {totalLetdowns} letdown{totalLetdowns !== 1 ? 's' : ''}
                            </div>
                        </div>
                    </div>
                );
            }

            case FeedingType.Solids: {
                const { consistency, foods = [], acceptance, amountOffered } = details;
                return (
                    <div className="space-y-1">
                        {/* Quick Overview */}
                        <div className="text-sm font-medium text-gray-900">
                            Solids: {foods.length} food{foods.length !== 1 ? 's' : ''} • 
                            {acceptance && ` ${acceptance} acceptance`}
                            {duration && ` • ${duration}min`}
                        </div>

                        <div className="border border-orange-200 rounded overflow-hidden">
                            <div className="bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-800">
                                {consistency && `${consistency.toLowerCase().replace(/_/g, ' ')} consistency`}
                                {amountOffered && ` • ${amountOffered} offered`}
                            </div>
                            {foods.length > 0 && (
                                <div className="px-2 py-0.5">
                                    <div className="flex flex-wrap gap-1">
                                        {foods.map((food: string, i: number) => (
                                            <span
                                                key={i}
                                                className="text-xs px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded-full"
                                            >
                                                {food}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };

    return (
        <div className="mt-1 space-y-1">
            {renderFeedingDetails()}
            {notes && <div className="text-xs italic text-gray-500">{notes}</div>}
        </div>
    );
}; 