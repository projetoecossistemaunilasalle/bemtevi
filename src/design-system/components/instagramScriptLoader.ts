declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}

const INSTAGRAM_SCRIPT_SRC = 'https://www.instagram.com/embed.js';
let scriptPromise: Promise<void> | null = null;

export function loadInstagramEmbedScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (window.instgrm?.Embeds) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${INSTAGRAM_SCRIPT_SRC}"], script[src="//www.instagram.com/embed.js"]`,
  );

  if (existingScript) {
    if (window.instgrm?.Embeds) {
      return Promise.resolve();
    }
    scriptPromise = new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', (e) => reject(e), { once: true });
    });
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = INSTAGRAM_SCRIPT_SRC;
    script.async = true;

    script.onload = () => {
      resolve();
    };

    script.onerror = (error) => {
      scriptPromise = null;
      script.remove();
      reject(error);
    };

    document.body.appendChild(script);
  });

  return scriptPromise;
}

export function resetInstagramScriptPromiseForTests() {
  scriptPromise = null;
}
