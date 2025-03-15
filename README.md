# Browser Automation Agent
A web-based browser automation agent that allows users to control and automate browser actions through a chat interface.

## Features

- Chat interface for sending commands to the browser
- Real-time browser automation using Playwright
- Manual browser control takeover option
- Split view with chat on the left and browser view on the right

## Project Structure

```
.
├── frontend/          # React frontend application
└── backend/          # Node.js + Express + Playwright backend
```

## Setup Instructions

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend will be available at http://localhost:3000

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install chromium
```

4. Start the development server:
```bash
npm run dev
```

The backend will be available at http://localhost:3001

## Usage

1. Start both the frontend and backend servers
2. Open http://localhost:3000 in your browser
3. Use the chat interface to send commands to the browser
4. Click the "Take Control" button to manually control the browser

## Available Commands

- `goto [url]`: Navigate to a specific URL
- More commands coming soon...
