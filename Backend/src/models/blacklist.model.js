const mongoose = require("mongoose");

const blacklistTokenSchema = new mongoose.Schema({
    token:{
        type: String,
        unique: [true, "Token already exists"],
        required: [true, "Token is required"]
    }
}, {
    timestamps: true
})

const blacklistTokenModel = mongoose.model('blacklistTokens', blacklistTokenSchema)

module.exports = blacklistTokenModel