import { Router } from 'express';
import { body, param, query } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing, { CATEGORIES, CONDITIONS } from '../models/Listing.js';
import ItemRequest from '../models/ItemRequest.js';
import ContentReport from '../models/ContentReport.js';
import { authRequired, authOptional, moderatorOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const idRule = param('id').isMongoId().withMessage('Invalid ID');
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ok = (res, data, message = 'Success', status = 200) => res.status(status).json({ success: true, message, data });
const ownListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) { res.status(404).json({ success: false, message: 'Listing not found' }); return null; }
  if (!listing.ownerId.equals(req.user._id)) { res.status(403).json({ success: false, message: 'You are not authorized to manage this listing' }); return null; }
  return listing;
};
const cookieOptions = (config) => ({ httpOnly: true, secure: config.cookieSecure, sameSite: config.cookieSameSite, path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 });
const imageRule = body('imageData').optional({ values: 'falsy' }).matches(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).withMessage('Choose a JPG, PNG, or WebP image');
function imageBuffer(dataUrl) {
  if (!dataUrl) return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) { const error = new Error('Choose a JPG, PNG, or WebP image'); error.status = 400; throw error; }
  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > 2 * 1024 * 1024) { const error = new Error('Image must be 2 MB or smaller'); error.status = 400; throw error; }
  return { data, contentType: match[1] };
}
function safeListing(listing, req, includePrivate = false) {
  const value = listing.toObject ? listing.toObject() : { ...listing };
  if (!includePrivate) { delete value.pickupAddress; delete value.pickupTime; }
  const hasUploadedImage = Boolean(value.imageContentType || value.imageData);
  delete value.imageData; delete value.imageContentType;
  if (hasUploadedImage) value.imageUrl = `${req.protocol}://${req.get('host')}/api/listings/${value._id}/image`;
  return value;
}

