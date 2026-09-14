import { io } from "socket.io-client";

const getSocketUrl = () => {
    const url = (
        import.meta.env.VITE_SOCKET_URL ||
        import.meta.env.VITE_API_BASE_URL ||
        import.meta.env.VITE_API_URL ||
        "http://localhost:5000/api/v1"
    );

    // If it's a relative URL (like /api/v1), we should use the current origin but with port 5000 (standard backend port in this project)
    // or just default to localhost:5000 if we're in dev.
    if (url.startsWith("/")) {
        const port = import.meta.env.DEV ? "5000" : window.location.port;
        return `${window.location.protocol}//${window.location.hostname}${port ? ":" + port : ""}`;
    }

    // Strip /api/v1 or similar from the end
    return url.replace(/\/api(?:\/v\d+)?\/?$/, "");
};

const SOCKET_URL = getSocketUrl();

class SocketService {
    socket = null;

    connect() {
        if (this.socket) return this.socket;

        this.socket = io(SOCKET_URL, {
            transports: ["websocket"],
            reconnection: true,
        });

        this.socket.on("connect", () => {
            console.log("[Socket] Connected to server");
        });

        this.socket.on("disconnect", () => {
            console.log("[Socket] Disconnected from server");
        });

        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    emit(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }

    on(event, callback) {
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    off(event, callback) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }
}

export const socketService = new SocketService();
