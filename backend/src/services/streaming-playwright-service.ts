// src/services/streaming-playwright-service.ts
import { Browser, BrowserContext, Page, CDPSession, chromium } from 'playwright';
import { WebSocket, WebSocketServer } from 'ws';

export class StreamingPlaywrightService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private streamingClient: CDPSession | null = null;
  private isStreaming: boolean = false;
  private lastActivity: number = 0;
  private sessionId: string = '';
  private periodicFrameInterval: NodeJS.Timeout | null = null;
  private lastFrameTimestamp: number = 0;
  
  // Frame settings
  private readonly FRAME_INTERVAL = 1000; // Send frame every 1000ms when inactive
  
  constructor() {}
  
  async initialize(sessionId: string, wss: WebSocketServer): Promise<void> {
    try {
      this.sessionId = sessionId;
      this.lastActivity = Date.now();
      
      // Launch the browser
      this.browser = await chromium.launch({
        headless: true
      });
      
      // Create a new browser context
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      
      // Create a new page
      this.page = await this.context.newPage();
      
      // Navigate to a default page
      await this.page.goto('https://www.excalidraw.com');
      
      console.log('Playwright browser initialized');
      
      // Set up CDP session for streaming
      await this.setupScreencast(wss);
      
      // Start periodic frame sending
      this.startPeriodicFrames(wss);
      
      console.log('Screencast initialized');
    } catch (error) {
      console.error('Failed to initialize Playwright:', error);
      throw error;
    }
  }
  
  private async setupScreencast(wss: WebSocketServer): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    try {
      // Create CDP session
      this.streamingClient = await this.page.context().newCDPSession(this.page);
      
      // Start screencast
      await this.streamingClient.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 80,
        maxWidth: 1280,
        maxHeight: 720,
        everyNthFrame: 1
      });
      
      this.isStreaming = true;
      
      // Handle screencast frames
      this.streamingClient.on('Page.screencastFrame', async (frame) => {
        if (!this.isStreaming) return;
        
        const now = Date.now();
        this.lastFrameTimestamp = now;
        this.lastActivity = now;
        
        try {
          const ws = this.findWebSocketForSession(wss);
          if (!ws) return;
          
          const message = JSON.stringify({
            type: 'frame',
            data: frame.data,
            metadata: {
              timestamp: frame.metadata.timestamp,
              width: frame.metadata.deviceWidth,
              height: frame.metadata.deviceHeight
            }
          });
          
          ws.send(message);
          
          // Acknowledge the frame
          if (this.isStreaming && this.streamingClient) {
            try {
              await this.streamingClient.send('Page.screencastFrameAck', {
                sessionId: frame.sessionId
              });
            } catch (ackError) {
              console.log('Frame acknowledgment error - continuing stream');
            }
          }
        } catch (error) {
          console.error(`Frame processing error: ${error}`);
        }
      });
    } catch (error) {
      console.error('Failed to setup screencast:', error);
      throw error;
    }
  }
  
  private startPeriodicFrames(wss: WebSocketServer): void {
    this.periodicFrameInterval = setInterval(async () => {
      if (!this.isStreaming || !this.page || !this.streamingClient) return;
      
      const now = Date.now();
      // Only send periodic frame if no recent frames have been sent
      if (!this.lastFrameTimestamp || (now - this.lastFrameTimestamp) >= this.FRAME_INTERVAL) {
        try {
          const result = await this.streamingClient.send('Page.captureScreenshot', {
            format: 'jpeg',
            quality: 80
          });
          
          const ws = this.findWebSocketForSession(wss);
          if (!ws) return;
          
          console.log('Sending periodic frame');
          
          const message = JSON.stringify({
            type: 'frame',
            data: result.data,
            metadata: {
              timestamp: now,
              width: this.page.viewportSize()?.width,
              height: this.page.viewportSize()?.height
            }
          });
          
          ws.send(message);
          this.lastFrameTimestamp = now;
        } catch (error) {
          console.error('Periodic frame capture error:', error);
        }
      }
    }, this.FRAME_INTERVAL);
  }
  
  private findWebSocketForSession(wss: WebSocketServer): WebSocket | undefined {
    return Array.from(wss.clients).find((client: any) => 
      client.sessionId === this.sessionId && 
      client.readyState === WebSocket.OPEN
    );
  }
  
  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Playwright not initialized');
    }
    
    try {
      console.log(`PlaywrightService: Navigating to ${url}`);
      await this.page.goto(url);
      this.lastActivity = Date.now();
      console.log(`PlaywrightService: Successfully navigated to ${url}`);
    } catch (error) {
      console.error(`PlaywrightService: Failed to navigate to ${url}:`, error);
      throw error;
    }
  }
  
 // src/services/streaming-playwright-service.ts
// The fix focuses on the mouse coordinate handling

