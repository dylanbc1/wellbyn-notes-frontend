# Notes Frontend

A React-based web application for audio transcription with a clean and intuitive user interface.

## Features

- Record audio directly in the browser
- Upload audio files from your device
- View transcription results in real-time
- Browse transcription history
- Delete old transcriptions
- Responsive design for desktop and mobile devices

## Requirements

- Node.js 18 or higher
- npm (comes with Node.js)
- Notes Backend running at http://localhost:8000

## Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env if your backend is at a different URL
```

## Configuration

The frontend uses environment variables to connect to the backend. Create a `.env` file in the root directory:

```env
# For local development
VITE_API_URL=http://localhost:8000

# For production (update with your backend URL)
# VITE_API_URL=https://api.tudominio.com
```

**Important:**
- The `.env` file is already in `.gitignore` and won't be committed
- For local development, use `http://localhost:8000` (default)
- For production, update `VITE_API_URL` with your deployed backend URL
- After changing `.env`, restart the development server

## Usage

### Development Mode

```bash
npm run dev
```

The application will be available at http://localhost:3000

### Production Build

```bash
# Build the application
npm run build

# Preview the build
npm run preview

# Or serve with a static server
npm run start
```

## Project Structure

```
notes-frontend/
├── src/
│   ├── components/      # React components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API communication
│   ├── types/          # TypeScript type definitions
│   ├── App.tsx         # Main application component
│   └── main.tsx        # Application entry point
├── public/             # Static assets
└── package.json        # Project dependencies
```

## Technology Stack

- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API requests
- **React Icons** - Icon library

## Browser Compatibility

- Chrome/Edge 90+ (Recommended for audio recording)
- Firefox 88+
- Safari 14+

Note: Audio recording requires HTTPS in production environments.

## Supported Audio Formats

- MP3 (audio/mpeg)
- WAV (audio/wav)
- M4A (audio/m4a)
- OGG (audio/ogg)
- FLAC (audio/flac)
- WEBM (audio/webm)

Maximum file size: 25MB

## License

MIT License
