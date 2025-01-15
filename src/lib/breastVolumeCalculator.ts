import { NewbornEvent } from '@/types/newbornTracker';
import _ from 'lodash';

interface BreastVolumeParams {
  k: number;
  maxCapacity: number;
  timeToMax: number;
  scaleFactor: number;
}

function getCapacity(postpartumDays: number, params: BreastVolumeParams): number {
  return params.maxCapacity * (1 - Math.exp(-postpartumDays / params.timeToMax));
}

function getCurrentVolume(timeSinceEmpty: number, capacity: number, k: number, scaleFactor: number): number {
  return scaleFactor * capacity * (1 - Math.exp(-k * timeSinceEmpty));
}

interface ErrorResult {
  totalRmse: number;
  hourlyRmse: Array<{
    hour: number;
    rmse: number | null;
    count: number;
  }>;
}

function computeError(events: NewbornEvent[], params: BreastVolumeParams, earliestEver: number): ErrorResult {
  const hourlyErrors = Array(24).fill(null).map(() => ({ sum: 0, count: 0 }));
  let totalMse = 0;
  let totalCount = 0;
  
  events.forEach((event, i) => {
    if (event.eventType !== 'PUMPING' || !event.details?.amountMl) return;
    
    // Find time since last emptying event
    let lastEmptyTime = i > 0 ? new Date(events[i-1].occurredAt).getTime() : new Date(events[0].occurredAt).getTime();
    let eventTime = new Date(event.occurredAt).getTime();
    let timeSinceEmptyHours = (eventTime - lastEmptyTime) / (1000 * 60 * 60);
    
    // Calculate predicted volume
    const postpartumDays = (eventTime - earliestEver) / (1000 * 60 * 60 * 24);
    const capacity = getCapacity(postpartumDays, params);
    const predicted = getCurrentVolume(timeSinceEmptyHours, capacity, params.k, params.scaleFactor);
    
    // Add to overall MSE
    const error = predicted - event.details.amountMl;
    totalMse += error * error;
    totalCount++;
    
    // Track hourly errors
    const hour = new Date(event.occurredAt).getHours();
    hourlyErrors[hour].sum += error * error;
    hourlyErrors[hour].count++;
  });
  
  // Calculate RMSE by hour
  const hourlyRmse = hourlyErrors.map((h, i) => ({
    hour: i,
    rmse: h.count > 0 ? Math.sqrt(h.sum / h.count) : null,
    count: h.count
  }));
  
  return {
    totalRmse: Math.sqrt(totalMse / totalCount),
    hourlyRmse
  };
}

export function calculateCurrentVolume(events: NewbornEvent[]): number {
  // Parameter ranges for search
  const paramRanges = {
    k: _.range(0.15, 0.31, 0.05),      // 0.15 to 0.3 step 0.05
    maxCapacity: _.range(40, 91, 10),   // 40 to 90 step 10 - physiological storage
    timeToMax: _.range(14, 29, 7),      // 14 to 28 days
    scaleFactor: _.range(1.5, 3.1, 0.5) // 1.5 to 3.0 step 0.5
  };

  // Filter and sort relevant events
  const allBreastEvents = _.chain(events)
    .filter(e => 
      (e.eventType === 'PUMPING') ||
      (e.eventType === 'FEEDING' && e.subType === 'NURSING')
    )
    .sortBy(e => new Date(e.occurredAt).getTime())
    .value();

  if (_.isEmpty(allBreastEvents)) {
    return 0;
  }

  // Keep only last 5 days of data for parameter search
  const latestTs = new Date(allBreastEvents[allBreastEvents.length - 1].occurredAt).getTime();
  const cutoffTime = latestTs - 5 * 24 * 60 * 60 * 1000;
  const recentEvents = allBreastEvents.filter(e => new Date(e.occurredAt).getTime() >= cutoffTime);

  // Get day 0 for postpartum calculations
  const earliestEver = new Date(allBreastEvents[0].occurredAt).getTime();

  // Find best parameters
  let bestParams: BreastVolumeParams | null = null;
  let bestError = Infinity;

  for (const k of paramRanges.k) {
    for (const maxCapacity of paramRanges.maxCapacity) {
      for (const timeToMax of paramRanges.timeToMax) {
        for (const scaleFactor of paramRanges.scaleFactor) {
          const params = { k, maxCapacity, timeToMax, scaleFactor };
          const { totalRmse } = computeError(recentEvents, params, earliestEver);
          
          if (totalRmse < bestError) {
            bestError = totalRmse;
            bestParams = params;
          }
        }
      }
    }
  }

  if (!bestParams) {
    return 0;
  }

  // Calculate current volume using best parameters
  const now = Date.now();
  const postpartumDays = (now - earliestEver) / (1000 * 60 * 60 * 24);
  const lastEvent = allBreastEvents[allBreastEvents.length - 1];
  const timeSinceLastEvent = (now - new Date(lastEvent.occurredAt).getTime()) / (1000 * 60 * 60);
  
  const currentCapacity = getCapacity(postpartumDays, bestParams);
  const currentVolume = getCurrentVolume(
    timeSinceLastEvent,
    currentCapacity,
    bestParams.k,
    bestParams.scaleFactor
  );

  return Math.round(currentVolume * 100) / 100;
} 