const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./config/dbConfig');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const initializeSocket = require('./src/services/socketIoService');
const path = require('path');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const app = express();

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const morgan = require('morgan');
app.use(morgan('dev'));

// Configure CORS
const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials:true
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
// Create HTTP Server
const server = http.createServer(app);

// Connect to Database
connectDB();


const io = initializeSocket(server);

// ✅ CRITICAL: Apply socket middleware BEFORE routes
app.use((req, res, next) => {
    req.io = io;
    req.socketUserMap = io.socketUserMap;
    console.log(`Request to ${req.path} - SocketUserMap size: ${req.socketUserMap?.size || 0}`);
    next();
});


// Routes
const userRoutes = require('./src/routes/userRoute');
const chatRoutes = require('./src/routes/chatRoutes');
const statusRoute = require('./src/routes/statusRoute');
const friendRoutes = require('./src/routes/friendRoute');

// Define API Routes
app.use('/api/friends', friendRoutes); // Register friends first
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/status', statusRoute);


// Start Server
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep the server running
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Keep the server running
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


