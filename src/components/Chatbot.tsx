'use client';

import React, { useState, useEffect, useRef } from 'react';

type Language = 'cs' | 'sk' | 'en';
type ChatStep =
  | 'GREETING'
  | 'EMAIL_REQUEST'
  | 'SENDING'
  | 'COMPLETED'
  | 'DECLINED'
  | 'ERROR';

const translations = {
  cs: {
    header: '🍰 Ta Cukrárna Bot',
    greeting: 'Ahoj! Vítejte v naší rodinné cukrárně. 🍰',
    question: 'Chcete si objednat svatební dort?',
    yes: 'Ano, chci',
    no: 'Ne, děkuji',
    emailPrompt:
      'Super! Zadejte prosím svůj e-mail, abychom Vám mohli poslat odkaz na náš skvělý návod:',
    emailPlaceholder: 'vas@email.cz',
    send: 'Odeslat',
    sending: 'Odesílám...',
    success:
      'Děkujeme! Odeslali jsme Vám e-mail s odkazem na stažení návodu. ✉️',
    declined:
      'Dobře, kdybyste změnil(a) názor, stačí kliknout na 🍰. Přejeme sladký den!',
    invalidEmail: 'Zadejte prosím platnou e-mailovou adresu.',
    errorFallback:
      'Omlouváme se, došlo k chybě při odesílání. Zkus to prosím znovu.',
    close: 'Zavřít',
    startOver: 'Začít znovu',
  },
  sk: {
    header: '🍰 Ta Cukrárna Bot',
    greeting: 'Ahoj! Vitajte v našej rodinnej cukrárni. 🍰',
    question: 'Chcete si objednať tortu?',
    yes: 'Áno, chcem',
    no: 'Nie, ďakujem',
    emailPrompt:
      'Super! Zadajte prosím svoj e-mail, aby sme Vám mohli poslať odkaz na náš skvelý návod:',
    emailPlaceholder: 'vas@email.sk',
    send: 'Odoslať',
    sending: 'Odosielam...',
    success:
      'Ďakujeme! Odoslali sme Vám e-mail s odkazom na stiahnutie návodu. ✉️',
    declined:
      'Dobre, keby ste zmenili názor, stačí kliknúť na 🍰. Prajeme sladký deň!',
    invalidEmail: 'Zadajte prosím platnú e-mailovú adresu.',
    errorFallback:
      'Omlúvame sa, došlo k chybe pri odosielaní. Skúste to prosím znova.',
    close: 'Zavrieť',
    startOver: 'Začať znova',
  },
  en: {
    header: '🍰 Ta Cukrárna Bot',
    greeting: 'Hello! Welcome to our family bakery. 🍰',
    question: 'Would you like to order a cake?',
    yes: 'Yes, please',
    no: 'No, thanks',
    emailPrompt:
      'Great! Please enter your email address and we will send you a link to our complete catalog:',
    emailPlaceholder: 'your@email.com',
    send: 'Send',
    sending: 'Sending...',
    success:
      'Thank you! We have sent you an email with the link to download the catalog. ✉️',
    declined:
      'Alright, if you change your mind, just click the 🍰 again. Have a sweet day!',
    invalidEmail: 'Please enter a valid email address.',
    errorFallback: 'Sorry, an error occurred while sending. Please try again.',
    close: 'Close',
    startOver: 'Start over',
  },
};

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ChatStep>('GREETING');
  const [language, setLanguage] = useState<Language>('cs');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect browser language setting on mount (runs client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userLangs = navigator.languages || [navigator.language];
      let detected: Language = 'cs';
      for (const lang of userLangs) {
        const code = lang.toLowerCase().split('-')[0];
        if (code === 'cs' || code === 'sk' || code === 'en') {
          detected = code as Language;
          break;
        }
      }
      if (detected !== 'cs') {
        const langToSet = detected;
        setTimeout(() => {
          setLanguage(langToSet);
        }, 0);
      }
    }
  }, []);

  // Focus the email input when arriving at the email prompt step
  useEffect(() => {
    if (step === 'EMAIL_REQUEST' && isOpen) {
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
  }, [step, isOpen]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    // Reset state when opening
    if (!isOpen) {
      setStep('GREETING');
      setEmail('');
      setErrorMessage('');
    }
  };

  const handleOrderConfirm = () => {
    setStep('EMAIL_REQUEST');
  };

  const handleOrderDecline = () => {
    setStep('DECLINED');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Quick client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage(translations[language].invalidEmail);
      return;
    }

    setStep('SENDING');

    try {
      // Direct post to our PHP API endpoint (which Next.js static builds serve at /api/chatbot.php)
      const response = await fetch('/api/chatbot.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          language: language,
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        setStep('COMPLETED');
      } else {
        setErrorMessage(result.error || translations[language].errorFallback);
        setStep('ERROR');
      }
    } catch {
      setErrorMessage(translations[language].errorFallback);
      setStep('ERROR');
    }
  };

  const handleStartOver = () => {
    setStep('GREETING');
    setEmail('');
    setErrorMessage('');
  };

  const text = translations[language];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans">
      {/* Chat Window Panel */}
      <div
        id="chatbot-panel"
        className={`w-[320px] sm:w-[350px] bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 origin-bottom-right ${
          isOpen
            ? 'scale-100 opacity-100 translate-y-0'
            : 'scale-90 opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="bg-amber-500 text-white px-4 py-3 flex justify-between items-center font-bold tracking-wide shadow-sm">
          <span>{text.header}</span>
          <button
            onClick={toggleChat}
            className="text-white hover:text-zinc-200 transition-colors text-2xl leading-none font-light cursor-pointer select-none"
            aria-label={text.close}
            id="chatbot-close-btn"
          >
            &times;
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 flex flex-col gap-4 text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed min-h-[160px] justify-center">
          {step === 'GREETING' && (
            <div className="flex flex-col gap-4">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {text.greeting}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                {text.question}
              </p>
              <div className="flex gap-2.5 mt-2">
                <button
                  onClick={handleOrderConfirm}
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold rounded-xl transition-all cursor-pointer text-center select-none shadow-md shadow-amber-500/10"
                  id="chatbot-yes-btn"
                >
                  {text.yes}
                </button>
                <button
                  onClick={handleOrderDecline}
                  className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl transition-all cursor-pointer text-center select-none"
                  id="chatbot-no-btn"
                >
                  {text.no}
                </button>
              </div>
            </div>
          )}

          {step === 'EMAIL_REQUEST' && (
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
              <label
                htmlFor="chatbot-email-input"
                className="font-medium text-zinc-700 dark:text-zinc-300"
              >
                {text.emailPrompt}
              </label>
              <input
                ref={emailInputRef}
                type="email"
                id="chatbot-email-input"
                required
                placeholder={text.emailPlaceholder}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
              />
              {errorMessage && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-2.5 rounded-xl">
                  {errorMessage}
                </div>
              )}
              <button
                type="submit"
                className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold rounded-xl transition-all cursor-pointer text-center select-none shadow-md shadow-amber-500/10 mt-1"
                id="chatbot-submit-email-btn"
              >
                {text.send}
              </button>
            </form>
          )}

          {step === 'SENDING' && (
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <svg
                className="animate-spin h-8 w-8 text-amber-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                {text.sending}
              </span>
            </div>
          )}

          {step === 'COMPLETED' && (
            <div className="flex flex-col gap-4 text-center items-center py-2">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 text-2xl">
                ✓
              </div>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                {text.success}
              </p>
              <button
                onClick={toggleChat}
                className="mt-2 px-5 py-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 active:scale-95 text-white font-semibold rounded-xl transition-all cursor-pointer text-center select-none"
                id="chatbot-finish-btn"
              >
                {text.close}
              </button>
            </div>
          )}

          {step === 'DECLINED' && (
            <div className="flex flex-col gap-4 py-2">
              <p className="text-zinc-700 dark:text-zinc-300">
                {text.declined}
              </p>
              <button
                onClick={toggleChat}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 active:scale-95 text-white font-semibold rounded-xl transition-all cursor-pointer text-center select-none mt-2"
                id="chatbot-decline-close-btn"
              >
                {text.close}
              </button>
            </div>
          )}

          {step === 'ERROR' && (
            <div className="flex flex-col gap-4 text-center items-center py-2">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 text-2xl font-bold">
                !
              </div>
              <p className="text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 rounded-xl w-full">
                {errorMessage || text.errorFallback}
              </p>
              <button
                onClick={handleStartOver}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold rounded-xl transition-all cursor-pointer text-center select-none mt-2"
                id="chatbot-retry-btn"
              >
                {text.startOver}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Toggle Button */}
      <button
        onClick={toggleChat}
        className="w-14 h-14 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white rounded-full shadow-lg hover:shadow-xl hover:shadow-amber-500/20 dark:hover:shadow-amber-600/20 flex items-center justify-center text-3xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer select-none border border-amber-400/20 dark:border-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 dark:focus:ring-offset-black"
        aria-label="Chatbot"
        id="chatbot-toggle-btn"
      >
        🍰
      </button>
    </div>
  );
}
