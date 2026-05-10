const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
        index: true
    },

    password: {
        type: String,
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },

    firebaseUid: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },

    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [100, 'Name cannot exceed 100 characters']
    },

    photoURL: { type: String, trim: true },

    role: {
        type: String,
        enum: ['Admin', 'User'],
        default: 'User',
        index: true
    },

    isEmailVerified: {
        type: Boolean,
        default: false,
        index: true
    },

    emailVerificationToken: { type: String, select: false, index: true },
    emailVerificationExpires: { type: Date, select: false, index: true },

    resetPasswordToken: { type: String, select: false, index: true },
    resetPasswordExpires: { type: Date, select: false, index: true },

    lastLogin: { type: Date, index: true },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },

    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },

    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true,
    toJSON: {
        transform: (doc, ret) => {
            delete ret.password;
            delete ret.__v;
            delete ret.emailVerificationToken;
            delete ret.emailVerificationExpires;
            delete ret.resetPasswordToken;
            delete ret.resetPasswordExpires;
        }
    }
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) { next(error); }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateEmailVerificationToken = function () {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    return token;
};

userSchema.methods.generatePasswordResetToken = function () {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    this.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    return token;
};

userSchema.methods.incLoginAttempts = async function () {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
    }
    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
    }
    return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function () {
    return this.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
};

userSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

module.exports = mongoose.model('User', userSchema);
