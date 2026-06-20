import { Link } from 'react-router-dom';
import Logo from './Logo';

const FOOTER_LINKS: Record<string, { label: string; to: string }[]> = {
  Product: [
    { label: 'Game Browser', to: '/games' },
    { label: 'Price Tracker', to: '/deals' },
    { label: 'Tournaments', to: '/tournaments' },
    { label: 'PC Compatibility', to: '/games' },
  ],
  Company: [
    { label: 'About', to: '#' },
    { label: 'Blog', to: '#' },
    { label: 'Careers', to: '#' },
    { label: 'Contact', to: '#' },
  ],
  Legal: [
    { label: 'Privacy', to: '#' },
    { label: 'Terms', to: '#' },
    { label: 'Cookie Policy', to: '#' },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-border py-[60px] px-[clamp(1rem,5vw,6rem)] pb-10 bg-surface transition-[background] duration-[var(--transition-theme)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-12 mb-12">
        <div>
          <div className="flex items-center gap-[10px] font-extrabold text-[1.2rem] mb-4">
            <div className="w-7 h-7 bg-[#0a1628] rounded-[7px] grid place-items-center overflow-hidden">
              <Logo size={18} />
            </div>
            PlayWise
          </div>
          <p className="text-muted text-[0.9rem] max-w-[300px] leading-relaxed">
            Game deals, free games, tournaments, and PC compatibility &mdash; aggregated from Steam, Epic, Xbox, Ubisoft, and more.
          </p>
        </div>

        {Object.entries(FOOTER_LINKS).map(([title, links]) => (
          <div key={title}>
            <div className="text-[0.72rem] font-extrabold uppercase tracking-[0.16em] mb-4">{title}</div>
            {links.map(link =>
              link.to.startsWith('/') ? (
                <Link key={link.label} to={link.to} className="block text-muted text-[0.88rem] py-1 hover:text-cyan transition-colors duration-200">
                  {link.label}
                </Link>
              ) : (
                <a key={link.label} href={link.to} className="block text-muted text-[0.88rem] py-1 hover:text-cyan transition-colors duration-200">
                  {link.label}
                </a>
              )
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-border text-[0.78rem] text-muted">
        <span>&copy; {new Date().getFullYear()} PlayWise. All rights reserved.</span>
        <div className="flex items-center gap-2 font-semibold text-green">
          <span className="w-1.5 h-1.5 bg-green rounded-full shadow-[0_0_8px_var(--green)]" />
          All systems operational
        </div>
      </div>
    </footer>
  );
}
