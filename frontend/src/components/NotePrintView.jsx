import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import {
  markdownToBlocks,
  noteExtensions,
  noteSchema,
} from "../lib/blocknote.js";

const SETTLE_DELAY = 250;
const MAX_WAIT = 5000;

export default function NotePrintView({ title, content, onDone }) {
  const rootRef = useRef(null);
  const [initialContent] = useState(() => markdownToBlocks(content));

  const editor = useCreateBlockNote(
    {
      schema: noteSchema,
      extensions: noteExtensions,
      initialContent: initialContent ?? undefined,
    },
    [],
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;

    let settleTimer = null;
    let deadlineTimer = null;
    let hasPrinted = false;

    const print = () => {
      if (hasPrinted) return;
      hasPrinted = true;

      observer.disconnect();
      window.clearTimeout(settleTimer);
      window.clearTimeout(deadlineTimer);

      window.addEventListener("afterprint", onDone, { once: true });
      window.print();
    };

    const observer = new MutationObserver(() => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(print, SETTLE_DELAY);
    });

    observer.observe(node, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });

    settleTimer = window.setTimeout(print, SETTLE_DELAY);
    deadlineTimer = window.setTimeout(print, MAX_WAIT);

    return () => {
      observer.disconnect();
      window.clearTimeout(settleTimer);
      window.clearTimeout(deadlineTimer);
      window.removeEventListener("afterprint", onDone);
    };
  }, [onDone]);

  return createPortal(
    <div className="note-print" ref={rootRef}>
      <h1 className="note-print-title">{title}</h1>

      <BlockNoteView
        editor={editor}
        editable={false}
        theme="light"
        className="note-print-view"
        slashMenu={false}
      />
    </div>,
    document.body,
  );
}
