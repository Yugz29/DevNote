import { Fragment, useEffect, useState } from "react";
import { highlightCode } from "../lib/highlight.js";

export default function CodeBlock({
  code,
  language,
  className = "",
  showLineNumbers = false,
}) {
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

  const lines = code.split("\n");

  const classes = [
    "code-block",
    showLineNumbers ? "has-line-numbers" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const style = showLineNumbers
    ? { "--code-gutter-width": `${String(lines.length).length}ch` }
    : undefined;

  if (html) {
    return (
      <div
        className={classes}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className={classes} style={style}>
      <pre className="code-block-plain">
        <code>
          {lines.map((line, index) => (
            <Fragment key={index}>
              {index > 0 && "\n"}
              <span className="line">{line}</span>
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}
