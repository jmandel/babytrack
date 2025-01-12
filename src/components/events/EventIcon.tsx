import React from 'react';
import { Baby, Droplet, Moon, Sun, Stethoscope, Ruler, Star, Timer } from 'lucide-react';
import { EventType } from '../../types/newbornTracker';

interface EventIconProps {
    type: EventType;
    className?: string;
}

export const EventIcon: React.FC<EventIconProps> = ({ type, className = "w-4 h-4" }) => {
    switch (type) {
        case EventType.Feeding:
            return <Baby className={className} />;
        case EventType.Diaper:
            return <Droplet className={className} />;
        case EventType.Sleep:
            return <Moon className={className} />;
        case EventType.Awake:
            return <Sun className={className} />;
        case EventType.Medical:
            return <Stethoscope className={className} />;
        case EventType.Growth:
            return <Ruler className={className} />;
        case EventType.Milestone:
            return <Star className={className} />;
        default:
            return <Timer className={className} />;
    }
}; 