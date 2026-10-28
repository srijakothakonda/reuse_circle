import mongoose from 'mongoose';
export const CATEGORIES = ['Electronics', 'Books', 'Clothing', 'Furniture', 'Home & Kitchen', 'Toys', 'Sports', 'Other'];
export const CONDITIONS = ['Like New', 'Good', 'Fair'];
const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  category: { type: String, required: true, enum: CATEGORIES }, condition: { type: String, required: true, enum: CONDITIONS },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  pickupArea: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  // Keep precise pickup details private; the API only returns these to the owner
  // and to the requester after their request has been accepted.
  pickupAddress: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
  pickupTime: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
  imageUrl: { type: String, trim: true, default: '' },
  imageData: { type: Buffer, default: undefined, select: false },
  imageContentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], select: false },
  status: { type: String, enum: ['available', 'reserved', 'collected'], default: 'available', index: true }
}, { timestamps: true });
schema.index({ category: 1, condition: 1, status: 1, createdAt: -1 });
schema.index({ title: 'text', description: 'text' });
export default mongoose.model('Listing', schema);
