'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ChatMessage {
  text: string;
  sender: 'user' | 'system';
  timestamp: number;
}

interface ChatSectionProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
}

export function ChatSection({ messages, onSendMessage }: ChatSectionProps) {
  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3">
        <CardTitle>Chat</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="flex-1 p-0">
        <ScrollArea ref={scrollAreaRef} className="h-full max-h-[calc(100%-60px)] p-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground p-4">
              No messages yet. Start typing to interact with the browser.
            </div>
          ) : (
            messages.map((message, index) => (
              <div 
                key={index} 
                className={`mb-4 ${
                  message.sender === 'user' 
                    ? 'ml-auto bg-blue-500 text-white' 
                    : 'mr-auto bg-slate-700 text-slate-100'
                } rounded-lg p-3 max-w-[80%]`}
              >
                <div className="text-sm">{message.text}</div>
                <div className="text-xs mt-1 opacity-70 text-right">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </CardContent>
      <Separator />
      <CardFooter className="p-4">
        <div className="flex w-full gap-2">
          <Input
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
          />
          <Button onClick={handleSend}>Send</Button>
        </div>
      </CardFooter>
    </Card>
  );
}