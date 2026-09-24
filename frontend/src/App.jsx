import TopNav from './components/layout/TopNav';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return <div className="app-shell">
    <div className="ambient ambient-one" />
    <div className="ambient ambient-two" />
    <TopNav />
    <main><AppRoutes /></main>
  </div>;
}
