import DOMPurify from "dompurify";
import { marked } from "marked";
import mermaid from "mermaid";

const renderer = new marked.Renderer();

renderer.code = function ({ text, lang }) {
  if (lang === "mermaid") {
    return `<pre class="mermaid">${text}</pre>`;
  }

  const langClass = lang ? ` class="language-${lang}"` : "";
  return `<pre><code${langClass}>${text}</code></pre>`;
};

marked.use({ renderer, breaks: true, gfm: true });

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  darkMode: true,
});

export function renderMarkdown(content) {
  return DOMPurify.sanitize(marked.parse(content), { ADD_ATTR: ["class"] });
}

export async function runMermaid(container) {
  const nodes = container?.querySelectorAll(".mermaid");
  if (!nodes?.length) return;

  try {
    await mermaid.run({ nodes });
  } catch (error) {
    console.error("Error rendering mermaid diagrams:", error);
  }
}
