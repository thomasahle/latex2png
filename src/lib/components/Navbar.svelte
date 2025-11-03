<script>
  import { theme } from '../stores/theme.js';
  
  function toggleTheme() {
    theme.toggle();
  }
</script>

<nav class="navbar">
  <div class="navbar-left">
    <span class="site-title">LaTeX to Image</span>
  </div>
  <div class="navbar-right">
    <div class="theme-toggle" on:click={toggleTheme}>
      <i class="ph ph-moon-stars"></i>
      <span class="theme-toggle-text">Toggle theme</span>
    </div>
    <a class="github-button"
       href="https://github.com/thomasahle/latex2png"
       data-icon="octicon-star"
       data-size="large"
       data-show-count="true"
       aria-label="Star thomasahle/latex2png on GitHub">
       Star on Github
    </a>
  </div>
</nav>
