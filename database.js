import mongoose from 'mongoose';
import { Counter, Order, Product, Sale, User } from './models.js';

export async function connectDatabase(uri) {
  await mongoose.connect(uri);
  await Promise.all([Counter, Order, Product, Sale, User].map((model) => model.init()));
}

export async function nextId(entity) {
  const counter = await Counter.findOneAndUpdate(
    { entity },
    { $inc: { sequence: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return counter.sequence;
}

export { mongoose };
