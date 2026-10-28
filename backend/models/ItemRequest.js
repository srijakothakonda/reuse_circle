import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true }
}, { timestamps: true });
schema.index({ listingId: 1, requesterId: 1, status: 1 });
schema.index({ listingId: 1, requesterId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
export default mongoose.model('ItemRequest', schema);