export function createApi(config) {
  const router = Router();
  const auth = authRequired(config.jwtSecret);
  router.get('/health', (req, res) => ok(res, { status: 'ok' }, 'Healthy'));

  router.post('/auth/register', [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),
    body('email').trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
    body('password').isLength({ min: 10, max: 128 }).withMessage('Password must be at least 10 characters long')
      .matches(/[a-z]/).withMessage('Password must include a lowercase letter')
      .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must include a number'),
    body('confirmPassword').custom((v, { req }) => v === req.body.password).withMessage('Passwords do not match'),
    validate
  ], asyncRoute(async (req, res) => {
    const email = req.body.email.toLowerCase();
    if (await User.exists({ email })) return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    const user = await User.create({ name: req.body.name, email, passwordHash: await bcrypt.hash(req.body.password, 12) });
    ok(res, { user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 'Account created successfully', 201);
  }));
  router.post('/auth/login', [body('email').trim().isEmail().normalizeEmail(), body('password').isString().notEmpty(), validate], asyncRoute(async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) return res.status(401).json({ success: false, message: 'Email or password is incorrect' });
    const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '7d' });
    res.cookie('reusecircle_token', token, cookieOptions(config));
    ok(res, { user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 'Welcome back');
  }));
  router.post('/auth/logout', (req, res) => { res.clearCookie('reusecircle_token', { ...cookieOptions(config), maxAge: undefined }); ok(res, null, 'Logged out successfully'); });
  router.get('/auth/me', auth, (req, res) => ok(res, { user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } }));

  router.get('/listings', [query('search').optional().trim().isLength({ max: 120 }), query('category').optional().isIn(CATEGORIES), query('condition').optional().isIn(CONDITIONS), query('status').optional().isIn(['available', 'reserved', 'collected']), query('page').optional().isInt({ min: 1, max: 100000 }), query('limit').optional().isInt({ min: 1, max: 50 }), validate], asyncRoute(async (req, res) => {
    const { search, category, condition, status } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (condition) filter.condition = condition;
    if (status) filter.status = status;
    if (search) { const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ title: { $regex: escaped, $options: 'i' } }, { description: { $regex: escaped, $options: 'i' } }]; }
    const page = Number(req.query.page || 1); const limit = Number(req.query.limit || 12);
    const [items, total] = await Promise.all([Listing.find(filter).select('-__v +imageContentType').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), Listing.countDocuments(filter)]);
    ok(res, { items: items.map(item => safeListing(item, req)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  }));
  router.post('/listings', auth, [body('title').trim().isLength({ min: 2, max: 120 }), body('category').isIn(CATEGORIES), body('condition').isIn(CONDITIONS), body('description').trim().isLength({ min: 10, max: 2000 }), body('pickupArea').trim().isLength({ min: 2, max: 120 }), body('pickupAddress').trim().isLength({ min: 5, max: 300 }), body('pickupTime').trim().isLength({ min: 3, max: 200 }), imageRule, validate], asyncRoute(async (req, res) => {
    const image = imageBuffer(req.body.imageData);
    const listing = await Listing.create({ ownerId: req.user._id, title: req.body.title, category: req.body.category, condition: req.body.condition, description: req.body.description, pickupArea: req.body.pickupArea, pickupAddress: req.body.pickupAddress, pickupTime: req.body.pickupTime, imageData: image?.data, imageContentType: image?.contentType });
    ok(res, { listing: safeListing(listing, req, true) }, 'Listing created successfully', 201);
  }));
  router.get('/listings/:id/image', asyncRoute(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid listing ID' });
    const listing = await Listing.findById(req.params.id).select('+imageData +imageContentType');
    if (!listing?.imageData || !listing.imageContentType) return res.status(404).json({ success: false, message: 'Listing image not found' });
    res.set('Cache-Control', 'public, max-age=3600'); res.type(listing.imageContentType).send(listing.imageData);
  }));
  router.get('/listings/:id', authOptional(config.jwtSecret), [idRule, validate], asyncRoute(async (req, res) => {
    const listing = await Listing.findById(req.params.id).select('-__v +imageContentType');
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
    const isOwner = req.user && listing.ownerId.equals(req.user._id);
    const hasAcceptedRequest = req.user && await ItemRequest.exists({ listingId: listing._id, requesterId: req.user._id, status: 'accepted' });
    ok(res, { listing: safeListing(listing, req, Boolean(isOwner || hasAcceptedRequest)) });
  }));
  router.patch('/listings/:id', auth, [idRule, body('title').optional().trim().isLength({ min: 2, max: 120 }), body('category').optional().isIn(CATEGORIES), body('condition').optional().isIn(CONDITIONS), body('description').optional().trim().isLength({ min: 10, max: 2000 }), body('pickupArea').optional().trim().isLength({ min: 2, max: 120 }), body('pickupAddress').optional().trim().isLength({ min: 5, max: 300 }), body('pickupTime').optional().trim().isLength({ min: 3, max: 200 }), imageRule, body('status').not().exists().withMessage('Status cannot be changed here'), validate], asyncRoute(async (req, res) => {
    const listing = await ownListing(req, res); if (!listing) return;
    if (listing.status !== 'available') return res.status(409).json({ success: false, message: 'Only available listings can be edited' });
    const fields = ['title', 'category', 'condition', 'description', 'pickupArea', 'pickupAddress', 'pickupTime'];
    for (const field of fields) if (req.body[field] !== undefined) listing[field] = req.body[field];
    const image = imageBuffer(req.body.imageData); if (image) { listing.imageData = image.data; listing.imageContentType = image.contentType; }
    await listing.save(); ok(res, { listing: safeListing(listing, req, true) }, 'Listing updated successfully');
  }));
  router.delete('/listings/:id', auth, [idRule, validate], asyncRoute(async (req, res) => {
    const listing = await ownListing(req, res); if (!listing) return;
    if (listing.status !== 'available') return res.status(409).json({ success: false, message: 'Only available listings can be deleted' });
    await Promise.all([Listing.deleteOne({ _id: listing._id }), ItemRequest.deleteMany({ listingId: listing._id }), ContentReport.deleteMany({ listingId: listing._id })]);
    ok(res, null, 'Listing deleted successfully');
  }));
  router.get('/me/listings', auth, asyncRoute(async (req, res) => {
    const listings = await Listing.find({ ownerId: req.user._id }).select('+imageContentType').sort({ createdAt: -1 }).lean();
    ok(res, { listings: listings.map(item => safeListing(item, req, true)) });
  }));

  router.post('/listings/:id/requests', auth, [idRule, body('message').trim().isLength({ min: 5, max: 1000 }), validate], asyncRoute(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
    if (listing.ownerId.equals(req.user._id)) return res.status(403).json({ success: false, message: 'You cannot request your own listing' });
    if (listing.status !== 'available') return res.status(409).json({ success: false, message: 'This item is no longer available for requests' });
    if (await ItemRequest.exists({ listingId: listing._id, requesterId: req.user._id, status: { $in: ['pending', 'accepted'] } })) return res.status(409).json({ success: false, message: 'You already have an active request for this item' });
    const request = await ItemRequest.create({ listingId: listing._id, requesterId: req.user._id, message: req.body.message });
    ok(res, { request }, 'Request sent successfully', 201);
  }));
  router.get('/me/requests', auth, asyncRoute(async (req, res) => {
    const requests = await ItemRequest.find({ requesterId: req.user._id }).populate({ path: 'listingId', select: '+imageContentType' }).sort({ createdAt: -1 }).lean();
    ok(res, { requests: requests.map(item => ({ ...item, listingId: item.listingId ? safeListing(item.listingId, req, item.status === 'accepted') : null })) });
  }));
  router.get('/listings/:id/requests', auth, [idRule, validate], asyncRoute(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
    if (!listing.ownerId.equals(req.user._id)) return res.status(403).json({ success: false, message: 'Only the listing owner can view requests' });
    const requests = await ItemRequest.find({ listingId: listing._id }).populate('requesterId', 'name').sort({ createdAt: -1 }).lean();
    ok(res, { requests });
  }));
  router.patch('/requests/:id/status', auth, [idRule, body('status').isIn(['accepted', 'declined']), validate], asyncRoute(async (req, res) => {
    const request = await ItemRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    const listing = await Listing.findById(request.listingId);
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
    if (!listing.ownerId.equals(req.user._id)) return res.status(403).json({ success: false, message: 'Only the listing owner can manage requests' });
    if (request.status !== 'pending') return res.status(409).json({ success: false, message: 'This request has already been resolved' });
    if (req.body.status === 'accepted') {
      const topology = mongoose.connection.client?.topology?.description?.type;
      if (topology && topology !== 'Single') {
        const session = await mongoose.startSession();
        let selected; let reserved;
        try {
          await session.withTransaction(async () => {
            reserved = await Listing.findOneAndUpdate({ _id: listing._id, status: 'available' }, { $set: { status: 'reserved' } }, { new: true, session });
            if (!reserved) { const error = new Error('This item is no longer available'); error.status = 409; throw error; }
            selected = await ItemRequest.findOneAndUpdate({ _id: request._id, status: 'pending' }, { $set: { status: 'accepted' } }, { new: true, session });
            if (!selected) { const error = new Error('This request was already resolved'); error.status = 409; throw error; }
            await ItemRequest.updateMany({ listingId: listing._id, _id: { $ne: request._id }, status: 'pending' }, { $set: { status: 'declined' } }, { session });
          });
          return ok(res, { request: selected, listing: reserved }, 'Request accepted; competing requests declined');
        } finally { await session.endSession(); }
      }
      const reserved = await Listing.findOneAndUpdate({ _id: listing._id, status: 'available' }, { $set: { status: 'reserved' } }, { new: true });
      if (!reserved) return res.status(409).json({ success: false, message: 'This item is no longer available' });
      const selected = await ItemRequest.findOneAndUpdate({ _id: request._id, status: 'pending' }, { $set: { status: 'accepted' } }, { new: true });
      if (!selected) { await Listing.updateOne({ _id: listing._id, status: 'reserved' }, { $set: { status: 'available' } }); return res.status(409).json({ success: false, message: 'This request was already resolved' }); }
      await ItemRequest.updateMany({ listingId: listing._id, _id: { $ne: request._id }, status: 'pending' }, { $set: { status: 'declined' } });
      return ok(res, { request: selected, listing: reserved }, 'Request accepted; competing requests declined');
    }
    const declined = await ItemRequest.findOneAndUpdate({ _id: request._id, status: 'pending' }, { $set: { status: 'declined' } }, { new: true });
    if (!declined) return res.status(409).json({ success: false, message: 'This request was already resolved' });
    ok(res, { request: declined, listing }, 'Request declined');
  }));
  router.patch('/listings/:id/collect', auth, [idRule, validate], asyncRoute(async (req, res) => {
    const listing = await ownListing(req, res); if (!listing) return;
    if (listing.status !== 'reserved') return res.status(409).json({ success: false, message: 'Only reserved items can be marked as collected' });
    listing.status = 'collected'; await listing.save(); ok(res, { listing }, 'Item marked as collected');
  }));
  router.post('/listings/:id/reports', auth, [idRule, body('reason').trim().isLength({ min: 5, max: 1000 }), validate], asyncRoute(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });
    if (listing.ownerId.equals(req.user._id)) return res.status(403).json({ success: false, message: 'You cannot report your own listing' });
    if (await ContentReport.exists({ listingId: listing._id, reporterId: req.user._id })) return res.status(409).json({ success: false, message: 'You have already reported this listing' });
    const report = await ContentReport.create({ listingId: listing._id, reporterId: req.user._id, reason: req.body.reason });
    ok(res, { report }, 'Report submitted for review', 201);
  }));
  router.get('/moderation/reports', auth, moderatorOnly, asyncRoute(async (req, res) => {
    const status = req.query.status && ['pending', 'reviewed', 'dismissed'].includes(req.query.status) ? req.query.status : undefined;
    const reports = await ContentReport.find(status ? { status } : {}).populate('listingId').populate('reporterId', 'name').sort({ createdAt: 1 }).lean();
    ok(res, { reports: reports.map(report => ({ ...report, listingId: report.listingId ? safeListing(report.listingId, req) : null })) });
  }));
  router.patch('/moderation/reports/:id/status', auth, moderatorOnly, [idRule, body('status').isIn(['reviewed', 'dismissed']), validate], asyncRoute(async (req, res) => {
    const report = await ContentReport.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    ok(res, { report }, 'Report resolved');
  }));
  router.get('/dashboard/summary', auth, asyncRoute(async (req, res) => {
    const owner = req.user._id;
    const [listingCounts, receivedPending, submitted] = await Promise.all([
      Listing.aggregate([{ $match: { ownerId: owner } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      ItemRequest.countDocuments({ listingId: { $in: await Listing.find({ ownerId: owner }).distinct('_id') }, status: 'pending' }),
      ItemRequest.countDocuments({ requesterId: owner })
    ]);
    const counts = Object.fromEntries(listingCounts.map((x) => [x._id, x.count]));
    ok(res, { totalListings: Object.values(counts).reduce((a, b) => a + b, 0), availableListings: counts.available || 0, reservedListings: counts.reserved || 0, collectedItems: counts.collected || 0, pendingRequestsReceived: receivedPending, requestsSubmitted: submitted });
  }));
  return router;
}
