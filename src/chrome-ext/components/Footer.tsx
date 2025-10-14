declare const __APP_VERSION__: string;

export const Footer = () => {
  const linkClasses =
    'text-sky-600 hover:text-sky-500 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded';

  return (
    <footer className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <a
          href="https://github.com/dreamiurg/mountaineers-assistant/issues"
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
        >
          Report a bug
        </a>
        <span className="text-slate-300" aria-hidden="true">
          |
        </span>
        <a
          href="https://github.com/dreamiurg/mountaineers-assistant/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
        >
          Request a feature
        </a>
        <span className="text-slate-300" aria-hidden="true">
          |
        </span>
        <a
          href="https://github.com/dreamiurg/mountaineers-assistant/blob/main/PRIVACY.md"
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
        >
          Privacy Policy
        </a>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Mountaineers Assistant is an open-source community project
      </p>
      <p className="mt-1 text-xs text-slate-400">v{__APP_VERSION__}</p>
    </footer>
  );
};

export default Footer;
