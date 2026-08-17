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

function highlightTextNodes(html, query) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const regex = new RegExp(`(${escaped})`, "gi");
  const needle = query.toLowerCase();

  const doc = new DOMParser().parseFromString(html, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const node of textNodes) {
    const parts = node.nodeValue.split(regex);
    if (parts.length === 1) continue;

    const fragment = doc.createDocumentFragment();

    for (const part of parts) {
      if (!part) continue;

      if (part.toLowerCase() === needle) {
        const mark = doc.createElement("mark");
        mark.className = "search-highlight";
        mark.textContent = part;
        fragment.appendChild(mark);
      } else {
        fragment.appendChild(doc.createTextNode(part));
      }
    }

    node.parentNode.replaceChild(fragment, node);
  }

  return doc.body.innerHTML;
}

export function renderMarkdown(content, query) {
  const html = DOMPurify.sanitize(marked.parse(content), {
    ADD_ATTR: ["class"],
  });

  return query ? highlightTextNodes(html, query) : html;
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
