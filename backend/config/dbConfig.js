const mongoose = require('mongoose');

const connectDb = async () => {
    const connectWithRetry = async () => {
        console.log('Attempting to connect to MongoDB...');
        try {
            await mongoose.connect(process.env.MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000, // Timeout after 5s
                socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
            });
            console.log('Mongo db connection established');
        } catch (error) {
            console.error('Error connecting to database:', error.message);
            console.log('Retrying in 5 seconds...');
            setTimeout(connectWithRetry, 5000);
        }
    };

    // Listen for disconnection events
    mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected! Attempting to reconnect...');
        connectWithRetry();
    });

    mongoose.connection.on('error', (err) => {
        console.error('MongoDB error:', err.message);
    });

    await connectWithRetry();
};

module.exports = connectDb;