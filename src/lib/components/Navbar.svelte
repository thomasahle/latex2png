<script>
  import { onMount } from 'svelte';
  import { theme } from '../stores/theme.js';
  
  let starCount = '';
  
  function toggleTheme() {
    theme.toggle();
  }
  
  // Reactive icon based on current theme
  $: iconClass = $theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon-stars';
  
  onMount(async () => {
    // Fetch actual star count from GitHub API
    try {
      const response = await fetch('https://api.github.com/repos/thomasahle/latex2png');
      const data = await response.json();
      starCount = data.stargazers_count || '';
    } catch (error) {
      console.error('Failed to fetch star count:', error);
      // Leave empty if fetch fails
    }
  });
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
       class="github-link-styled"
       aria-label="Star thomasahle/latex2png on GitHub">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: text-bottom; margin-right: 4px;">
        <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/>
      </svg>
      Star on GitHub
      {#if starCount}
        <span class="github-count">{starCount}</span>
      {/if}
    </a>
  </div>
</nav>
