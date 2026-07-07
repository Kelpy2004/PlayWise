import Logo from './Logo';

const LEGAL_LINKS = [
  { label: 'Privacy', to: '#' },
  { label: 'Terms', to: '#' },
  { label: 'Cookie Policy', to: '#' },
];

export default function Footer() {
  return (
    <footer className="border-t border-border py-[60px] px-[clamp(1rem,5vw,6rem)] pb-10 bg-surface transition-[background] duration-[var(--transition-theme)]">
      <div className="mb-12 flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-[10px] text-[1.2rem] font-extrabold">
            <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-[7px] bg-[#0a1628]">
              <Logo size={18} />
            </div>
            PlayWise
          </div>
          <p className="text-[0.9rem] text-muted">We&rsquo;re here for you</p>
        </div>

        <div>
          <div className="mb-4 text-[0.72rem] font-extrabold uppercase tracking-[0.16em]">Legal</div>
          {LEGAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.to}
              className="block py-1 text-[0.88rem] text-muted transition-colors duration-200 hover:text-cyan"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-6 text-[0.78rem] text-muted">
        <span>&copy; {new Date().getFullYear()} PlayWise. All rights reserved.</span>
        <div className="flex items-center gap-2 font-semibold text-green">
          <span className="h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_8px_var(--green)]" />
          All systems operational
        </div>
      </div>
    </footer>
  );
}
