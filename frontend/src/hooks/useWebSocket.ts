// src/hooks/useWebSocket.ts
import { useState, useEffect, useCallback } from 'react';
import { 
  Message, 
  ChatMessage,
  BrowserEvent 
} from '@/types';

export const useWebSocket = (wsUrl: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [canvasImage, setCanvasImage] = useState<string | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        setSocket(new WebSocket(wsUrl));
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data: Message = JSON.parse(event.data);

        // If receiving frame data, log its size
    if (data.type ===  'frame' && data.data) {
      console.log('Received frame data of length:', data.data.length);
    }
        
        switch (data.type) {
          case 'chat':
            const chatMessage = data.data as ChatMessage;
            setChatMessages(prev => [...prev, chatMessage]);
            break;
          
          case 'frame':
            setCanvasImage(data.data as string);
            break;
            
          default:
            console.warn('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    setSocket(ws);

    // Cleanup on unmount
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [wsUrl]);

  // Send a chat message
  const sendChatMessage = useCallback((text: string) => {
    if (socket && isConnected) {
      const message: Message = {
        type: 'chat',
        data: {
          text,
          sender: 'user',
          timestamp: Date.now()
        }
      };

      socket.send(JSON.stringify(message));
      
      // Add the message to the local state
      setChatMessages(prev => [...prev, message.data]);
    }
  }, [socket, isConnected]);

  // Send a browser event
  const sendBrowserEvent = useCallback((event: BrowserEvent) => {
    if (socket && isConnected) {
      console.log('Sending browser event:', event); // Add logging to debug
      
      const message: Message = {
        type: 'event',
        data: event
      };

      socket.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send event - socket not connected:', event);
    }
  }, [socket, isConnected]);

  return {
    isConnected,
    chatMessages,
    canvasImage,
    sendChatMessage,
    sendBrowserEvent
  };
};