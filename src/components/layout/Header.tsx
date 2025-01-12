import React from 'react';

interface HeaderProps {
    onToggleDebug: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleDebug }) => {
    return (
        <header className="bg-white shadow">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Baby Logger
                    </h1>
                    <button
                        onClick={onToggleDebug}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                    >
                        Toggle Debug
                    </button>
                </div>
            </div>
        </header>
    );
}; 