# Baby Logger

A voice-controlled baby tracking application that helps parents log and analyze their baby's daily activities, including feedings, diapers, sleep, and more.

## Features

- Voice-controlled logging with wake word detection ("hey baby")
- Support for multiple event types:
  - Feeding (bottle, nursing, solids)
  - Pumping
  - Diaper changes
  - Sleep/wake cycles
  - Medical events
  - Growth measurements
  - Milestones
- Real-time event visualization
- Interactive analysis of patterns and trends
- Debug panel for troubleshooting

## Prerequisites

- Node.js 18+ or Bun 1.0+
- OpenAI API key for voice processing

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/babylogger.git
   cd babylogger
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Create a `.env` file in the root directory and add your OpenAI API key:
   ```
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   ```

## Development

Start the development server:
```bash
bun dev
```

The application will be available at `http://localhost:3000`.

## Usage

1. Click "Start Listening" to activate voice recognition
2. Say "hey baby" to wake up the logger
3. Speak your event (e.g., "bottle feeding 60ml of formula")
4. Say "sleep" to put the logger back to sleep
5. Use the analysis panel to ask questions about patterns

## Voice Commands

Examples of voice commands:
- "Bottle feeding 60ml of formula"
- "Nursing on left side for 15 minutes"
- "Wet diaper, medium volume"
- "Started sleeping in the crib"
- "Woke up, happy mood"
- "Temperature 98.6 Fahrenheit"
- "Weight 4.2 kilograms"
- "First smile milestone"

## Building for Production

Build the application:
```bash
bun run build
```

Preview the production build:
```bash
bun run preview
```

## License

MIT