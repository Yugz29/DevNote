import { useEffect, useState } from "react";
import { highlightCode } from "../lib/highlight.js";

export default function CodeBlock({ code, language, className = "" }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    let isStale = false;

    const store = (html) => {
      if (!isStale) setResult({ code, language, html });
    };

    highlightCode(code, language).then(store, () => store(null));

    return () => {
      isStale = true;
    };
  }, [code, language]);

  const html =
    result?.code === code && result?.language === language ? result.html : null;

  const classes = `code-block${className ? ` ${className}` : ""}`;

  if (html) {
    return (
      <div className={classes} dangerouslySetInnerHTML={{ __html: html }} />
    );
  }

  return (
    <div className={classes}>
      <pre className="code-block-plain">
        <code>{code}</code>
      </pre>
    </div>
  );
}
