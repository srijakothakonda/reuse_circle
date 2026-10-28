import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../app.js';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import ItemRequest from '../models/ItemRequest.js';
import ContentReport from '../models/ContentReport.js';
import bcrypt from 'bcryptjs';

let mongo, app, owner, requester, other, moderator, ownerAgent, requesterAgent, otherAgent, moderatorAgent;
const config = { port: 5000, nodeEnv: 'test', mongoUri: '', jwtSecret: 'test_secret_that_is_long_enough_for_this_suite', clientUrl: 'http://localhost:5173', cookieSecure: false, cookieSameSite: 'lax', trustProxy: 0 };
const register = async (agent, email, name) => { await agent.post('/api/auth/register').send({ name, email, password: 'SecurePass123', confirmPassword: 'SecurePass123' }).expect(201); await agent.post('/api/auth/login').send({ email, password: 'SecurePass123' }).expect(200); };
const createListing = async (agent, title='Test bookshelf') => agent.post('/api/listings').send({ title, category: 'Books', condition: 'Good', description: 'A useful item in good shape.', pickupArea: 'Northside', pickupAddress: '123 Maple Street, Apt 4', pickupTime: 'Weekdays 5–7 PM' }).expect(201);

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri()); app = createApp(config);
  ownerAgent=request.agent(app); requesterAgent=request.agent(app); otherAgent=request.agent(app); moderatorAgent=request.agent(app);
  await register(ownerAgent,'owner@example.test','Owner'); await register(requesterAgent,'requester@example.test','Requester'); await register(otherAgent,'other@example.test','Other'); await register(moderatorAgent,'moderator@example.test','Mod');
  owner=await User.findOne({email:'owner@example.test'}); requester=await User.findOne({email:'requester@example.test'}); other=await User.findOne({email:'other@example.test'}); moderator=await User.findOneAndUpdate({email:'moderator@example.test'},{role:'moderator'},{new:true});
});
after(async()=>{await mongoose.disconnect();await mongo.stop();});
beforeEach(async()=>{await Promise.all([Listing.deleteMany({}),ItemRequest.deleteMany({}),ContentReport.deleteMany({})]);});

