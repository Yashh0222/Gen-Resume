const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username:{
        type: String,
        unique: [true, "User already exists"],
        required: [true, "User is required"],
    },

    email:{
        type: String,
        unique: [true, "Email already exists"],
        required: [true, "Email is required"],
    },

    password:{
        type: String,
        required: [true, "Password is required"],
    },

    
})

const userModel = mongoose.model('users', userSchema);

module.exports = userModel;
