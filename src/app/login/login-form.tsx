'use client';

import { useState } from 'react';

export function LoginForm({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = useState(false);
  return (
    <form
      action="/auth/login"
      method="post"
      onSubmit={() => setPending(true)}
      className="space-y-5"
    >
      <div>
        <label htmlFor="email" className="label">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
          disabled={!enabled}
          readOnly={pending}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={1024}
          required
          disabled={!enabled}
          readOnly={pending}
          className="field"
        />
      </div>
      <button
        disabled={!enabled || pending}
        aria-busy={pending}
        className="button w-full"
        type="submit"
      >
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
