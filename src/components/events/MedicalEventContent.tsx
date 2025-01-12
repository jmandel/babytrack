import React from 'react';
import { 
    MedicalEvent, 
    MedicalEventType,
    MedicationEvent,
    TemperatureEvent,
    SymptomEvent,
    TreatmentEvent,
    VaccinationEvent
} from '@/types/newbornTracker';

interface MedicalEventContentProps {
    event: MedicalEvent;
}

export const MedicalEventContent: React.FC<MedicalEventContentProps> = ({ event }) => {
    const { subType, details, notes } = event;

    const renderMedicationDetails = (details: MedicationEvent['details']) => {
        const { medication, dosageAmount, dosageUnit, route } = details;
        return (
            <div className="border border-blue-200 rounded overflow-hidden">
                <div className="bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 flex justify-between">
                    <span>Medication Details</span>
                </div>
                <div className="px-2 py-1 text-xs space-y-1">
                    <div className="flex justify-between items-baseline">
                        <span className="font-medium">{medication}</span>
                        <span className="text-blue-600">{dosageAmount} {dosageUnit}</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full capitalize">
                            {route}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    const renderTemperatureDetails = (details: TemperatureEvent['details']) => {
        const { temperature, unit, method } = details;
        return (
            <div className="border border-red-200 rounded overflow-hidden">
                <div className="bg-red-50 px-2 py-1 text-xs font-medium text-red-800 flex justify-between">
                    <span>Temperature Reading</span>
                    <span className="text-red-600">{temperature}°{unit}</span>
                </div>
                <div className="px-2 py-1">
                    <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-700 rounded-full capitalize">
                        {method} method
                    </span>
                </div>
            </div>
        );
    };

    const renderSymptomDetails = (details: SymptomEvent['details']) => {
        const { symptom, severity, duration } = details;
        return (
            <div className="border border-yellow-200 rounded overflow-hidden">
                <div className="bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 flex justify-between">
                    <span>Symptom</span>
                    <span className="text-yellow-600 capitalize">{severity}</span>
                </div>
                <div className="px-2 py-1 text-xs space-y-1">
                    <div className="font-medium">{symptom}</div>
                    {duration && (
                        <div className="text-gray-600">
                            Duration: {duration.value} {duration.unit}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderTreatmentDetails = (details: TreatmentEvent['details']) => {
        const { treatment, provider, followUp } = details;
        return (
            <div className="border border-green-200 rounded overflow-hidden">
                <div className="bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
                    Treatment Details
                </div>
                <div className="px-2 py-1 text-xs space-y-1">
                    <div className="font-medium">{treatment}</div>
                    {provider && (
                        <div className="text-gray-600">Provider: {provider}</div>
                    )}
                    {followUp && (
                        <div className="text-gray-600">Follow-up: {followUp}</div>
                    )}
                </div>
            </div>
        );
    };

    const renderVaccinationDetails = (details: VaccinationEvent['details']) => {
        const { vaccine, dose, site, provider } = details;
        return (
            <div className="border border-purple-200 rounded overflow-hidden">
                <div className="bg-purple-50 px-2 py-1 text-xs font-medium text-purple-800 flex justify-between">
                    <span>Vaccination</span>
                    <span className="text-purple-600">Dose {dose}</span>
                </div>
                <div className="px-2 py-1 text-xs space-y-1">
                    <div className="font-medium">{vaccine}</div>
                    <div className="flex flex-wrap gap-1">
                        {site && (
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                                {site}
                            </span>
                        )}
                        {provider && (
                            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                                {provider}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderDetails = () => {
        if (!details) return null;
        
        switch (subType) {
            case MedicalEventType.Medication:
                return renderMedicationDetails(details as MedicationEvent['details']);
            case MedicalEventType.Temperature:
                return renderTemperatureDetails(details as TemperatureEvent['details']);
            case MedicalEventType.Symptom:
                return renderSymptomDetails(details as SymptomEvent['details']);
            case MedicalEventType.Treatment:
                return renderTreatmentDetails(details as TreatmentEvent['details']);
            case MedicalEventType.Vaccination:
                return renderVaccinationDetails(details as VaccinationEvent['details']);
            default:
                return (
                    <div className="text-xs text-gray-600">
                        <pre className="bg-gray-50 p-2 rounded">
                            {JSON.stringify(details, null, 2)}
                        </pre>
                    </div>
                );
        }
    };

    return (
        <div className="mt-1 space-y-2">
            {renderDetails()}
            {notes && <div className="text-xs italic text-gray-500">{notes}</div>}
        </div>
    );
}; 