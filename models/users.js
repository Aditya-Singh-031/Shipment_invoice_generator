require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Use your Mongo URI from .env
const mongoUri = process.env.MONGO_URI;

// Define User Schema (Simplified to match your structure)
const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    username: { type: String, unique: true },
    role: String,
    status: String,
    hashed_password: String,
    created_at: { type: Date, default: Date.now },
    last_login: Date
});

// Explicitly point to the 'users' collection
const User = mongoose.model('User', UserSchema, 'users');

async function seedUser() {
    try {
        await mongoose.connect(mongoUri);
        console.log('🔌 Connected to MongoDB');

        // 1. Delete existing superadmin to avoid duplicates
        await User.deleteOne({ email: "superadmin@morsebiz.com" });

        // 2. Hash the password "123456"
        // This gives you a password you ACTUALLY know
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("123456", salt);

        // 3. Create the new admin user
        const admin = new User({
            name: "Super Admin",
            email: "superadmin@morsebiz.com",
            username: "superadmin",
            role: "super-admin",
            status: "active",
            hashed_password: hashedPassword, // The hash for "123456"
            last_login: new Date()
        });

        await admin.save();
        console.log('✅ Super Admin created successfully!');
        console.log('👉 Username: superadmin');
        console.log('👉 Password: 123456');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating user:', error);
        process.exit(1);
    }
}

seedUser();