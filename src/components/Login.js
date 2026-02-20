import { loginUrl } from "../services/auth.js";

export function renderLogin(container) {
  const github = loginUrl();

  container.innerHTML = `
    <div class="login-split" role="main" aria-label="HackerBoard sign-in">

      <!-- Left panel: branding + CTA -->
      <div class="login-split__left">
        <div class="login-split__content">
          <div class="login-logo" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="56" height="56" rx="14" fill="var(--color-accent)"/>
              <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
                font-size="28" font-weight="800" fill="#fff" font-family="system-ui">H</text>
            </svg>
          </div>
          <h1 class="login-split__title">Welcome to<br/>HackerBoard</h1>
          <p class="login-split__subtitle">Live hackathon scoring dashboard with real-time leaderboards, rubric-based judging, and team analytics.</p>

          <a href="${github}" class="btn btn-primary login-split__btn" aria-label="Sign in with GitHub">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            Sign in with GitHub
          </a>

          <p class="login-split__footer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Secured by Azure App Service Easy Auth
          </p>
        </div>
      </div>

      <!-- Right panel: bold visual -->
      <div class="login-split__right" aria-hidden="true">
        <div class="login-visual">
          <div class="login-visual__grid"></div>
          <div class="login-visual__glow login-visual__glow--1"></div>
          <div class="login-visual__glow login-visual__glow--2"></div>
          <div class="login-visual__text">
            <span class="login-visual__emoji">&#x1F3C6;</span>
            <span class="login-visual__tagline">Score. Rank. Win.</span>
          </div>
        </div>
      </div>

    </div>
  `;
}
