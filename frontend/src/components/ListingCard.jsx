import { Link } from 'react-router-dom';
import { FiMapPin, FiArrowUpRight } from 'react-icons/fi';
import { useState } from 'react';
export default function ListingCard({ listing }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <article className="listing-card"><Link to={`/listings/${listing._id}`} className="card-image" aria-label={`View ${listing.title}`}>
    {listing.imageUrl && !imageFailed ? <img src={listing.imageUrl} alt={listing.title} onError={() => setImageFailed(true)}/> : <div className="image-placeholder"><span>♻</span><small>Ready for a new home</small></div>}
    <span className={`badge badge-${listing.status}`}>{listing.status}</span>
  </Link><div className="card-body"><div className="eyebrow">{listing.category}<span>·</span>{listing.condition}</div><h3><Link to={`/listings/${listing._id}`}>{listing.title}</Link></h3><p className="location"><FiMapPin/>{listing.pickupArea}</p><Link className="card-link" to={`/listings/${listing._id}`}>View details <FiArrowUpRight/></Link></div></article>;
}