test('registration validates inputs, hashes passwords, and rejects duplicate email', async()=>{
  const invalidEmail=await request(app).post('/api/auth/register').send({name:'Valid Name',email:'bad',password:'SecurePass123',confirmPassword:'SecurePass123'}).expect(400);
  assert.equal(invalidEmail.body.message,'Please enter a valid email address');
  const weakPassword=await request(app).post('/api/auth/register').send({name:'Valid Name',email:'weak@example.test',password:'alllowercase',confirmPassword:'alllowercase'}).expect(400);
  assert.equal(weakPassword.body.message,'Password must include an uppercase letter');
  await request(app).post('/api/auth/register').send({name:'Owner',email:'owner@example.test',password:'SecurePass123',confirmPassword:'SecurePass123'}).expect(409);
  const saved=await User.findById(owner._id).select('+passwordHash');assert.notEqual(saved.passwordHash,'SecurePass123');
});
test('login sets HttpOnly cookie; protected APIs reject unauthenticated callers; logout clears it',async()=>{
  await request(app).get('/api/auth/me').expect(401);
  await request(app).post('/api/auth/login').send({email:'owner@example.test',password:'incorrectPassword123'}).expect(401);
  const login=await request(app).post('/api/auth/login').send({email:'owner@example.test',password:'SecurePass123'}).expect(200);
  assert.match(login.headers['set-cookie'][0],/HttpOnly/i);
  const agent=request.agent(app); await agent.post('/api/auth/login').send({email:'owner@example.test',password:'SecurePass123'}).expect(200); await agent.get('/api/auth/me').expect(200); await agent.post('/api/auth/logout').expect(200); await agent.get('/api/auth/me').expect(401);
});
test('listing create, search, filter, update, delete, and ownership enforcement',async()=>{
  const created=await createListing(ownerAgent); const id=created.body.data.listing._id;
  await otherAgent.patch(`/api/listings/${id}`).send({title:'Hijack'}).expect(403);
  await otherAgent.delete(`/api/listings/${id}`).expect(403);
  await request(app).get('/api/listings?search=books&category=Books&condition=Good&status=available').expect(200).expect(r=>assert.equal(r.body.data.pagination.total,1));
  await ownerAgent.patch(`/api/listings/${id}`).send({title:'Updated shelf'}).expect(200);
  await ownerAgent.delete(`/api/listings/${id}`).expect(200);
});
test('request workflow enforces owner, acceptance declines competitors, reserved/collected states reject requests',async()=>{
  const listing=(await createListing(ownerAgent)).body.data.listing; const id=listing._id;
  await ownerAgent.post(`/api/listings/${id}/requests`).send({message:'Please may I have this?'}).expect(403);
  const a=(await requesterAgent.post(`/api/listings/${id}/requests`).send({message:'I would love this item.'}).expect(201)).body.data.request;
  await requesterAgent.post(`/api/listings/${id}/requests`).send({message:'I would like to ask twice.'}).expect(409);
  const b=(await otherAgent.post(`/api/listings/${id}/requests`).send({message:'I can use this too.'}).expect(201)).body.data.request;
  await otherAgent.patch(`/api/requests/${a._id}/status`).send({status:'accepted'}).expect(403);
  await ownerAgent.patch(`/api/requests/${a._id}/status`).send({status:'accepted'}).expect(200);
  assert.equal((await ItemRequest.findById(a._id)).status,'accepted');assert.equal((await ItemRequest.findById(b._id)).status,'declined');assert.equal((await Listing.findById(id)).status,'reserved');
  await otherAgent.post(`/api/listings/${id}/requests`).send({message:'Still interested.'}).expect(409);
  await ownerAgent.patch(`/api/listings/${id}/collect`).expect(200);
  assert.equal((await Listing.findById(id)).status,'collected');
  await otherAgent.post(`/api/listings/${id}/requests`).send({message:'Please request this.'}).expect(409);
  await ownerAgent.patch(`/api/listings/${id}/collect`).expect(409);
});
test('declining keeps listing available and another request can be accepted',async()=>{
  const listing=(await createListing(ownerAgent)).body.data.listing;const id=listing._id;
  const a=(await requesterAgent.post(`/api/listings/${id}/requests`).send({message:'I would love this item.'})).body.data.request;
  const b=(await otherAgent.post(`/api/listings/${id}/requests`).send({message:'I can use this too.'})).body.data.request;
  await ownerAgent.patch(`/api/requests/${a._id}/status`).send({status:'declined'}).expect(200);
  assert.equal((await Listing.findById(id)).status,'available');
  await ownerAgent.patch(`/api/requests/${b._id}/status`).send({status:'accepted'}).expect(200);
});
test('reports reject self reports, duplicates, and non-moderator resolution',async()=>{
  const listing=(await createListing(ownerAgent)).body.data.listing;
  await ownerAgent.post(`/api/listings/${listing._id}/reports`).send({reason:'Something is wrong here.'}).expect(403);
  const report=(await requesterAgent.post(`/api/listings/${listing._id}/reports`).send({reason:'This listing seems inappropriate.'}).expect(201)).body.data.report;
  await requesterAgent.post(`/api/listings/${listing._id}/reports`).send({reason:'Another reason for report.'}).expect(409);
  await ownerAgent.get('/api/moderation/reports').expect(403);
  const moderatorReports=await moderatorAgent.get('/api/moderation/reports').expect(200);
  assert.equal(moderatorReports.body.data.reports[0].listingId.pickupAddress,undefined);
  await moderatorAgent.patch(`/api/moderation/reports/${report._id}/status`).send({status:'reviewed'}).expect(200);
});
test('public listing payload does not expose owner email or password hash',async()=>{
  const listing=(await createListing(ownerAgent)).body.data.listing;
  const result=await request(app).get(`/api/listings/${listing._id}`).expect(200);
  assert.equal(result.body.data.listing.email,undefined);assert.equal(result.body.data.listing.passwordHash,undefined);
  assert.equal(result.body.data.listing.pickupAddress,undefined);assert.equal(result.body.data.listing.pickupTime,undefined);
  assert.equal(result.body.data.listing.pickupAddress,undefined);
  const ownerView=await ownerAgent.get(`/api/listings/${listing._id}`).expect(200);
  assert.equal(ownerView.body.data.listing.pickupAddress,'123 Maple Street, Apt 4');
});
test('image URL validation and pickup details privacy through request acceptance',async()=>{
  await ownerAgent.post('/api/listings').send({title:'Bad image',category:'Books',condition:'Good',description:'A useful item with a bad image URL.',pickupArea:'Northside',pickupAddress:'123 Maple Street, Apt 4',pickupTime:'Weekdays 5–7 PM',imageUrl:'not-a-url'}).expect(400);
  const created=await ownerAgent.post('/api/listings').send({title:'A photo item',category:'Books',condition:'Good',description:'A useful item with its picture.',pickupArea:'Northside',pickupAddress:'123 Maple Street, Apt 4',pickupTime:'Weekdays 5–7 PM',imageUrl:'https://example.test/book.jpg'}).expect(201);
  const listing=created.body.data.listing;
  assert.equal(listing.imageUrl,'https://example.test/book.jpg');
  const pending=(await requesterAgent.post(`/api/listings/${listing._id}/requests`).send({message:'I would love this photo item.'}).expect(201)).body.data.request;
  assert.equal((await requesterAgent.get(`/api/listings/${listing._id}`).expect(200)).body.data.listing.pickupAddress,undefined);
  await ownerAgent.patch(`/api/requests/${pending._id}/status`).send({status:'accepted'}).expect(200);
  assert.equal((await requesterAgent.get(`/api/listings/${listing._id}`).expect(200)).body.data.listing.pickupAddress,'123 Maple Street, Apt 4');
  const myRequests=(await requesterAgent.get('/api/me/requests').expect(200)).body.data.requests;
  assert.equal(myRequests[0].listingId.pickupTime,'Weekdays 5–7 PM');
  await otherAgent.get(`/api/listings/${listing._id}`).expect(200).expect(r=>assert.equal(r.body.data.listing.pickupAddress,undefined));
});
