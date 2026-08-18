function inlineText(nodes, parts) {
  for (const node of nodes ?? []) {
    if (typeof node === "string") {
      parts.push(node);
    } else if (node.type === "text") {
      parts.push(node.text ?? "");
    } else if (node.content) {
      inlineText(node.content, parts);
    }
  }

  return parts;
}

export function collectHeadings(blocks, headings = []) {
  for (const block of blocks ?? []) {
    if (block.type === "heading") {
      const text = inlineText(block.content, []).join("").trim();

      headings.push({
        id: block.id,
        level: block.props?.level ?? 1,
        text,
      });
    }

    if (block.children?.length) {
      collectHeadings(block.children, headings);
    }
  }

  return headings;
}

export function sameHeadings(a, b) {
  return (
    a.length === b.length &&
    a.every(
      (heading, index) =>
        heading.id === b[index].id &&
        heading.level === b[index].level &&
        heading.text === b[index].text,
    )
  );
}
