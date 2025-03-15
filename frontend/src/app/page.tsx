// src/app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ChatSection } from '@/components/ChatSection';
import { CanvasSection } from '@/components/CanvasSection';

export default function Home() {
  // WebSocket connection
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>(null);
  
  // Connect to WebSocket server
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    console.log('Connecting to WebSocket server:', wsUrl);
    
    const connectWebSocket = () => {
      try {
        const socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
          console.log('WebSocket connection established');
          setIsConnected(true);
          setWs(socket);
          
          // Send initial connection message
          setChatMessages(prev => [...prev, {
            text: 'Connected to browser automation server',
            sender: 'system',
            timestamp: Date.now()
          }]);
        };
        
        socket.onclose = (event) => {
          console.log(`WebSocket connection closed (${event.code}): ${event.reason}`);
          setIsConnected(false);
          setWs(null);
          
          // Add disconnect message
          setChatMessages(prev => [...prev, {
            text: 'Disconnected from server. Attempting to reconnect...',
            sender: 'system',
            timestamp: Date.now()
          }]);
          
          // Attempt to reconnect after 3 seconds
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...');
            connectWebSocket();
          }, 3000);
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data);
            
            // Handle chat messages
            if (data.type === 'chat' && data.content) {
              setChatMessages(prev => [...prev, data.content]);
            }
          } catch (error) {
            console.error('Error processing message:', error);
          }
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
      }
    };
    
    connectWebSocket();
    
    // Cleanup function
    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);
  
  // Send a chat message
  const handleSendMessage = (text: string) => {
    if (!ws || !isConnected) {
      console.warn('Cannot send message - not connected');
      return;
    }
    
    try {
      const message = {
        type: 'chat',
        content: {
          text,
          sender: 'user',
          timestamp: Date.now()
        }
      };
      
      ws.send(JSON.stringify(message));
      
      // Add to local messages
      setChatMessages(prev => [...prev, message.content]);
    } catch (error) {
      console.error('Error sending chat message:', error);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-slate-900">
      <header className="bg-slate-800 p-4 text-white">
        <h1 className="text-xl font-bold">Browser Automation Interface</h1>
        <div className="text-sm">
          Status: {isConnected ? 
            <span className="text-green-500">Connected</span> : 
            <span className="text-red-500">Disconnected</span>}
        </div>
      </header>
      
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <div className="w-full lg:w-2/5 h-1/3 lg:h-full p-2">
          <ChatSection 
            messages={chatMessages} 
            onSendMessage={handleSendMessage} 
          />
        </div>
        
        <div className="w-full lg:w-3/5 h-2/3 lg:h-full p-2">
          <CanvasSection 
            isConnected={isConnected}
            ws={ws}
          />
        </div>
      </div>
    </main>
  );
}