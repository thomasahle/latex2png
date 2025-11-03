<script>
  import { theme } from '../stores/theme.js';
  
  function toggleTheme() {
    theme.toggle();
  }
  
  // Reactive icon based on current theme
  $: iconClass = $theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon-stars';
</script>

<nav class="navbar">
  <div class="navbar-left">
    <span class="site-title">LaTeX to Image</span>
  </div>
  <div class="navbar-right">
    <div class="theme-toggle" on:click={toggleTheme}>
      <i id="theme-toggle-icon" class={iconClass}></i>
      <span class="theme-toggle-text">Toggle theme</span>
    </div>
    <a href="https://github.com/thomasahle/latex2png" 
       target="_blank"
       rel="noopener noreferrer"
       class="github-link"
       aria-label="Star thomasahle/latex2png on GitHub">
      ⭐ Star on GitHub
    </a>
  </div>
</nav>
