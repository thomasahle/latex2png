<script>
  import { latexContent } from '../stores/content.js';
  import { latexExamples } from '../utils/examples.js';
  
  let currentExampleIndex = -1;
  
  function showExample(e) {
    e.preventDefault();
    currentExampleIndex = (currentExampleIndex + 1) % latexExamples.length;
    latexContent.set(latexExamples[currentExampleIndex].trim());
  }
</script>

<h1>Convert LaTeX math equations to PNG/JPEG/SVG images</h1>
<p class="description">
  <span class="extra">
    Simply type in your LaTeX below and watch the preview update in real time.
  </span>
  Need inspiration? <a href="#" on:click={showExample}>Show example</a>.
</p>
