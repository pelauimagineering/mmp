class WebSocketClient {
    constructor() {
        this.ws = null;
        this.sessionToken = null;
        this.connected = false;
        this.messageHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
    }

    connect(sessionToken) {
        this.sessionToken = sessionToken;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        console.log('Connecting to WebSocket:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus(true);

            // Authenticate
            this.send('auth', { token: this.sessionToken });
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('WebSocket message received:', message.type);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            this.connected = false;
            this.updateConnectionStatus(false);

            // Attempt to reconnect
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

                setTimeout(() => {
                    this.connect(this.sessionToken);
                }, this.reconnectDelay);
            }
        };
    }

    send(type, data = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return false;
        }

        const message = {
            type,
            token: this.sessionToken,
            ...data
        };

        console.log('Sending WebSocket message:', message.type, 'with data:', data);
        this.ws.send(JSON.stringify(message));
        return true;
    }

    on(messageType, handler) {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, []);
        }
        this.messageHandlers.get(messageType).push(handler);
    }

    handleMessage(message) {
        const handlers = this.messageHandlers.get(message.type);

        if (handlers) {
            handlers.forEach(handler => handler(message));
        }

        // Also trigger generic 'message' handlers
        const genericHandlers = this.messageHandlers.get('*');
        if (genericHandlers) {
            genericHandlers.forEach(handler => handler(message));
        }
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('statusIndicator');
        const text = document.getElementById('statusText');

        if (indicator && text) {
            if (connected) {
                indicator.classList.add('connected');
                text.textContent = 'Connected';
            } else {
                indicator.classList.remove('connected');
                text.textContent = 'Disconnected';
            }
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Global WebSocket client instance
const wsClient = new WebSocketClient();
