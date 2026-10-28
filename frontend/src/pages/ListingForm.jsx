import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';

const empty = { title: '', category: '', condition: '', description: '', pickupArea: '', pickupAddress: '', pickupTime: '', imageUrl: '' };

export default function ListingForm() {
  const { id } = useParams();
  const edit = Boolean(id);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (edit) api.get(`/listings/${id}`).then(({ data }) => setForm({ ...empty, ...data.data.listing })).catch(e => setError(e.message));
  }, [id, edit]);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await api[edit ? 'patch' : 'post'](edit ? `/listings/${id}` : '/listings', form);
      navigate(`/listings/${data.data.listing._id}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return <main className="page-wrap narrow">
    <div className="page-heading left"><span className="kicker">{edit ? 'Give it an update' : 'Pass something along'}</span><h1>{edit ? 'Edit your listing' : <>Give a good thing <em>a new home</em></>}</h1><p>Tell your neighbors a little about what you're sharing.</p></div>
    <form className="form-card listing-form" onSubmit={submit}>
      {error && <div className="notice error" role="alert">{error}</div>}
      <label>Item title<input name="title" value={form.title} onChange={change} required minLength="2" maxLength="120" placeholder="e.g. A well-loved reading lamp"/></label>
      <div className="two-fields"><label>Category<select name="category" value={form.category} onChange={change} required><option value="">Choose a category</option>{['Electronics', 'Books', 'Clothing', 'Furniture', 'Home & Kitchen', 'Toys', 'Sports', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label><label>Condition<select name="condition" value={form.condition} onChange={change} required><option value="">Choose condition</option>{['Like New', 'Good', 'Fair'].map(x => <option key={x}>{x}</option>)}</select></label></div>
      <label>Description<textarea name="description" value={form.description} onChange={change} required minLength="10" maxLength="2000" rows="5" placeholder="What's useful to know about it?"/></label>
      <label>Approximate pickup area<input name="pickupArea" value={form.pickupArea} onChange={change} required minLength="2" maxLength="120" placeholder="Neighborhood or nearby landmark"/></label>
      <label>Exact pickup address <span className="muted">(only shown to you and the person you accept)</span><input name="pickupAddress" value={form.pickupAddress} onChange={change} required minLength="5" maxLength="300" placeholder="Street, building, and any directions" autoComplete="street-address"/></label>
      <label>Pickup days and time <span className="muted">(for example, weekdays 5–7 PM)</span><input name="pickupTime" value={form.pickupTime} onChange={change} required minLength="3" maxLength="200" placeholder="When can the item be collected?"/></label>
      <label>Image URL <span className="muted">(optional)</span><input type="url" name="imageUrl" value={form.imageUrl || ''} onChange={change} placeholder="https://…"/></label>
      {form.imageUrl && <img className="listing-photo-preview" src={form.imageUrl} alt="Preview of the item" onError={(e) => { e.currentTarget.style.display = 'none'; }} onLoad={(e) => { e.currentTarget.style.display = 'block'; }} />}
      <button className="button form-submit" disabled={busy}>{busy ? 'Saving…' : edit ? 'Save changes' : 'Share this item'}</button>
    </form>
  </main>;
}
