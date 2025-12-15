import { io } from "socket.io-client";

const socket = io("http://0.0.0.0:5003", {
  transports: ["websocket"], // важно!
  forceNew: true,
  reconnectionAttempts: 3
});

socket.on("connect", () => {
  console.log("✔ Connected to server:", socket.id);

  // Отправляем тестовое сообщение
  socket.emit(
    "user:message",
    { message: "Привет, сервер!" },
    (response) => {
      console.log("📩 Server callback:", response);
    }
  );
});

socket.on("connect_error", (err) => {
  console.error("❌ Connection error:", err.message);
});

socket.on("message:processed", (data) => {
  console.log("📡 Broadcast event:", data);
});

socket.on("disconnect", () => {
  console.log("❗ Disconnected");
});

