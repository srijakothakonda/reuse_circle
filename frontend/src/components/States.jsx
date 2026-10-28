export function Loading({ children = 'Loading…' }) { return <div className="page-state" role="status">{children}</div>; }
export function ErrorState({ message }) { return <div className="notice error" role="alert">{message}</div>; }
export function EmptyState({ title, text, action }) { return <div className="empty-state"><span>✳</span><h3>{title}</h3><p>{text}</p>{action}</div>; }
