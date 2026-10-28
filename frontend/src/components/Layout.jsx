import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiMenu, FiPlusCircle, FiRefreshCw } from 'react-icons/fi';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
export function Layout() {
  const { user, logout } = useAuth(); const [open, setOpen] = useState(false); const navigate = useNavigate();
  const signOut = async () => { await logout(); navigate('/'); setOpen(false); };
  return <><header className="topbar"><div className="nav-wrap"><Link className="brand" to="/"><span className="brand-mark"><FiRefreshCw/></span> ReUseCircle</Link><button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation"><FiMenu/></button><nav className={open ? 'nav-links open' : 'nav-links'}><NavLink to="/browse" onClick={() => setOpen(false)}>Explore</NavLink>{user && <NavLink to="/dashboard" onClick={() => setOpen(false)}>My dashboard</NavLink>}{user?.role === 'moderator' && <NavLink to="/moderation" onClick={() => setOpen(false)}>Moderation</NavLink>}{user ? <><Link className="button button-small" to="/listings/new" onClick={() => setOpen(false)}><FiPlusCircle/> Give an item</Link><button className="text-button" onClick={signOut}>Log out</button></> : <><NavLink to="/login" onClick={() => setOpen(false)}>Log in</NavLink><Link className="button button-small" to="/register" onClick={() => setOpen(false)}>Join the circle</Link></>}</nav></div></header><Outlet/><footer className="footer"><div><Link className="brand" to="/"><span className="brand-mark"><FiRefreshCw/></span> ReUseCircle</Link><p>Give what you don't need. Find what you do.</p></div><span>Small acts, lighter footprints.</span></footer></>;
}
