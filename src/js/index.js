import Reveal from 'reveal.js'
import hljs from 'highlight.js'
import Flipping from 'flipping/dist/flipping.web';

const flip = new Flipping({
  parent: document.getElementById('flip-parent')
})

flip.read()

Reveal.initialize({
  controls: true,
  progress: true,
  history: true,
  center: true,
  width: 1000,
  height: 800,
  transition: 'convex'
});


Reveal.addEventListener('fragmentshown', e => {
  if (e.fragment.classList.contains('flip-trigger')) {
    flip.flip()

    setTimeout(() => {
      flip.read()
    }, 2000)
  }
})

hljs.initHighlightingOnLoad()
