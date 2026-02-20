export function renderLogout(container) {
  const signIn = "/.auth/login/github?post_login_redirect_uri=%2F";

  container.innerHTML = `
    <div class="login-split" role="main" aria-label="Signed out">

      <!-- Left panel: signed-out message + CTA -->
      <div class="login-split__left">
        <div class="login-split__content">
          <div class="login-logo" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="56" height="56" rx="14" fill="var(--color-accent)"/>
              <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
                font-size="28" font-weight="800" fill="#fff" font-family="system-ui">H</text>
            </svg>
          </div>
          <h1 class="login-split__title">You've been<br/>signed out</h1>
          <p class="login-split__subtitle">Thanks for using HackerBoard. Sign back in to return to the live leaderboard and scoring dashboard.</p>

          <a href="${signIn}" class="btn btn-primary login-split__btn" aria-label="Sign back in to HackerBoard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Sign In
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
            <span class="login-visual__emoji">&#x1F44B;</span>
            <span class="login-visual__tagline">See you next time!</span>
          </div>
        </div>
      </div>

    </div>
  `;
}
