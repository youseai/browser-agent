'use client';

import { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface CanvasSectionProps {
    isConnected: boolean;
    ws: WebSocket | null;
}

export function CanvasSection({ isConnected, ws }: CanvasSectionProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [debug, setDebug] = useState<string[]>([]);
    const [canvasWidth, setCanvasWidth] = useState<number>(1280);
    const [canvasHeight, setCanvasHeight] = useState<number>(720);
    const [hasInteracted, setHasInteracted] = useState<boolean>(false);

    // Helper function for logging
    const addDebug = (message: string) => {
        console.log(`${new Date().toISOString()} - ${message}`);
        setDebug(prev => [...prev.slice(-9), `${new Date().toISOString().slice(11, 19)} - ${message}`]);
    };

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            // Set initial dimensions
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            // Set initial background
            const ctx = canvas.getContext('2d', { alpha: false });
            if (ctx) {
                ctx.fillStyle = 'rgb(245, 245, 245)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.font = '20px Arial';
                ctx.fillStyle = 'rgb(100, 100, 100)';
                ctx.textAlign = 'center';
                ctx.fillText('Waiting for browser content...', canvas.width / 2, canvas.height / 2);
            }
        }
    }, [canvasRef, canvasWidth, canvasHeight]);

    // Handle frame updates from WebSocket
    useEffect(() => {
        if (!ws) return;

        const handleMessage = (event: MessageEvent) => {
            try {
                const message = JSON.parse(event.data);

                // Update this part in your ImprovedCanvasSection
                if (message.type === 'frame' && message.data) {
                    console.log('Processing frame data of length:', message.data.length);

                    const img = new Image();

                    img.onload = () => {
                        console.log('Image loaded successfully', img.width, img.height);
                        const canvas = canvasRef.current;
                        if (!canvas) {
                            console.error('Canvas not found');
                            return;
                        }

                        const ctx = canvas.getContext('2d', { alpha: false });
                        if (!ctx) {
                            console.error('Failed to get canvas context');
                            return;
                        }

                        // Draw the image
                        console.log('Drawing image to canvas');
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    };

                    img.onerror = (error) => {
                        console.error('Failed to load image:', error);
                    };

                    img.src = `data:image/jpeg;base64,${message.data}`;
                }
            } catch (error) {
                addDebug(`Error processing message: ${error}`);
            }
        };

        ws.addEventListener('message', handleMessage);

        return () => {
            ws.removeEventListener('message', handleMessage);
        };
    }, [ws]);

    // Add focus tracking
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleFocus = () => {
            addDebug('Canvas focused - keyboard events active');
            setHasInteracted(true);
        };

        const handleBlur = () => {
            addDebug('Canvas lost focus - keyboard events inactive');
        };

        canvas.addEventListener('focus', handleFocus);
        canvas.addEventListener('blur', handleBlur);

        return () => {
            canvas.removeEventListener('focus', handleFocus);
            canvas.removeEventListener('blur', handleBlur);
        };
    }, [canvasRef]);

    // Handle mouse events
const handleMouseEvent = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
      addDebug('Cannot send event - WebSocket not connected');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Focus canvas on interaction to enable keyboard events
    if (!hasInteracted) {
      canvas.focus();
      setHasInteracted(true);
    }
    
    // Calculate coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    
    // Calculate coordinates as percentages of canvas dimensions
    // This makes coordinates relative regardless of client/server viewport differences
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    
    // Send the event to the server
    try {
      ws.send(JSON.stringify({
        type: event.type,
        x: x,
        y: y,
        timestamp: Date.now()
      }));
      
      addDebug(`Sent ${event.type} at (${x}, ${y})`);
    } catch (error) {
      addDebug(`Error sending ${event.type} event: ${error}`);
    }
  };
    // Handle keyboard events
    const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
        if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
            addDebug('Cannot send key event - WebSocket not connected');
            return;
        }

        try {
            // Create key message including modifiers
            const keyMessage = {
                type: 'keyPress',
                key: event.key,
                keyCode: event.keyCode,
                shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                timestamp: Date.now()
            };

            ws.send(JSON.stringify(keyMessage));
            addDebug(`Sent keyPress: ${event.key}`);

            // Prevent default for navigation keys
            if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
                event.preventDefault();
            }
        } catch (error) {
            addDebug(`Error sending key event: ${error}`);
        }
    };

    // Handle browser navigation actions
    const sendBrowserAction = (action: string) => {
        if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
            addDebug('Cannot send action - WebSocket not connected');
            return;
        }

        try {
            let key;
            switch (action) {
                case 'back':
                    key = 'Back';
                    break;
                case 'forward':
                    key = 'Forward';
                    break;
                case 'refresh':
                    key = 'F5';
                    break;
                default:
                    addDebug(`Unknown browser action: ${action}`);
                    return;
            }

            ws.send(JSON.stringify({
                type: 'keyPress',
                key,
                timestamp: Date.now()
            }));

            addDebug(`Sent browser action: ${action}`);
        } catch (error) {
            addDebug(`Error sending browser action: ${error}`);
        }
    };

    // Handle click on instruction label
    const handleInstructionClick = () => {
        if (canvasRef.current) {
            canvasRef.current.focus();
            setHasInteracted(true);
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="py-3">
                <CardTitle>Browser View</CardTitle>
                {!hasInteracted && (
                    <div
                        className="text-amber-600 text-sm font-medium cursor-pointer"
                        onClick={handleInstructionClick}
                    >
                        Click here to enable keyboard input
                    </div>
                )}
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 relative p-0 overflow-hidden">
                <div ref={containerRef} className="w-full h-full flex items-center justify-center">
                    <canvas
                        ref={canvasRef}
                        width={canvasWidth}
                        height={canvasHeight}
                        onClick={handleMouseEvent}
                        onMouseDown={handleMouseEvent}
                        onMouseUp={handleMouseEvent}
                        onMouseMove={handleMouseEvent}
                        onKeyDown={handleKeyDown}
                        tabIndex={0}
                        className="max-w-full max-h-full object-contain border border-gray-200"
                        style={{
                            background: '#f5f5f5',
                            cursor: isConnected ? 'crosshair' : 'default'
                        }}
                    />
                </div>

                {!isConnected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
                        Waiting for connection...
                    </div>
                )}
            </CardContent>

            {/* Debug log section */}
            <div className="max-h-20 overflow-y-auto bg-gray-100 p-2 text-xs font-mono">
                {debug.length === 0 ? (
                    <div className="text-gray-500">Activity log will appear here</div>
                ) : (
                    debug.map((msg, i) => (
                        <div key={i} className="text-gray-700">{msg}</div>
                    ))
                )}
            </div>

            <Separator />
            <CardFooter className="p-4">
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        onClick={() => sendBrowserAction('back')}
                        disabled={!isConnected}
                    >
                        Back
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => sendBrowserAction('forward')}
                        disabled={!isConnected}
                    >
                        Forward
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => sendBrowserAction('refresh')}
                        disabled={!isConnected}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="default"
                        onClick={() => {
                            if (canvasRef.current) {
                                canvasRef.current.focus();
                                addDebug('Canvas focused - ready for keyboard input');
                                setHasInteracted(true);
                            }
                        }}
                    >
                        Focus Canvas
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}