import { Link } from 'react-router-dom';

export default function PageBackButton({ to, label }) {
  return (
    <Link className="page-back-button" to={to} aria-label={label}>
      <span className="page-back-button-icon" aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
