// src/streaming-server.ts
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { StreamingPlaywrightService } from './services/streaming-playwright-service';

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store active browser sessions
const activeSessions = new Map<string, StreamingPlaywrightService>();

// Setup WebSocket server
wss.on('connection', async (ws: WebSocket) => {
  // Generate a unique session ID
  const sessionId = uuidv4();
  console.log(`New client connected: ${sessionId}`);
  
  // Add sessionId to WebSocket instance
  (ws as any).sessionId = sessionId;
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'chat',
    content: {
      text: 'Connected to browser automation server. Initializing browser...',
      sender: 'system',
      timestamp: Date.now()
    }
  }));
  
  // Initialize streaming browser service
  try {
    const browserService = new StreamingPlaywrightService();
    await browserService.initialize(sessionId, wss);
    
    // Store the session
    activeSessions.set(sessionId, browserService);
    
    // Send confirmation message
    ws.send(JSON.stringify({
      type: 'chat',
      content: {
        text: 'Browser initialized and streaming. Ready for interaction!',
        sender: 'system',
        timestamp: Date.now()
      }
    }));
    
  } catch (error) {
    console.error(`Failed to initialize browser for ${sessionId}:`, error);
    ws.send(JSON.stringify({
      type: 'chat',
      content: {
        text: `Error initializing browser: ${error instanceof Error ? error.message : String(error)}`,
        sender: 'system',
        timestamp: Date.now()
      }
    }));
  }
  
  // Handle incoming messages
  ws.on('message', async (message: string) => {
    try {
      console.log(`Raw message from ${sessionId}:`, message.toString());
      const data = JSON.parse(message.toString());
      console.log(`Parsed message from ${sessionId}:`, data);
      
      // Get the browser service for this session
      const browserService = activeSessions.get(sessionId);
      if (!browserService) {
        console.log(`No active session found for ID: ${sessionId}`);
        ws.send(JSON.stringify({
          type: 'chat',
          content: {
            text: 'Session not found or expired. Please reconnect.',
            sender: 'system',
            timestamp: Date.now()
          }
        }));
        return;
      }
      
      // Process the message based on type
      switch (data.type) {
        case 'click':
        case 'mousedown':
        case 'mouseup':
        case 'mousemove':
          await handleMouseEvent(browserService, data, ws);
          break;
          
        case 'keyPress':
        case 'keypress':
          await handleKeyEvent(browserService, data, ws);
          break;
          
        case 'chat':
          await handleChatMessage(browserService, data.content, ws);
          break;
          
        default:
          console.warn(`Unknown message type: ${data.type}`);
          ws.send(JSON.stringify({
            type: 'chat',
            content: {
              text: `Unknown command: ${data.type}`,
              sender: 'system',
              timestamp: Date.now()
            }
          }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'chat',
        content: {
          text: `Error processing message: ${error instanceof Error ? error.message : String(error)}`,
          sender: 'system',
          timestamp: Date.now()
        }
      }));
    }
  });
  
  // Handle WebSocket close
  ws.on('close', async () => {
    console.log(`Client disconnected: ${sessionId}`);
    await cleanupSession(sessionId);
  });
  
  // Handle WebSocket errors
  ws.on('error', async (error) => {
    console.error(`WebSocket error for ${sessionId}:`, error);
    await cleanupSession(sessionId);
  });
});

// Handle mouse events
async function handleMouseEvent(
  browserService: StreamingPlaywrightService, 
  data: any, 
  ws: WebSocket
): Promise<void> {
  try {
    if (typeof data.x !== 'number' || typeof data.y !== 'number') {
      throw new Error('Missing coordinates');
    }
    
    // IMPORTANT: Log the raw coordinates received from the client
    console.log(`Raw mouse event coordinates: (${data.x}, ${data.y})`);
    
    // Now we'll convert these to appropriate coordinates for the browser viewport
    // We'll let the StreamingPlaywrightService handle the scaling

    switch (data.type) {
      case 'click':
        await browserService.click(data.x, data.y);
        break;
      case 'mousedown':
        await browserService.mouseDown(data.x, data.y);
        break;
      case 'mouseup':
        await browserService.mouseUp(data.x, data.y);
        break;
      case 'mousemove':
        await browserService.mouseMove(data.x, data.y);
        break;
    }
    
    // No need to send confirmation or screenshots - the streaming service already handles this
  } catch (error) {
    console.error(`Error handling mouse event:`, error);
    ws.send(JSON.stringify({
      type: 'chat',
      content: {
        text: `Error with ${data.type}: ${error instanceof Error ? error.message : String(error)}`,
        sender: 'system',
        timestamp: Date.now()
      }
    }));
  }
}

// Handle keyboard events
async function handleKeyEvent(
  browserService: StreamingPlaywrightService, 
  data: any, 
  ws: WebSocket
): Promise<void> {
  try {
    if (!data.key) {
      throw new Error('Missing key value');
    }
    
    await browserService.pressKey(data.key);
    
    // No need to send confirmation or screenshots - the streaming service already handles this
  } catch (error) {
    console.error(`Error handling key event:`, error);
    ws.send(JSON.stringify({
      type: 'chat',
      content: {
        text: `Error pressing key: ${error instanceof Error ? error.message : String(error)}`,
        sender: 'system',
        timestamp: Date.now()
      }
    }));
  }
}

// Handle chat messages
async function handleChatMessage(
  browserService: StreamingPlaywrightService, 
  chatMessage: any, 
  ws: WebSocket
): Promise<void> {
  console.log('Chat message:', chatMessage);
  
  // Check if the message is a navigation command
  const navigateRegex = /^(go to|navigate to|open) (.+)$/i;
  const navigateMatch = chatMessage.text.match(navigateRegex);
  
  if (navigateMatch) {
    try {
      const url = navigateMatch[2].startsWith('http') 
        ? navigateMatch[2] 
        : `https://${navigateMatch[2]}`;
      
      // Send response
      ws.send(JSON.stringify({
        type: 'chat',
        content: {
          text: `Navigating to ${url}...`,
          sender: 'system',
          timestamp: Date.now()
        }
      }));
      
      // Navigate using browser service
      await browserService.navigate(url);
      
    } catch (error) {
      console.error(`Error navigating:`, error);
      ws.send(JSON.stringify({
        type: 'chat',
        content: {
          text: `Error navigating: ${error instanceof Error ? error.message : String(error)}`,
          sender: 'system',
          timestamp: Date.now()
        }
      }));
    }
    
    return;
  }
  
  // Process as a regular chat message
  ws.send(JSON.stringify({
    type: 'chat',
    content: {
      text: `Received your message: "${chatMessage.text}"`,
      sender: 'system',
      timestamp: Date.now()
    }
  }));
}

// Clean up browser session
async function cleanupSession(sessionId: string): Promise<void> {
  console.log(`Cleaning up session ${sessionId}`);
  const browserService = activeSessions.get(sessionId);
  
  if (browserService) {
    try {
      await browserService.close();
      activeSessions.delete(sessionId);
      console.log(`Session ${sessionId} cleaned up successfully`);
    } catch (error) {
      console.error(`Error cleaning up session ${sessionId}:`, error);
    }
  }
}

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    activeSessions: activeSessions.size
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Streaming server running on port ${PORT}`);
});