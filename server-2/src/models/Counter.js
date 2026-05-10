const mongoose = require('mongoose');

/**
 * Counter Schema
 * Used for generating sequential numbers atomically across the application
 * 
 * Supported Counter Types:
 * - thread: Thread numbers (THR-YYYY-NNNNN)
 * - invoice: Invoice numbers (INV-YYYY-NNNNN)
 * - notification: Notification numbers (NOT-YYYY-NNNNN)
 * 
 * Benefits:
 * - Atomic operations prevent race conditions
 * - Per-firm counters for multi-tenancy
 * - Per-year counters for better organization
 * - Automatic counter creation on first use
 * 
 * Thread Safety:
 * Uses MongoDB's findByIdAndUpdate with $inc operator which is atomic
 * at the document level, ensuring no two requests get the same number
 */
const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
    // Format: {prefix}_{firmId}_{year}
    // Example: thread_507f1f77bcf86cd799439011_2026
  },
  sequence: {
    type: Number,
    default: 0,
    min: 0
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true
  },
  counterType: {
    type: String,
    enum: ['thread', 'invoice', 'notification'],
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for firm and year
counterSchema.index({ firmId: 1, year: 1, counterType: 1 });

/**
 * Get next sequence number atomically
 * 
 * @param {ObjectId} firmId - The firm ID
 * @param {Number} year - The year for the counter
 * @param {String} prefix - Counter type prefix (thread, invoice, notification)
 * @returns {Number} The next sequence number
 * 
 * Example:
 * const sequence = await Counter.getNextSequence(firmId, 2026, 'thread');
 * // Returns: 1, 2, 3, ... (sequential)
 */
counterSchema.statics.getNextSequence = async function(firmId, year, prefix = 'thread') {
  const counterId = `${prefix}_${firmId}_${year}`;
  
  // findByIdAndUpdate with $inc is atomic - no race conditions possible
  const counter = await this.findByIdAndUpdate(
    counterId,
    { 
      $inc: { sequence: 1 },
      $setOnInsert: { 
        firmId, 
        year,
        counterType: prefix
      }
    },
    { 
      new: true,           // Return updated document
      upsert: true,        // Create if doesn't exist
      setDefaultsOnInsert: true
    }
  );
  
  return counter.sequence;
};

/**
 * Get current sequence number without incrementing
 * 
 * @param {ObjectId} firmId - The firm ID
 * @param {Number} year - The year for the counter
 * @param {String} prefix - Counter type prefix
 * @returns {Number} The current sequence number (0 if counter doesn't exist)
 */
counterSchema.statics.getCurrentSequence = async function(firmId, year, prefix = 'thread') {
  const counterId = `${prefix}_${firmId}_${year}`;
  const counter = await this.findById(counterId);
  return counter ? counter.sequence : 0;
};

/**
 * Reset counter (use with caution - mainly for testing)
 * 
 * @param {ObjectId} firmId - The firm ID
 * @param {Number} year - The year for the counter
 * @param {String} prefix - Counter type prefix
 */
counterSchema.statics.resetCounter = async function(firmId, year, prefix = 'thread') {
  const counterId = `${prefix}_${firmId}_${year}`;
  await this.findByIdAndUpdate(
    counterId,
    { $set: { sequence: 0 } },
    { upsert: true }
  );
};

/**
 * Get all counters for a firm
 * 
 * @param {ObjectId} firmId - The firm ID
 * @returns {Array} Array of counter documents
 */
counterSchema.statics.getFirmCounters = async function(firmId) {
  return this.find({ firmId }).sort({ year: -1, counterType: 1 });
};

module.exports = mongoose.model('Counter', counterSchema);