async click(x: number, y: number): Promise<void> {
  if (!this.page) {
    throw new Error('Playwright not initialized');
  }
  
  try {
    // Get the viewport size
    const viewportSize = this.page.viewportSize();
    if (!viewportSize) {
      throw new Error('Unable to get viewport size');
    }
    
    // IMPORTANT FIX: Check if x and y are already absolute or percentages
    // If values are between 0 and 1, treat as percentages, otherwise as absolute coordinates
    let absoluteX = x;
    let absoluteY = y;
    
    if (x <= 1 && y <= 1) {
      // Values are percentages (0-1), convert to absolute
      absoluteX = Math.floor(x * viewportSize.width);
      absoluteY = Math.floor(y * viewportSize.height);
    } else if (x > viewportSize.width || y > viewportSize.height) {
      // Values are too large, they might be scaled incorrectly
      // Attempt to normalize them (assuming they were calculated relative to 1280x720)
      console.log(`Warning: Received potentially invalid coordinates (${x}, ${y}), normalizing`);
      absoluteX = Math.min(x, viewportSize.width - 1);
      absoluteY = Math.min(y, viewportSize.height - 1);
    }
    
    console.log(`PlaywrightService: Clicking at coordinates (${absoluteX}, ${absoluteY})`);
    
    // Perform the click
    await this.page.mouse.click(absoluteX, absoluteY);
    this.lastActivity = Date.now();
    console.log(`PlaywrightService: Successfully clicked at (${absoluteX}, ${absoluteY})`);
  } catch (error) {
    console.error(`PlaywrightService: Failed to click at (${x}, ${y}):`, error);
    throw error;
  }
}

// Similar fixes for mouseDown, mouseUp, and mouseMove:

async mouseDown(x: number, y: number): Promise<void> {
  if (!this.page) {
    throw new Error('Playwright not initialized');
  }
  
  try {
    const viewportSize = this.page.viewportSize();
    if (!viewportSize) {
      throw new Error('Unable to get viewport size');
    }
    
    // Apply the same coordinate fix
    let absoluteX = x;
    let absoluteY = y;
    
    if (x <= 1 && y <= 1) {
      absoluteX = Math.floor(x * viewportSize.width);
      absoluteY = Math.floor(y * viewportSize.height);
    } else if (x > viewportSize.width || y > viewportSize.height) {
      console.log(`Warning: Received potentially invalid coordinates (${x}, ${y}), normalizing`);
      absoluteX = Math.min(x, viewportSize.width - 1);
      absoluteY = Math.min(y, viewportSize.height - 1);
    }
    
    console.log(`PlaywrightService: Mouse down at coordinates (${absoluteX}, ${absoluteY})`);
    
    // Move to position and press mouse button
    await this.page.mouse.move(absoluteX, absoluteY);
    await this.page.mouse.down();
    this.lastActivity = Date.now();
    
    console.log(`PlaywrightService: Successfully executed mouse down at (${absoluteX}, ${absoluteY})`);
  } catch (error) {
    console.error(`PlaywrightService: Failed to execute mouse down at (${x}, ${y}):`, error);
    throw error;
  }
}

async mouseUp(x: number, y: number): Promise<void> {
  if (!this.page) {
    throw new Error('Playwright not initialized');
  }
  
  try {
    const viewportSize = this.page.viewportSize();
    if (!viewportSize) {
      throw new Error('Unable to get viewport size');
    }
    
    // Apply the same coordinate fix
    let absoluteX = x;
    let absoluteY = y;
    
    if (x <= 1 && y <= 1) {
      absoluteX = Math.floor(x * viewportSize.width);
      absoluteY = Math.floor(y * viewportSize.height);
    } else if (x > viewportSize.width || y > viewportSize.height) {
      console.log(`Warning: Received potentially invalid coordinates (${x}, ${y}), normalizing`);
      absoluteX = Math.min(x, viewportSize.width - 1);
      absoluteY = Math.min(y, viewportSize.height - 1);
    }
    
    console.log(`PlaywrightService: Mouse up at coordinates (${absoluteX}, ${absoluteY})`);
    
    // Move to position and release mouse button
    await this.page.mouse.move(absoluteX, absoluteY);
    await this.page.mouse.up();
    this.lastActivity = Date.now();
    
    console.log(`PlaywrightService: Successfully executed mouse up at (${absoluteX}, ${absoluteY})`);
  } catch (error) {
    console.error(`PlaywrightService: Failed to execute mouse up at (${x}, ${y}):`, error);
    throw error;
  }
}

async mouseMove(x: number, y: number): Promise<void> {
  if (!this.page) {
    throw new Error('Playwright not initialized');
  }
  
  try {
    const viewportSize = this.page.viewportSize();
    if (!viewportSize) {
      throw new Error('Unable to get viewport size');
    }
    
    // Apply the same coordinate fix
    let absoluteX = x;
    let absoluteY = y;
    
    if (x <= 1 && y <= 1) {
      absoluteX = Math.floor(x * viewportSize.width);
      absoluteY = Math.floor(y * viewportSize.height);
    } else if (x > viewportSize.width || y > viewportSize.height) {
      console.log(`Warning: Received potentially invalid coordinates (${x}, ${y}), normalizing`);
      absoluteX = Math.min(x, viewportSize.width - 1);
      absoluteY = Math.min(y, viewportSize.height - 1);
    }
    
    console.log(`PlaywrightService: Moving mouse to coordinates (${absoluteX}, ${absoluteY})`);
    
    // Move mouse
    await this.page.mouse.move(absoluteX, absoluteY);
    this.lastActivity = Date.now();
    
    console.log(`PlaywrightService: Successfully moved mouse to (${absoluteX}, ${absoluteY})`);
  } catch (error) {
    console.error(`PlaywrightService: Failed to move mouse to (${x}, ${y}):`, error);
    throw error;
  }
}
  async pressKey(key: string): Promise<void> {
    if (!this.page) {
      throw new Error('Playwright not initialized');
    }
    
    console.log(`PlaywrightService: Attempting to press key: ${key}`);
    
    try {
      switch (key) {
        case 'Back':
          console.log('PlaywrightService: Going back in browser history');
          await this.page.goBack();
          break;
        case 'Forward':
          console.log('PlaywrightService: Going forward in browser history');
          await this.page.goForward();
          break;
        case 'F5':
          console.log('PlaywrightService: Reloading page');
          await this.page.reload();
          break;
        case 'Enter':
          console.log('PlaywrightService: Pressing Enter key');
          await this.page.keyboard.press('Enter');
          break;
        case 'Backspace':
          console.log('PlaywrightService: Pressing Backspace key');
          await this.page.keyboard.press('Backspace');
          break;
        case 'Tab':
          console.log('PlaywrightService: Pressing Tab key');
          await this.page.keyboard.press('Tab');
          break;
        case 'Escape':
          console.log('PlaywrightService: Pressing Escape key');
          await this.page.keyboard.press('Escape');
          break;
        case 'ArrowLeft':
          console.log('PlaywrightService: Pressing ArrowLeft key');
          await this.page.keyboard.press('ArrowLeft');
          break;
        case 'ArrowRight':
          console.log('PlaywrightService: Pressing ArrowRight key');
          await this.page.keyboard.press('ArrowRight');
          break;
        case 'ArrowUp':
          console.log('PlaywrightService: Pressing ArrowUp key');
          await this.page.keyboard.press('ArrowUp');
          break;
        case 'ArrowDown':
          console.log('PlaywrightService: Pressing ArrowDown key');
          await this.page.keyboard.press('ArrowDown');
          break;
        case 'Delete':
          console.log('PlaywrightService: Pressing Delete key');
          await this.page.keyboard.press('Delete');
          break;
        case ' ':
          console.log('PlaywrightService: Pressing Space key');
          await this.page.keyboard.press('Space');
          break;
        default:
          // For single character keys, use type
          if (key.length === 1) {
            console.log(`PlaywrightService: Typing character: ${key}`);
            await this.page.keyboard.type(key);
          } else {
            // For special keys, use press
            console.log(`PlaywrightService: Pressing special key: ${key}`);
            await this.page.keyboard.press(key);
          }
      }
      
      this.lastActivity = Date.now();
      console.log(`PlaywrightService: Successfully pressed key: ${key}`);
    } catch (error) {
      console.error(`PlaywrightService: Failed to press key ${key}:`, error);
      throw error;
    }
  }
  
  async takeScreenshot(): Promise<string> {
    if (!this.page) {
      throw new Error('Playwright not initialized');
    }
    
    try {
      console.log('PlaywrightService: Taking screenshot');
      // Take a screenshot and convert to base64
      const screenshot = await this.page.screenshot({ type: 'jpeg', quality: 80 });
      const base64Image = `data:image/jpeg;base64,${screenshot.toString('base64')}`;
      console.log('PlaywrightService: Screenshot taken successfully');
      return base64Image;
    } catch (error) {
      console.error('PlaywrightService: Failed to take screenshot:', error);
      throw error;
    }
  }
  
  async close(): Promise<void> {
    try {
      console.log('PlaywrightService: Closing browser');
      
      this.isStreaming = false;
      
      if (this.periodicFrameInterval) {
        clearInterval(this.periodicFrameInterval);
        this.periodicFrameInterval = null;
      }
      
      if (this.streamingClient) {
        try {
          await this.streamingClient.send('Page.stopScreencast');
          await this.streamingClient.detach();
        } catch (error) {
          console.log('Screencast already stopped or detached');
        }
        this.streamingClient = null;
      }
      
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      console.log('PlaywrightService: Browser closed');
    } catch (error) {
      console.error('PlaywrightService: Failed to close:', error);
      throw error;
    }
  }
}